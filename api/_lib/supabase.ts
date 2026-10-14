/**
 * Supabase storage over its REST API (PostgREST). Server only: uses the service role key,
 * which must never reach the browser. Schema: supabase/migrations/20261013000000_market_data.sql
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (a secret key sb_secret_… or the legacy service_role key). Without them the pipeline still runs and
 * answers from the live API, but nothing is stored and there is no cross-request cache.
 */
import type { MarketQuery } from './adapters/types.js';
import type { AiStatement, Observation } from './observation.js';
import type { CompetitorProduct } from './product.js';

export const http = { fetch: (url: string, init: RequestInit) => fetch(url, init) };

/** Accepts the full Project URL, a host without https://, or just the project ref (e.g. "abcd…xyz"). */
export function supabaseBaseUrl(raw: string | undefined) {
  const v = raw?.trim().replace(/\/+$/, '');
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z0-9]{20}$/i.test(v)) return `https://${v.toLowerCase()}.supabase.co`;
  return `https://${v}`;
}

function cfg() {
  const url = supabaseBaseUrl(process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}
export const supabaseConfigured = () => cfg() !== null;

async function rest(path: string, init: RequestInit & { prefer?: string } = {}) {
  const c = cfg();
  if (!c) throw new Error('Supabase not configured');
  const r = await http.fetch(`${c.url}/rest/v1/${path}`, {
    ...init,
    // New secret keys (sb_secret_…) are not JWTs and go in `apikey` only; legacy service_role JWTs also need the Bearer header.
    headers: { apikey: c.key, ...(c.key.startsWith('eyJ') ? { Authorization: `Bearer ${c.key}` } : {}), 'Content-Type': 'application/json', ...(init.prefer ? { Prefer: init.prefer } : {}) },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

interface ObservationRow {
  id: string;
  source_name: string;
  source_url: string;
  country: string;
  category: string;
  keyword: string | null;
  metric_name: string;
  dimension: string;
  metric_value: number;
  unit: string;
  period_start: string;
  period_end: string;
  collected_at: string;
  published_at: string | null;
  data_type: 'COLLECTED';
  verification_status: Observation['verificationStatus'];
  query_hash: string;
}

const toRow = (o: Observation): ObservationRow => ({
  id: o.id,
  source_name: o.sourceName,
  source_url: o.sourceUrl,
  country: o.country,
  category: o.category,
  keyword: o.keyword,
  metric_name: o.metricName,
  dimension: o.dimension,
  metric_value: o.metricValue,
  unit: o.unit,
  period_start: o.periodStart,
  period_end: o.periodEnd,
  collected_at: o.collectedAt,
  published_at: o.publishedAt,
  data_type: o.dataType,
  verification_status: o.verificationStatus,
  query_hash: o.queryHash,
});

const fromRow = (r: ObservationRow): Observation => ({
  id: r.id,
  sourceName: r.source_name,
  sourceUrl: r.source_url,
  country: r.country,
  category: r.category,
  keyword: r.keyword,
  metricName: r.metric_name,
  dimension: r.dimension,
  metricValue: Number(r.metric_value),
  unit: r.unit,
  periodStart: String(r.period_start).slice(0, 10),
  periodEnd: String(r.period_end).slice(0, 10),
  collectedAt: r.collected_at,
  publishedAt: r.published_at,
  dataType: 'COLLECTED',
  verificationStatus: r.verification_status,
  queryHash: r.query_hash,
});

/** Last successful collection for this exact query, if any. */
export async function loadCached(queryHash: string): Promise<{ fetchedAt: string; observations: Observation[] } | null> {
  const q = (await rest(`market_queries?query_hash=eq.${queryHash}&select=last_success_at`)) as { last_success_at: string | null }[] | null;
  const at = q?.[0]?.last_success_at;
  if (!at) return null;
  const rows = (await rest(`market_observations?query_hash=eq.${queryHash}&select=*&order=period_start.asc&limit=5000`)) as ObservationRow[] | null;
  return rows?.length ? { fetchedAt: at, observations: rows.map(fromRow) } : null;
}

export async function saveObservations(sourceId: string, query: MarketQuery, queryHash: string, list: Observation[]) {
  for (let i = 0; i < list.length; i += 500) {
    await rest('market_observations?on_conflict=id', { method: 'POST', body: JSON.stringify(list.slice(i, i + 500).map(toRow)), prefer: 'resolution=merge-duplicates,return=minimal' });
  }
  await rest('market_queries?on_conflict=query_hash', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify({ query_hash: queryHash, source_id: sourceId, query, last_success_at: new Date().toISOString(), last_status: 'OK', last_error: null, observation_count: list.length }),
  });
}

export async function logFailure(sourceId: string, query: MarketQuery, queryHash: string, status: string, error: string) {
  await rest('market_queries?on_conflict=query_hash', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify({ query_hash: queryHash, source_id: sourceId, query, last_status: status, last_error: error.slice(0, 500), last_attempt_at: new Date().toISOString() }),
  });
}

/** AI-written statements go to their own table, never into market_observations. */
export async function saveAnalysis(queryHash: string, model: string, statements: AiStatement[]) {
  if (!statements.length) return;
  await rest('ai_analyses', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify(statements.map((s) => ({ query_hash: queryHash, model, statement: s.text, observation_ids: s.observationIds, data_type: s.dataType, verification_status: 'UNVERIFIED' }))),
  });
}

// ── Competitor products (Firecrawl) · schema: supabase/migrations/20261014000000_competitor_products.sql ──

interface ProductRow {
  id: string;
  url: string;
  final_url: string;
  domain: string;
  collected_at: string;
  product_name: string | null;
  brand: string | null;
  page_title: string | null;
  price_value: number | null;
  price_text: string | null;
  currency: string | null;
  volume_value: number | null;
  volume_unit: string | null;
  volume_text: string | null;
  ingredients: string[];
  ingredients_dropped: number;
  field_status: CompetitorProduct['fieldStatus'];
  robots_url: string | null;
  source_name: string;
  data_type: 'COLLECTED';
  markdown_hash: string;
  markdown_chars: number;
  regular_price_value: number | null;
  regular_price_text: string | null;
  sale_price_value: number | null;
  sale_price_text: string | null;
  category: string | null;
  key_ingredients: string[] | null;
  usp: string[] | null;
  size_value: number | null;
  size_unit: 'ml' | 'g' | null;
  size_converted: boolean | null;
  unit_price_per_100: number | null;
  country: string | null;
  country_basis: string | null;
}

const toProductRow = (p: CompetitorProduct): ProductRow => ({
  id: p.id,
  url: p.url,
  final_url: p.finalUrl,
  domain: p.domain,
  collected_at: p.collectedAt,
  product_name: p.productName,
  brand: p.brand,
  page_title: p.pageTitle,
  price_value: p.priceValue,
  price_text: p.priceText,
  currency: p.currency,
  volume_value: p.volumeValue,
  volume_unit: p.volumeUnit,
  volume_text: p.volumeText,
  ingredients: p.ingredients,
  ingredients_dropped: p.ingredientsDropped,
  field_status: p.fieldStatus,
  robots_url: p.robotsUrl,
  source_name: p.sourceName,
  data_type: p.dataType,
  markdown_hash: p.markdownHash,
  markdown_chars: p.markdownChars,
  regular_price_value: p.regularPriceValue,
  regular_price_text: p.regularPriceText,
  sale_price_value: p.salePriceValue,
  sale_price_text: p.salePriceText,
  category: p.category,
  key_ingredients: p.keyIngredients,
  usp: p.usp,
  size_value: p.sizeValue,
  size_unit: p.sizeUnit,
  size_converted: p.sizeConverted,
  unit_price_per_100: p.unitPricePer100,
  country: p.country,
  country_basis: p.countryBasis,
});

const numOrNull = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));

