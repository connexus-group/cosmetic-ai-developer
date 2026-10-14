/**
 * GET  /api/competitor-products?urls=a,b  — Firecrawl / Supabase connection status, plus the stored products for those URLs.
 * POST /api/competitor-products { urls, refresh } — collect competitor product pages.
 *
 * Pipeline per URL: URL check → terms + robots.txt check → Firecrawl scrape → grounding validation
 *                   (product.ts) → Supabase competitor_products → JSON for the Competitors screen.
 *
 * Env (server only): FIRECRAWL_API_KEY (required), SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (storage),
 *                    COMPETITOR_CACHE_HOURS (default 24: a page collected within this window is not re-scraped).
 *
 * Nothing here ever returns demo or invented values. A field that is not on the page is null.
 */
import { CREDITS_PER_PAGE, FIRECRAWL_HOMEPAGE, firecrawlConfigured, scrapeProduct } from './_lib/adapters/firecrawl.js';
import { AdapterError } from './_lib/adapters/types.js';
import { hasData, normalizeUrl, productId, validateProduct, type CompetitorProduct } from './_lib/product.js';
import { checkAccess } from './_lib/robots.js';
import * as db from './_lib/supabase.js';

const MAX_URLS = 10;
const CONCURRENCY = 3;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const TTL_MS = () => Math.max(1, Number(process.env.COMPETITOR_CACHE_HOURS) || 24) * 3600_000;

export type ItemStatus = 'OK' | 'CACHED' | 'BLOCKED' | 'NO_DATA' | 'ERROR' | 'SKIPPED' | 'INVALID';
export interface ItemResult {
  url: string;
  status: ItemStatus;
  message?: string;
  code?: string;
  product?: CompetitorProduct;
  stored?: boolean;
}

const status = () => ({
  firecrawl: { configured: firecrawlConfigured(), homepage: FIRECRAWL_HOMEPAGE, creditsPerPage: CREDITS_PER_PAGE, env: ['FIRECRAWL_API_KEY'] },
  storage: { supabase: db.supabaseConfigured(), env: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] },
  cacheHours: TTL_MS() / 3600_000,
  maxUrls: MAX_URLS,
  // which deployment answered (Vercel system env, no secrets): helps when keys were added to another environment
  deployment: { environment: process.env.VERCEL_ENV ?? 'local', branch: process.env.VERCEL_GIT_COMMIT_REF ?? null, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null },
});

/** Public http(s) pages only: no credentials, no localhost / private network hosts. */
export function checkUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return 'URL 형식이 올바르지 않습니다.';
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'http(s) 주소만 수집할 수 있습니다.';
  if (u.username || u.password) return '로그인 정보가 들어간 주소는 수집하지 않습니다.';
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h.includes(':')) return '공개 웹사이트 주소만 수집할 수 있습니다.';
  return null;
}

function parseUrls(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,]+/) : [];
  return [...new Set(list.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))];
}

export async function GET(request: Request) {
  const urls = parseUrls(new URL(request.url).searchParams.get('urls') ?? '').filter((u) => !checkUrl(u)).slice(0, 50);
  let products: CompetitorProduct[] = [];
  let storageError: string | null = null;
  if (urls.length && db.supabaseConfigured()) {
    products = await db.loadProducts(urls.map(productId)).catch((e: Error) => {
      storageError = e.message;
      return [];
    });
  }
  const storageCheck = db.supabaseConfigured() ? await db.pingProducts() : null;
  return json(200, { ...status(), storageCheck, products, storageError });
}

async function collectOne(url: string, refresh: boolean, stop: { code: string; message: string } | null): Promise<ItemResult> {
  const bad = checkUrl(url);
  if (bad) return { url, status: 'INVALID', message: bad };
  const clean = normalizeUrl(url);
  if (stop) return { url: clean, status: 'SKIPPED', code: stop.code, message: stop.message };

  if (!refresh && db.supabaseConfigured()) {
    const [prev] = await db.loadProducts([productId(clean)]).catch(() => []);
    if (prev && Date.now() - Date.parse(prev.collectedAt) < TTL_MS()) return { url: clean, status: 'CACHED', product: prev, stored: true, message: '최근 수집 결과를 다시 사용했습니다 (크레딧 사용 없음).' };
  }

  const access = await checkAccess(clean);
  if (!access.allowed) {
    if (db.supabaseConfigured()) await db.logProductAttempt(clean, 'BLOCKED', access.reason).catch(() => undefined);
    return { url: clean, status: 'BLOCKED', message: access.reason };
  }

  const scrape = await scrapeProduct(clean); // AdapterError propagates to the caller
  const product = validateProduct(clean, scrape, access.robotsUrl);
  if (!hasData(product)) {
    if (db.supabaseConfigured()) await db.logProductAttempt(clean, 'NO_DATA', null).catch(() => undefined);
    return { url: clean, status: 'NO_DATA', message: '페이지 본문에서 제품명·가격·용량·성분을 찾지 못했습니다. 저장하지 않았습니다.' };
  }
  let stored = false;
  let message: string | undefined;
  if (db.supabaseConfigured()) {
    try {
      await db.saveProducts([product]);
      stored = true;
      await db.logProductAttempt(clean, 'OK', null).catch(() => undefined);
    } catch (e) {
      message = `Supabase 저장 실패: ${(e as Error).message}`;
    }
  } else message = 'Supabase가 연결되지 않아 저장하지 않았습니다.';
  return { url: clean, status: 'OK', product, stored, message };
}

export async function POST(request: Request) {
  let raw: Record<string, unknown> = {};
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'BAD_REQUEST', message: '요청 형식이 올바르지 않습니다.' });
  }
  const urls = parseUrls(raw.urls);
  if (!urls.length) return json(400, { error: 'BAD_REQUEST', message: '수집할 제품 페이지 URL을 입력하세요.' });
  if (urls.length > MAX_URLS) return json(400, { error: 'BAD_REQUEST', message: `한 번에 ${MAX_URLS}개 URL까지 수집할 수 있습니다.` });
  if (!firecrawlConfigured()) return json(503, { error: 'NOT_CONFIGURED', message: 'FIRECRAWL_API_KEY가 서버 환경변수에 설정되지 않았습니다.', ...status() });

  const refresh = raw.refresh === true;
  const results: ItemResult[] = new Array(urls.length);
  // AUTH / QUOTA stop the remaining pages so a bad key or empty credit balance is not hit repeatedly
  let stop: { code: string; message: string } | null = null;
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      try {
        results[i] = await collectOne(urls[i], refresh, stop);
      } catch (e) {
        const err = e instanceof AdapterError ? e : new AdapterError('UPSTREAM', '수집 중 오류가 발생했습니다.');
        if (err.code === 'AUTH' || err.code === 'QUOTA' || err.code === 'NOT_CONFIGURED') stop = { code: err.code, message: err.message };
        if (db.supabaseConfigured()) await db.logProductAttempt(urls[i], err.code, err.message).catch(() => undefined);
        results[i] = { url: urls[i], status: 'ERROR', code: err.code, message: err.message };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

  const scraped = results.filter((r) => r.status === 'OK' || r.status === 'NO_DATA').length;
  return json(200, { ...status(), collectedAt: new Date().toISOString(), results, creditsUsedEstimate: scraped * CREDITS_PER_PAGE });
}
