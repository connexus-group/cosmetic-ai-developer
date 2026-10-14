/**
 * GET  /api/market-data — which data sources are connected, storage and AI status.
 * POST /api/market-data — collect real market data for the user's category / keywords.
 *
 * Pipeline: External Data Source (adapter) → Server API (this file) → Data Validation
 *           → Supabase (store + cache) → Analysis Engine → JSON for the frontend charts.
 *
 * Environment variables (server only, never sent to the browser):
 *   NAVER_CLIENT_ID, NAVER_CLIENT_SECRET   required for Naver DataLab Shopping Insight
 *   NAVER_DATALAB_GATEWAY                  optional: openapi (default) | apihub
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY optional: storage + cache across requests
 *   MARKET_DATA_CACHE_HOURS                optional, default 24
 *   MARKET_AI_ANALYSIS=on + ANTHROPIC_API_KEY optional: AI interpretation sentences (billed per call; off by default)
 *
 * On failure this route answers with an error. It never substitutes demo or invented values.
 */
import { ADAPTERS, sourceStatus } from './_lib/adapters/index.js';
import { NAVER_COSMETICS_CATEGORY, NAVER_DOCS_URL, NAVER_EARLIEST, NAVER_METRICS, NAVER_SOURCE_NAME, NAVER_SOURCE_URL, NAVER_UNIT } from './_lib/adapters/naverShopping.js';
import { AdapterError, type MarketQuery } from './_lib/adapters/types.js';
import { aiAnalysisEnabled, aiNarrative, computeFindings } from './_lib/analysis.js';
import { hash, validateAll, type Observation } from './_lib/observation.js';
import * as db from './_lib/supabase.js';

const SOURCE_ID = 'naver-datalab-shopping';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const TTL_MS = () => Math.max(1, Number(process.env.MARKET_DATA_CACHE_HOURS) || 24) * 3600_000;

/** per-instance cache so repeated screens don't spend API quota; Supabase is the shared cache */
const memory = new Map<string, { at: number; payload: Record<string, unknown> }>();

interface Body {
  category: string;
  categoryCode: string;
  keywords: string[];
  months: number;
  timeUnit: MarketQuery['timeUnit'];
  idea?: string;
  refresh: boolean;
}

export function parseBody(raw: unknown): Body | string {
  if (!raw || typeof raw !== 'object') return '요청 형식이 올바르지 않습니다.';
  const b = raw as Record<string, unknown>;
  const category = typeof b.category === 'string' ? b.category.trim().slice(0, 30) : '';
  if (!category) return '제품 카테고리를 입력하세요.';
  const categoryCode = typeof b.categoryCode === 'string' && b.categoryCode.trim() ? b.categoryCode.trim() : NAVER_COSMETICS_CATEGORY;
  if (!/^\d{8}$/.test(categoryCode)) return '네이버 쇼핑 분야 코드는 8자리 숫자입니다 (예: 50000002).';
  const keywords = Array.isArray(b.keywords)
    ? [...new Set((b.keywords as unknown[]).filter((k): k is string => typeof k === 'string').map((k) => k.trim().replace(/\s+/g, ' ')).filter((k) => k.length > 0 && k.length <= 40))]
    : [];
  if (keywords.length > 5) return '키워드는 한 번에 5개까지 비교할 수 있습니다.';
  const months = Math.min(36, Math.max(3, Math.round(Number(b.months) || 12)));
  const timeUnit = b.timeUnit === 'week' || b.timeUnit === 'date' ? b.timeUnit : 'month';
  const idea = typeof b.idea === 'string' ? b.idea.slice(0, 1000) : undefined;
  return { category, categoryCode, keywords, months, timeUnit, idea, refresh: b.refresh === true };
}

/** End at the last complete period (yesterday, or last month for monthly data) and go back N months. */
export function periodFor(months: number, today = new Date(), timeUnit: MarketQuery['timeUnit'] = 'month') {
  // Monthly data ends at the last complete month, so a partial month never looks like a drop.
  const end = timeUnit === 'month' ? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months + 1, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(start) < NAVER_EARLIEST ? NAVER_EARLIEST : iso(start), endDate: iso(end) };
}

const sourceMeta = () => ({
  id: SOURCE_ID,
  name: NAVER_SOURCE_NAME,
  url: NAVER_SOURCE_URL,
  docsUrl: NAVER_DOCS_URL,
  country: 'KR',
  unit: NAVER_UNIT,
  metrics: NAVER_METRICS,
  caution: '모든 값은 검색 후 클릭 상대지표입니다. 판매량, 매출, 시장 규모, 점유율이 아니며, 다른 조회의 값과 비교할 수 없습니다.',
});

export async function GET() {
  return json(200, {
    sources: sourceStatus(),
    storage: { supabase: db.supabaseConfigured() },
    ai: { configured: aiAnalysisEnabled() },
    source: sourceMeta(),
  });
}