const fromProductRow = (r: ProductRow): CompetitorProduct => ({
  id: r.id,
  url: r.url,
  finalUrl: r.final_url,
  domain: r.domain,
  collectedAt: r.collected_at,
  productName: r.product_name,
  brand: r.brand,
  pageTitle: r.page_title,
  priceValue: r.price_value === null ? null : Number(r.price_value),
  priceText: r.price_text,
  currency: r.currency,
  volumeValue: r.volume_value === null ? null : Number(r.volume_value),
  volumeUnit: r.volume_unit,
  volumeText: r.volume_text,
  ingredients: r.ingredients ?? [],
  ingredientsDropped: r.ingredients_dropped ?? 0,
  fieldStatus: r.field_status,
  robotsUrl: r.robots_url,
  sourceName: r.source_name,
  dataType: 'COLLECTED',
  markdownHash: r.markdown_hash,
  markdownChars: r.markdown_chars,
  regularPriceValue: numOrNull(r.regular_price_value),
  regularPriceText: r.regular_price_text ?? null,
  salePriceValue: numOrNull(r.sale_price_value),
  salePriceText: r.sale_price_text ?? null,
  category: r.category ?? null,
  keyIngredients: r.key_ingredients ?? [],
  usp: r.usp ?? [],
  sizeValue: numOrNull(r.size_value),
  sizeUnit: r.size_unit ?? null,
  sizeConverted: r.size_converted ?? false,
  unitPricePer100: numOrNull(r.unit_price_per_100),
  country: r.country ?? null,
  countryBasis: r.country_basis ?? null,
});

