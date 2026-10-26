/**
 * Packaging Studio API (one route, several actions, to stay within the Vercel Hobby function limit).
 *
 * GET  /api/packaging                      → which services are connected (no secrets, no external calls)
 * POST /api/packaging { action: 'design' }     → 3 design directions (Claude). 503 NO_API_KEY → the site uses its labeled demo rules
 * POST /api/packaging { action: 'references' } → real packaging references (Firecrawl image search), image URLs checked
 * POST /api/packaging { action: 'page' }       → images + brand / product name from one official product page (Firecrawl scrape)
 * POST /api/packaging { action: 'mockup' }     → one AI Concept Mockup (Cloudflare Workers AI, FLUX.1 schnell)
 *
 * Rules: nothing is shown as an image unless the image address answered with an image; terms-blocked
 * malls, stock photo sites and robots-disallowed pages are excluded; image files of references are never
 * copied or stored (address + source only); generated images are always labeled "AI Concept Mockup".
 */
import Anthropic from '@anthropic-ai/sdk';
import { firecrawlConfigured, PAGE_IMAGE_CREDITS, scrapePageImages, searchCredits, searchImages, type ImageHit } from './_lib/adapters/firecrawl.js';
import { cloudflareConfigured, generateImage, imageGenAdapters, takeQuota } from './_lib/adapters/imageGen.js';
import { AdapterError } from './_lib/adapters/types.js';
import { hash } from './_lib/observation.js';
import { checkImage, DESIGN_SCHEMA, DESIGN_SYSTEM, designPrompt, excludedHost, guessKind, mockupPrompt, parseInputs, parseMockup, referenceQueries, sanitizeDirections, siteOf } from './_lib/packaging.js';
import { checkAccess } from './_lib/robots.js';
import * as db from './_lib/supabase.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const CACHE_MS = () => Math.max(1, Number(process.env.COMPETITOR_CACHE_HOURS) || 24) * 3600_000;
const SEARCH_LIMIT = 10;

function adapterError(e: unknown, fallback: string) {
  const err = e instanceof AdapterError ? e : new AdapterError('UPSTREAM', fallback);
  const status = err.code === 'QUOTA' ? 402 : err.code === 'AUTH' ? 401 : err.code === 'NOT_CONFIGURED' ? 503 : err.code === 'RATE_LIMIT' ? 429 : 502;
  return json(status, { error: err.code, message: err.message });
}

export async function GET() {
  return json(200, {
    ai: { configured: !!process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_API_KEY ? MODEL : null },
    firecrawl: { configured: firecrawlConfigured(), costs: { perImageSearch10: searchCredits(SEARCH_LIMIT), perPage: PAGE_IMAGE_CREDITS } },
    imageGen: { configured: cloudflareConfigured(), adapters: imageGenAdapters() },
    storage: { supabase: db.supabaseConfigured() },
  });
}

export async function POST(request: Request) {
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'BAD_REQUEST', message: '요청 형식이 올바르지 않습니다.' });
  }
  switch (raw.action) {
    case 'design':
      return design(raw);
    case 'references':
      return references(raw);
    case 'page':
      return page(raw);
    case 'mockup':
      return mockup(raw);
    default:
      return json(400, { error: 'BAD_REQUEST', message: '알 수 없는 요청입니다.' });
  }
}

// ── design directions ────────────────────────────────────────────────────────

