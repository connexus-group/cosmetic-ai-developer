/**
 * GET  /api/competitor-discovery — connection status, credit costs and credits recorded this month.
 * POST /api/competitor-discovery { attributes, market, queries?, limit?, refresh? } — find competitor candidates.
 *
 * Pipeline: idea attributes (from the project; no AI call) → search queries → Firecrawl /v2/search
 *           → filter (terms-blocked malls, non-seller sites, non-product URLs) → robots.txt check
 *           → rule-based relevance estimate → candidate list for the user to pick from.
 *
 * Nothing is scraped here. Collecting the picked candidates goes through /api/competitor-products,
 * which repeats the robots check, reuses Supabase within 24h and stops on an exhausted credit balance.
 */
import { CREDITS_PER_PAGE, firecrawlConfigured, searchCredits, searchWeb, type SearchHit } from './_lib/adapters/firecrawl.js';
import { AdapterError } from './_lib/adapters/types.js';
import { buildQueries, LOCATION, parseAttributes, toCandidates, type Candidate } from './_lib/discovery.js';
import { hash } from './_lib/observation.js';
import { checkAccess } from './_lib/robots.js';
import * as db from './_lib/supabase.js';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const CACHE_MS = () => Math.max(1, Number(process.env.COMPETITOR_CACHE_HOURS) || 24) * 3600_000;
const MAX_QUERIES = 3;
const MAX_LIMIT = 10;
/** robots.txt is only checked for the best candidates, to keep the request short */
const ROBOTS_CHECK = 12;

export async function GET() {
  let usage: Awaited<ReturnType<typeof db.usageThisMonth>> | null = null;
  let usageError: string | null = null;
  if (db.supabaseConfigured()) {
    usage = await db.usageThisMonth().catch((e: Error) => {
      usageError = e.message;
      return null;
    });
  }
  return json(200, {
    firecrawl: { configured: firecrawlConfigured() },
    storage: { supabase: db.supabaseConfigured() },
    costs: { perSearch10: searchCredits(10), perProduct: CREDITS_PER_PAGE, freeMonthly: 1000 },
    usage,
    usageError,
    locations: LOCATION,
  });
}

export async function POST(request: Request) {
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'BAD_REQUEST', message: '요청 형식이 올바르지 않습니다.' });
  }
  if (!firecrawlConfigured()) return json(503, { error: 'NOT_CONFIGURED', message: 'FIRECRAWL_API_KEY가 서버 환경변수에 설정되지 않았습니다.' });

  const attrs = parseAttributes(raw.attributes);
  const market = typeof raw.market === 'string' && LOCATION[raw.market.toUpperCase()] ? raw.market.toUpperCase() : attrs.markets[0] && LOCATION[attrs.markets[0]] ? attrs.markets[0] : 'KR';
  const given = Array.isArray(raw.queries) ? raw.queries.filter((q): q is string => typeof q === 'string').map((q) => q.trim().slice(0, 120)).filter((q) => q.length >= 2) : [];
  const queries = [...new Set(given.length ? given : buildQueries(attrs, market))].slice(0, MAX_QUERIES);
  if (!queries.length) return json(400, { error: 'BAD_REQUEST', message: '검색어를 만들 수 없습니다. 제품 유형이나 효능을 입력하세요.' });
  const limit = Math.min(MAX_LIMIT, Math.max(3, Math.round(Number(raw.limit) || MAX_LIMIT)));
  const location = LOCATION[market];
  const refresh = raw.refresh === true;

  const hits: (SearchHit & { query: string })[] = [];
  const runs: { query: string; fromCache: boolean; results: number; credits: number; searchedAt: string }[] = [];
  const warnings: string[] = [];
  let credits = 0;
  for (const query of queries) {
    const qh = hash(JSON.stringify([query.toLowerCase(), location, limit]));
    if (!refresh && db.supabaseConfigured()) {
      const prev = await db.loadSearch(qh).catch(() => null);
      if (prev && Date.now() - Date.parse(prev.created_at) < CACHE_MS() && Array.isArray(prev.results)) {
        const list = prev.results as SearchHit[];
        hits.push(...list.map((h) => ({ ...h, query })));
        runs.push({ query, fromCache: true, results: list.length, credits: 0, searchedAt: prev.created_at });
        continue;
      }
    }
    try {
      const list = await searchWeb(query, { limit, location });
      const cost = searchCredits(limit);
      credits += cost;
      hits.push(...list.map((h) => ({ ...h, query })));
      const searchedAt = new Date().toISOString();
      runs.push({ query, fromCache: false, results: list.length, credits: cost, searchedAt });
      if (db.supabaseConfigured()) {
        await db.logUsage('search', cost, query).catch(() => undefined);
        await db.saveSearch({ query_hash: qh, query, location, attributes: attrs, results: list, credits: cost }).catch((e: Error) => warnings.push(`검색 결과 저장 실패: ${e.message}`));
      }
    } catch (e) {
      const err = e instanceof AdapterError ? e : new AdapterError('UPSTREAM', '검색 중 오류가 발생했습니다.');
      if (err.code === 'AUTH' || err.code === 'QUOTA' || err.code === 'NOT_CONFIGURED') {
        const status = err.code === 'QUOTA' ? 402 : err.code === 'AUTH' ? 401 : 503;
        return json(status, { error: err.code, message: err.message, runs, creditsUsed: credits });
      }
      warnings.push(`"${query}" 검색 실패: ${err.message}`);
    }
  }

  const candidates: (Candidate & { robots?: string })[] = toCandidates(hits, attrs, market);
  // robots.txt check (free) for the best candidates that passed the filters
  const top = candidates.filter((c) => !c.excluded).slice(0, ROBOTS_CHECK);
  await Promise.all(
    top.map(async (c) => {
      const v = await checkAccess(c.url);
      if (!v.allowed) c.excluded = v.reason;
      else c.robots = v.note;
    }),
  );
  const ordered = [...candidates].sort((x, y) => Number(!!x.excluded) - Number(!!y.excluded) || y.score - x.score);
  const allowed = ordered.filter((c) => !c.excluded);

  return json(200, {
    market,
    location,
    queries,
    runs,
    creditsUsed: credits,
    candidates: ordered.slice(0, 30),
    allowedCount: allowed.length,
    unchecked: Math.max(0, candidates.filter((c) => !c.excluded).length - ROBOTS_CHECK),
    scoreNote: '관련성 점수는 검색 결과 제목·설명과 아이디어 속성(유형·효능·원료·타깃·국가)의 일치 여부로 계산한 규칙 기반 추정값입니다. 시장점유율이나 판매 순위가 아닙니다.',
    warnings,
  });
}