const NEW_PRODUCT_COLUMNS = ['regular_price_value', 'regular_price_text', 'sale_price_value', 'sale_price_text', 'category', 'key_ingredients', 'usp', 'size_value', 'size_unit', 'size_converted', 'unit_price_per_100', 'country', 'country_basis'] as const;

/**
 * Upsert products. If the discovery migration (20261014120000) has not been run yet, the new columns
 * are missing: the row is saved with the original columns only and `legacy` is returned so the UI can say so.
 */
export async function saveProducts(list: CompetitorProduct[]): Promise<{ legacy: boolean }> {
  if (!list.length) return { legacy: false };
  const rows = list.map(toProductRow);
  try {
    await rest('competitor_products?on_conflict=id', { method: 'POST', body: JSON.stringify(rows), prefer: 'resolution=merge-duplicates,return=minimal' });
    return { legacy: false };
  } catch (e) {
    if (!/PGRST204|column/i.test((e as Error).message)) throw e;
    const legacy = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !(NEW_PRODUCT_COLUMNS as readonly string[]).includes(k))));
    await rest('competitor_products?on_conflict=id', { method: 'POST', body: JSON.stringify(legacy), prefer: 'resolution=merge-duplicates,return=minimal' });
    return { legacy: true };
  }
}

export async function loadProducts(ids: string[]): Promise<CompetitorProduct[]> {
  if (!ids.length) return [];
  const rows = (await rest(`competitor_products?id=in.(${ids.map(encodeURIComponent).join(',')})&select=*&order=collected_at.desc`)) as ProductRow[] | null;
  return (rows ?? []).map(fromProductRow);
}

export async function logProductAttempt(url: string, status: string, error: string | null) {
  await rest('competitor_fetch_log', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ url, status, error: error?.slice(0, 500) ?? null }) });
}

/** Reads one row id so the status check can show whether the table is reachable before credits are spent. */
export async function pingProducts(): Promise<{ ok: true; host: string } | { ok: false; host: string | null; error: string }> {
  const host = cfg() ? new URL(cfg()!.url).host : null;
  try {
    await rest('competitor_products?select=id&limit=1');
    return { ok: true, host: host ?? '' };
  } catch (e) {
    return { ok: false, host, error: (e as Error).message.slice(0, 200) };
  }
}

// ── Discovery: search cache, credit log, FX rates · schema: 20261014120000_competitor_discovery.sql ──

export async function loadSearch(queryHash: string): Promise<{ created_at: string; results: unknown } | null> {
  const rows = (await rest(`competitor_searches?query_hash=eq.${queryHash}&select=created_at,results&order=created_at.desc&limit=1`)) as { created_at: string; results: unknown }[] | null;
  return rows?.[0] ?? null;
}

export async function saveSearch(row: { query_hash: string; query: string; location: string | null; attributes: unknown; results: unknown; credits: number }) {
  await rest('competitor_searches', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(row) });
}

export async function logUsage(kind: 'search' | 'scrape', credits: number, detail: string) {
  if (credits <= 0) return;
  await rest('firecrawl_usage', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ kind, credits, detail: detail.slice(0, 300) }) });
}

/** Credits this app recorded since the start of the current UTC month (Firecrawl's own dashboard is the authority). */
export async function usageThisMonth(): Promise<{ total: number; search: number; scrape: number }> {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const rows = ((await rest(`firecrawl_usage?created_at=gte.${since}&select=kind,credits&limit=10000`)) as { kind: string; credits: number }[] | null) ?? [];
  const sum = (k?: string) => rows.filter((r) => !k || r.kind === k).reduce((a, r) => a + Number(r.credits), 0);
  return { total: sum(), search: sum('search'), scrape: sum('scrape') };
}

export async function loadFx(base: string, day: string): Promise<{ rate: number; rate_date: string } | null> {
  const rows = (await rest(`fx_rates?base=eq.${base}&quote=eq.KRW&fetched_on=eq.${day}&select=rate,rate_date&limit=1`)) as { rate: number; rate_date: string }[] | null;
  return rows?.[0] ? { rate: Number(rows[0].rate), rate_date: rows[0].rate_date } : null;
}

export async function saveFx(row: { base: string; quote: string; rate: number; rate_date: string; fetched_on: string; source: string }) {
  await rest('fx_rates?on_conflict=base,quote,fetched_on', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: JSON.stringify(row) });
}