async function design(raw: Record<string, unknown>) {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'NO_API_KEY', message: 'ANTHROPIC_API_KEY가 서버 환경변수에 설정되지 않았습니다.' });
  const inputs = parseInputs(raw.inputs);
  const client = new Anthropic();
  try {
    const message = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: DESIGN_SCHEMA as unknown as Record<string, unknown> } },
        system: DESIGN_SYSTEM,
        messages: [{ role: 'user', content: designPrompt(inputs) }],
      })
      .finalMessage();
    if (message.stop_reason === 'refusal') return json(502, { error: 'REFUSAL', message: 'AI가 이 요청에 답하지 않았습니다.' });
    if (message.stop_reason === 'max_tokens') return json(502, { error: 'TRUNCATED', message: 'AI 응답이 길어 중간에 끊겼습니다.' });
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    const directions = sanitizeDirections(JSON.parse(text));
    if (directions.length < 3) return json(502, { error: 'BAD_OUTPUT', message: 'AI가 디자인 방향 3개를 모두 만들지 못했습니다.' });
    return json(200, { mode: 'ai', model: message.model, directions });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json(502, { error: 'AUTH', message: 'API Key가 올바르지 않습니다.' });
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: 'RATE_LIMIT', message: '요청이 많아 잠시 후 다시 시도해야 합니다.' });
    if (err instanceof Anthropic.APIError) return json(502, { error: 'API_ERROR', message: `AI API 오류 (${err.status ?? 'network'})` });
    if (err instanceof SyntaxError) return json(502, { error: 'BAD_OUTPUT', message: 'AI 응답을 구조화 데이터로 읽지 못했습니다.' });
    return json(500, { error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' });
  }
}

// ── reference library ────────────────────────────────────────────────────────

interface Reference {
  id: string;
  imageUrl: string | null;
  pageUrl: string;
  site: string;
  title: string;
  brand: string | null;
  productName: string | null;
  kind: 'container' | 'carton' | 'set' | 'unknown';
  width: number | null;
  height: number | null;
  /** how the image was obtained */
  via: 'image-search' | 'page';
  imageStatus: 'ok' | 'failed' | 'none';
  imageNote: string | null;
  features: string[];
  featuresBasis: 'page-text' | null;
  source: string;
  query: string | null;
  collectedAt: string;
}

