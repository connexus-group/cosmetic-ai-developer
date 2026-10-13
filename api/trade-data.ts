/**
 * GET  /api/trade-data — source status (UN Comtrade public preview, no key).
 * POST /api/trade-data — Korea's cosmetics exports by destination for the product's HS heading.
 *
 * Free and keyless. Same pipeline as /api/market-data: adapter → validation → Supabase (optional)
 * → computed findings with observation ids. Failures return an error, never substitute values.
 */
import { comtradeInfo, COMTRADE_DOCS_URL, COMTRADE_SOURCE_NAME, fetchKoreaExports, HS, MARKET_GROUPS, PARTNER_KO } from './_lib/adapters/unComtrade.js';
import { AdapterError } from './_lib/adapters/types.js';
import { hash, validateAll, type AiStatement, type Observation } from './_lib/observation.js';
import * as db from './_lib/supabase.js';

const SOURCE_ID = 'un-comtrade';
const HS_SHORT: Record<string, string> = { '3304': '기초·색조 화장품(HS 3304)', '3305': '헤어 제품(HS 3305)', '3307': '바디·향 제품(HS 3307)' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const TTL_MS = () => Math.max(1, Number(process.env.MARKET_DATA_CACHE_HOURS) || 24) * 3600_000;
const memory = new Map<string, { at: number; obs: Observation[]; years: number[]; calls: number; fetchedAt: string }>();

/** product category (Korean) → HS heading */
export function hsFor(category: string) {
  if (/헤어|샴푸|두피/.test(category)) return '3305';
  if (/바디|데오|입욕|향수|면도/.test(category)) return '3307';
  return '3304';
}

/** blueprint market labels → MARKET_GROUPS keys (한국 is the reporter, not a destination) */
export function marketKeys(labels: string[]) {
  const m: [RegExp, string][] = [[/미국|^USA?$/i, 'US'], [/중국|^CN$/i, 'CN'], [/일본|^JP$/i, 'JP'], [/영국|^(UK|GB)$/i, 'GB'], [/유럽|^EU$/i, 'EU'], [/동남아|^(ASEAN|SEA)$/i, 'ASEAN'], [/홍콩|^HK$/i, 'HK'], [/대만|^TW$/i, 'TW']];
  return [...new Set(labels.flatMap((l) => m.filter(([rx]) => rx.test(l)).map(([, k]) => k)))];
}

const meta = (hs: string) => ({
  id: SOURCE_ID,
  name: COMTRADE_SOURCE_NAME,
  url: COMTRADE_DOCS_URL,
  country: 'KR (보고국) → 수입국',
  unit: 'US$ (FOB, 연간 수출액)',
  hs,
  hsLabel: HS[hs] ?? `HS ${hs}`,
  definition: '한국 세관이 신고한 해당 HS 코드 품목의 국가별 연간 수출액입니다. 이 품목 전체의 수출액이며, 특정 제품 유형이나 브랜드 매출이 아닙니다.',
});

/** US$ in 억 달러 (100M) with one decimal, readable for Korean users */
export const fmtUsd = (n: number) => (n >= 1e8 ? `${(Math.round(n / 1e7) / 10).toLocaleString()}억 달러` : `${(Math.round(n / 1e5) / 10).toLocaleString()}백만 달러`);
const pct = (a: number, b: number) => Math.round(((a - b) / b) * 1000) / 10;

export function summarize(obs: Observation[], years: number[], keys: string[], item = '이 품목') {
  const [latest, prev] = years;
  const at = (y: number | undefined, code: number) => obs.find((o) => o.periodStart.startsWith(String(y)) && o.dimension === `partner:${code}`);
  const sum = (y: number | undefined, codes: number[]) => {
    const used = codes.map((c) => at(y, c)).filter((o): o is Observation => !!o);
    return { value: used.reduce((a, o) => a + o.metricValue, 0), used, missing: codes.length - used.length };
  };
  const world = at(latest, 0);
  const worldPrev = at(prev, 0);
  const statements: AiStatement[] = [];
  const gaps: string[] = [];
  let n = 0;
  const add = (text: string, used: Observation[]) => used.length && statements.push({ id: `t${++n}`, text, observationIds: [...new Set(used.map((o) => o.id))], dataType: 'COMPUTED' });

  if (!world) return { statements, gaps: ['수출 통계 데이터 부족'], markets: [], top: [], latest, prev };
  add(
    `${latest}년 한국의 ${item} 전체 수출액은 ${fmtUsd(world.metricValue)}${worldPrev ? `로, ${prev}년(${fmtUsd(worldPrev.metricValue)}) 대비 ${pct(world.metricValue, worldPrev.metricValue) >= 0 ? '+' : ''}${pct(world.metricValue, worldPrev.metricValue)}%입니다` : '입니다'}.`,
    [world, ...(worldPrev ? [worldPrev] : [])],
  );

  const ranked = obs
    .filter((o) => o.periodStart.startsWith(String(latest)) && o.dimension !== 'partner:0')
    .sort((a, b) => b.metricValue - a.metricValue);
  const top = ranked.slice(0, 10).map((o, i) => {
    const code = Number(o.dimension.slice(8));
    const p = at(prev, code);
    return { rank: i + 1, code, name: PARTNER_KO[code] ?? `국가코드 ${code}`, value: o.metricValue, share: Math.round((o.metricValue / world.metricValue) * 1000) / 10, change: p ? pct(o.metricValue, p.metricValue) : null, ids: [o.id, ...(p ? [p.id] : [])] };
  });
  if (top.length >= 3) add(`${latest}년 수출액 상위 국가는 ${top.slice(0, 5).map((t) => `${t.name} ${fmtUsd(t.value)}(${t.share}%)`).join(', ')}입니다.`, [world, ...ranked.slice(0, 5)]);

  const markets = keys.map((k) => {
    const g = MARKET_GROUPS[k];
    const cur = sum(latest, g.codes);
    const before = sum(prev, g.codes);
    const rank = g.codes.length === 1 ? ranked.findIndex((o) => o.dimension === `partner:${g.codes[0]}`) + 1 || null : null;
    const ok = cur.used.length > 0;
    const change = ok && before.used.length === cur.used.length && before.value > 0 ? pct(cur.value, before.value) : null;
    if (ok) {
      add(
        `${g.label}: ${latest}년 ${fmtUsd(cur.value)} (전체의 ${Math.round((cur.value / world.metricValue) * 1000) / 10}%${rank ? `, ${rank}위` : ''}${change !== null ? `, ${prev}년 대비 ${change >= 0 ? '+' : ''}${change}%` : ''})${cur.missing ? ` · ${g.codes.length}개국 중 ${cur.used.length}개국 값만 합산` : ''}.`,
        [world, ...cur.used, ...(change !== null ? before.used : [])],
      );
    } else gaps.push(`${g.label} 수출 데이터 부족`);
    return { key: k, label: g.label, value: ok ? cur.value : null, share: ok ? Math.round((cur.value / world.metricValue) * 1000) / 10 : null, rank, change, members: g.codes.length, reported: cur.used.length, ids: [...cur.used, ...before.used].map((o) => o.id) };
  });
  return { statements, gaps, markets, top, latest, prev };
}

export async function GET() {
  return json(200, { source: comtradeInfo(), storage: { supabase: db.supabaseConfigured() } });
}

export async function POST(request: Request) {
  let body: { category?: unknown; markets?: unknown; refresh?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: 'BAD_REQUEST', message: '요청 형식이 올바르지 않습니다.' });
  }
  const category = typeof body.category === 'string' ? body.category.slice(0, 30) : '';
  const labels = Array.isArray(body.markets) ? (body.markets as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 12) : [];
  const hs = hsFor(category);
  const keys = marketKeys(labels);
  const day = new Date().toISOString().slice(0, 10);
  const queryHash = hash(JSON.stringify([SOURCE_ID, hs, day.slice(0, 7)]));
  const warnings: string[] = [];

  let entry = body.refresh === true ? undefined : memory.get(queryHash);
  if (entry && Date.now() - entry.at > TTL_MS()) entry = undefined;
  let fromCache: 'memory' | 'database' | null = entry ? 'memory' : null;
  let storage: 'saved' | 'not_configured' | 'error' = db.supabaseConfigured() ? 'saved' : 'not_configured';

  if (!entry && db.supabaseConfigured() && body.refresh !== true) {
    const c = await db.loadCached(queryHash).catch(() => null);
    if (c && Date.now() - Date.parse(c.fetchedAt) < TTL_MS()) {
      const years = [...new Set(c.observations.map((o) => Number(o.periodStart.slice(0, 4))))].sort((a, b) => b - a);
      entry = { at: Date.now(), obs: c.observations, years, calls: 0, fetchedAt: c.fetchedAt };
      fromCache = 'database';
      memory.set(queryHash, entry);
    }
  }

  if (!entry) {
    try {
      const res = await fetchKoreaExports(hs, queryHash);
      const { valid, rejected } = validateAll(res.observations);
      if (rejected.length) warnings.push(`형식이 맞지 않는 값 ${rejected.length}개를 제외했습니다.`);
      entry = { at: Date.now(), obs: valid, years: res.years, calls: res.calls, fetchedAt: new Date().toISOString() };
      if (valid.length) memory.set(queryHash, entry);
      if (db.supabaseConfigured() && valid.length) {
        const q = { country: 'KR', category: HS[hs] ?? hs, categoryCode: hs, keywords: [], startDate: `${res.years.at(-1)}-01-01`, endDate: `${res.years[0]}-12-31`, timeUnit: 'month' as const };
        await db.saveObservations(SOURCE_ID, q, queryHash, valid).catch((e: Error) => {
          storage = 'error';
          warnings.push(`저장 실패: ${e.message}`);
        });
      }
    } catch (e) {
      const err = e instanceof AdapterError ? e : new AdapterError('UPSTREAM', '수출 통계를 가져오지 못했습니다.');
      return json(err.code === 'RATE_LIMIT' ? 429 : 502, { error: err.code, message: err.message, source: meta(hs) });
    }
  }

  const s = summarize(entry.obs, entry.years, keys, HS_SHORT[hs]);
  const cited = new Set([...s.statements.flatMap((x) => x.observationIds), ...s.markets.flatMap((m) => m.ids), ...s.top.flatMap((t) => t.ids)]);
  return json(200, {
    status: entry.obs.length ? 'OK' : 'NO_DATA',
    source: meta(hs),
    fetchedAt: entry.fetchedAt,
    fromCache,
    storage,
    calls: entry.calls,
    years: entry.years,
    unmatchedMarkets: labels.filter((l) => !marketKeys([l]).length && !/한국|대한민국|KR/.test(l)),
    ...s,
    // only the rows the summary cites, so the response stays small
    observations: entry.obs.filter((o) => cited.has(o.id)),
    warnings,
  });
}