async function analyze(obs: Observation[], q: MarketQuery, idea: string | undefined, queryHash: string) {
  const findings = computeFindings(obs, q.keywords, q.category);
  const narrative = await aiNarrative(obs, findings, { category: q.category, keywords: q.keywords, idea });
  if (db.supabaseConfigured() && narrative.status === 'OK' && narrative.model) {
    await db.saveAnalysis(queryHash, narrative.model, [...findings.statements, ...narrative.statements]).catch(() => undefined);
  }
  return { findings, narrative };
}

export async function POST(request: Request) {
  let parsed: Body | string;
  try {
    parsed = parseBody(await request.json());
  } catch {
    parsed = '요청 형식이 올바르지 않습니다.';
  }
  if (typeof parsed === 'string') return json(400, { error: 'BAD_REQUEST', message: parsed });

  const adapter = ADAPTERS[SOURCE_ID];
  if (adapter.info().status !== 'connected') {
    return json(503, { error: 'NOT_CONFIGURED', message: '네이버 데이터랩 API Key(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)가 서버 환경변수에 설정되지 않았습니다.', source: sourceMeta() });
  }

  const q: MarketQuery = { country: 'KR', category: parsed.category, categoryCode: parsed.categoryCode, keywords: parsed.keywords, timeUnit: parsed.timeUnit, ...periodFor(parsed.months, new Date(), parsed.timeUnit) };
  const queryHash = hash(JSON.stringify([SOURCE_ID, q.categoryCode, q.keywords, q.startDate, q.endDate, q.timeUnit]));
  const base = { source: sourceMeta(), query: q, queryHash };

  const hit = memory.get(queryHash);
  if (!parsed.refresh && hit && Date.now() - hit.at < TTL_MS()) return json(200, { ...hit.payload, fromCache: 'memory' });

  const warnings: string[] = [];
  let cached: Awaited<ReturnType<typeof db.loadCached>> = null;
  if (db.supabaseConfigured()) {
    cached = await db.loadCached(queryHash).catch((e: Error) => {
      warnings.push(`저장소 조회 실패: ${e.message}`);
      return null;
    });
    if (!parsed.refresh && cached && Date.now() - Date.parse(cached.fetchedAt) < TTL_MS()) {
      const payload = { status: 'OK', ...base, fetchedAt: cached.fetchedAt, stale: false, observations: cached.observations, rejected: 0, calls: 0, storage: 'saved', warnings, ...(await analyze(cached.observations, q, parsed.idea, queryHash)) };
      memory.set(queryHash, { at: Date.now(), payload });
      return json(200, { ...payload, fromCache: 'database' });
    }
  }

  try {
    const res = await adapter.fetch(q, queryHash);
    const { valid, rejected } = validateAll(res.observations);
    warnings.push(...res.warnings);
    if (rejected.length) warnings.push(`형식이 맞지 않는 값 ${rejected.length}개를 제외했습니다.`);
    let storage: 'saved' | 'not_configured' | 'error' = 'not_configured';
    if (db.supabaseConfigured()) {
      storage = await db
        .saveObservations(SOURCE_ID, q, queryHash, valid)
        .then(() => 'saved' as const)
        .catch((e: Error) => {
          warnings.push(`저장 실패: ${e.message}`);
          return 'error' as const;
        });
    }
    const payload = { status: valid.length ? 'OK' : 'NO_DATA', ...base, fetchedAt: new Date().toISOString(), stale: false, observations: valid, rejected: rejected.length, calls: res.calls, storage, warnings, ...(await analyze(valid, q, parsed.idea, queryHash)) };
    if (valid.length) memory.set(queryHash, { at: Date.now(), payload });
    return json(200, { ...payload, fromCache: null });
  } catch (e) {
    const err = e instanceof AdapterError ? e : new AdapterError('UPSTREAM', '데이터 수집 중 오류가 발생했습니다.');
    if (db.supabaseConfigured()) await db.logFailure(SOURCE_ID, q, queryHash, err.code, err.message).catch(() => undefined);
    // An older real collection of the same query is still real data: return it, marked stale.
    if (cached && err.code !== 'AUTH' && err.code !== 'BAD_REQUEST') {
      return json(200, { status: 'OK', ...base, fetchedAt: cached.fetchedAt, stale: true, error: err.code, message: err.message, observations: cached.observations, rejected: 0, calls: 0, storage: 'saved', warnings, fromCache: 'database', ...(await analyze(cached.observations, q, parsed.idea, queryHash)) });
    }
    const status = err.code === 'RATE_LIMIT' ? 429 : err.code === 'BAD_REQUEST' ? 400 : err.code === 'NOT_CONFIGURED' ? 503 : 502;
    return json(status, { error: err.code, message: err.message, ...base });
  }
}