async function references(raw: Record<string, unknown>) {
  if (!firecrawlConfigured()) return json(503, { error: 'NOT_CONFIGURED', message: 'FIRECRAWL_API_KEY가 서버 환경변수에 설정되지 않았습니다.' });
  const inputs = parseInputs(raw.inputs);
  const dir = raw.direction && typeof raw.direction === 'object' ? (raw.direction as { name?: string; container?: string; imagePrompt?: string }) : null;
  const given = Array.isArray(raw.queries) ? raw.queries.filter((q): q is string => typeof q === 'string').map((q) => q.trim().slice(0, 120)).filter((q) => q.length >= 2) : [];
  const queries = [...new Set(given.length ? given : referenceQueries(inputs, dir))].slice(0, 2);
  const refresh = raw.refresh === true;

  const hits: (ImageHit & { query: string; searchedAt: string })[] = [];
  const runs: { query: string; fromCache: boolean; results: number; credits: number; searchedAt: string }[] = [];
  const warnings: string[] = [];
  let credits = 0;
  for (const query of queries) {
    const qh = hash(JSON.stringify(['img', query.toLowerCase(), SEARCH_LIMIT]));
    if (!refresh && db.supabaseConfigured()) {
      const prev = await db.loadReferenceSearch(qh).catch(() => null);
      if (prev && Date.now() - Date.parse(prev.created_at) < CACHE_MS() && Array.isArray(prev.results)) {
        const list = prev.results as ImageHit[];
        hits.push(...list.map((h) => ({ ...h, query, searchedAt: prev.created_at })));
        runs.push({ query, fromCache: true, results: list.length, credits: 0, searchedAt: prev.created_at });
        continue;
      }
    }
    try {
      const list = await searchImages(query, { limit: SEARCH_LIMIT });
      const cost = searchCredits(SEARCH_LIMIT);
      credits += cost;
      const searchedAt = new Date().toISOString();
      hits.push(...list.map((h) => ({ ...h, query, searchedAt })));
      runs.push({ query, fromCache: false, results: list.length, credits: cost, searchedAt });
      if (db.supabaseConfigured()) {
        await db.logUsage('search', cost, `packaging: ${query}`).catch(() => undefined);
        await db.saveReferenceSearch({ query_hash: qh, query, results: list, credits: cost }).catch((e: Error) => warnings.push(`검색 결과 저장 실패: ${e.message}`));
      }
    } catch (e) {
      const err = e instanceof AdapterError ? e : null;
      if (err && ['AUTH', 'QUOTA', 'NOT_CONFIGURED'].includes(err.code)) return adapterError(err, '');
      warnings.push(`"${query}" 검색 실패: ${(e as Error).message}`);
    }
  }

  const seen = new Set<string>();
  const excluded: { pageUrl: string; reason: string }[] = [];
  const kept: (ImageHit & { query: string; searchedAt: string })[] = [];
  for (const h of hits) {
    if (seen.has(h.imageUrl)) continue;
    seen.add(h.imageUrl);
    let why: string | null = null;
    try {
      why = excludedHost(new URL(h.pageUrl).hostname) ?? excludedHost(new URL(h.imageUrl).hostname);
    } catch {
      why = '잘못된 주소';
    }
    if (why) excluded.push({ pageUrl: h.pageUrl, reason: why });
    else kept.push(h);
  }

  // robots.txt of the source page + does the image address really return an image? (both free)
  const top = kept.slice(0, 14);
  const out: Reference[] = [];
  await Promise.all(
    top.map(async (h) => {
      const access = await checkAccess(h.pageUrl);
      if (!access.allowed) {
        excluded.push({ pageUrl: h.pageUrl, reason: access.reason });
        return;
      }
      const img = await checkImage(h.imageUrl);
      out.push({
        id: hash(h.imageUrl).slice(0, 16),
        imageUrl: img.ok ? h.imageUrl : null,
        pageUrl: h.pageUrl,
        site: siteOf(h.pageUrl),
        title: h.title,
        brand: null,
        productName: null,
        kind: guessKind(h.title),
        width: h.width,
        height: h.height,
        via: 'image-search',
        imageStatus: img.ok ? 'ok' : 'failed',
        imageNote: img.ok ? null : img.reason,
        features: [],
        featuresBasis: null,
        source: 'Firecrawl 이미지 검색',
        query: h.query,
        collectedAt: h.searchedAt,
      });
    }),
  );
  out.sort((a, b) => Number(b.imageStatus === 'ok') - Number(a.imageStatus === 'ok'));
  return json(200, { queries, runs, creditsUsed: credits, references: out, excluded: excluded.slice(0, 30), unchecked: Math.max(0, kept.length - top.length), warnings });
}

/** keep a phrase only when the same text is printed on the page */
const grounded = (text: string, markdown: string) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length >= 2 && markdown.replace(/\s+/g, ' ').toLowerCase().includes(t.toLowerCase()) ? t : null;
};

