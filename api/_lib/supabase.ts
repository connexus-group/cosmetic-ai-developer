/**
 * Supabase storage over its REST API (PostgREST). Server only: uses the service role key,
 * which must never reach the browser. Schema: supabase/migrations/20261013000000_market_data.sql
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Without them the pipeline still runs and
 * answers from the live API, but nothing is stored and there is no cross-request cache.
 */
import type { MarketQuery } from './adapters/types.js';
import type { AiStatement, Observation } from './observation.js';

export const http = { fetch: (url: string, init: RequestInit) => fetch(url, init) };

function cfg() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}
export const supabaseConfigured = () => cfg() !== null;

async function rest(path: string, init: RequestInit & { prefer?: string } = {}) {
  const c = cfg();
  if (!c) throw new Error('Supabase not configured');
  const r = await http.fetch(`${c.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json', ...(init.prefer ? { Prefer: init.prefer } : {}) },
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