async function page(raw: Record<string, unknown>) {
  if (!firecrawlConfigured()) return json(503, { error: 'NOT_CONFIGURED', message: 'FIRECRAWL_API_KEY가 서버 환경변수에 설정되지 않았습니다.' });
  let url: URL;
  try {
    url = new URL(String(raw.url ?? ''));
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch {
    return json(400, { error: 'BAD_REQUEST', message: '올바른 페이지 주소(https://…)를 입력하세요.' });
  }
  const why = excludedHost(url.hostname);
  if (why) return json(422, { error: 'EXCLUDED', message: `${why}: 레퍼런스로 수집하지 않습니다.` });
  const access = await checkAccess(url.toString());
  if (!access.allowed) return json(422, { error: 'ROBOTS', message: access.reason });

  try {
    const p = await scrapePageImages(url.toString());
    if (db.supabaseConfigured()) await db.logUsage('scrape', PAGE_IMAGE_CREDITS, `packaging page: ${url}`).catch(() => undefined);
    const j = p.json ?? {};
    const brand = grounded(String(j.brand ?? ''), p.markdown);
    const productName = grounded(String(j.product_name ?? ''), p.markdown);
    const features = (Array.isArray(j.packaging_text) ? j.packaging_text : []).map((x) => grounded(String(x), p.markdown)).filter((x): x is string => !!x).slice(0, 5);
    // og:image first, then large-looking product images from the page; skip icons, logos, tracking pixels
    const candidates = [...new Set([p.ogImage, ...p.images].filter((x): x is string => !!x))].filter((u) => !/\.svg(\?|$)|sprite|icon|logo|favicon|pixel|1x1|blank\.gif/i.test(u)).slice(0, 8);
    const checked = await Promise.all(candidates.map(async (u) => ({ u, r: await checkImage(u) })));
    const now = new Date().toISOString();
    const refs: Reference[] = checked
      .filter((c) => c.r.ok)
      .slice(0, 6)
      .map((c, i) => ({
        id: hash(c.u).slice(0, 16),
        imageUrl: c.u,
        pageUrl: url.toString(),
        site: siteOf(url.toString()),
        title: p.title ?? '',
        brand,
        productName,
        kind: 'unknown' as const,
        width: null,
        height: null,
        via: 'page' as const,
        imageStatus: 'ok' as const,
        imageNote: i === 0 && c.u === p.ogImage ? '페이지 대표 이미지 (og:image)' : null,
        features,
        featuresBasis: features.length ? ('page-text' as const) : null,
        source: 'Firecrawl 공식 페이지 수집',
        query: null,
        collectedAt: now,
      }));
    if (!refs.length)
      refs.push({ id: hash(url.toString()).slice(0, 16), imageUrl: null, pageUrl: url.toString(), site: siteOf(url.toString()), title: p.title ?? '', brand, productName, kind: 'unknown', width: null, height: null, via: 'page', imageStatus: 'none', imageNote: '페이지에서 확인된 이미지 없음 · 텍스트만 확보', features, featuresBasis: features.length ? 'page-text' : null, source: 'Firecrawl 공식 페이지 수집', query: null, collectedAt: now });
    return json(200, { references: refs, creditsUsed: PAGE_IMAGE_CREDITS, robots: access.note });
  } catch (e) {
    return adapterError(e, '페이지를 수집하지 못했습니다.');
  }
}

// ── AI concept mockup ────────────────────────────────────────────────────────

async function mockup(raw: Record<string, unknown>) {
  if (!cloudflareConfigured()) return json(503, { error: 'NOT_CONFIGURED', message: '이미지 생성 API(Cloudflare Workers AI)가 연결되지 않았습니다. 생성 기능은 작동하지 않습니다.' });
  const req = parseMockup(raw.options);
  if (!req) return json(400, { error: 'BAD_REQUEST', message: '시안 종류가 올바르지 않습니다.' });
  if (!takeQuota()) return json(429, { error: 'DAILY_CAP', message: '오늘 이 사이트에서 생성할 수 있는 시안 수를 모두 사용했습니다. 내일 다시 생성하세요.' });
  const prompt = mockupPrompt(req);
  try {
    const img = await generateImage(prompt, { seed: Number(raw.seed) > 0 ? Math.round(Number(raw.seed)) : undefined });
    const id = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const projectId = String(raw.projectId ?? '').replace(/[^a-z0-9-]/gi, '').slice(0, 60) || 'unknown';
    let stored: 'supabase' | 'none' = 'none';
    let storageError: string | null = null;
    if (db.supabaseConfigured()) {
      try {
        const path = await db.uploadMockup(`${projectId}/${id}.jpg`, Uint8Array.from(Buffer.from(img.base64, 'base64')), img.mime);
        await db.saveMockup({ id, project_id: projectId, kind: req.kind, provider: img.provider, model: img.model, prompt, options: req, storage_path: path });
        stored = 'supabase';
      } catch (e) {
        storageError = (e as Error).message.slice(0, 200);
      }
    }
    return json(200, { id, kind: req.kind, prompt, provider: img.provider, model: img.model, mime: img.mime, image: img.base64, stored, storageError, createdAt: new Date().toISOString() });
  } catch (e) {
    return adapterError(e, '이미지를 생성하지 못했습니다.');
  }
}
