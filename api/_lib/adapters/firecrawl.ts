/**
 * Firecrawl (https://www.firecrawl.dev) · scrapes one public product page and returns its
 * markdown plus an LLM extraction of name / brand / price / volume / ingredients.
 *
 * The extraction is only a candidate: `product.ts` keeps a value only when the same text is
 * found in the page markdown, so nothing the extractor invents can be stored as collected data.
 *
 * Env: FIRECRAWL_API_KEY (required). FIRECRAWL_BASE_URL (tests only, default https://api.firecrawl.dev).
 * Cost: free plan = 1,000 credits / month, no card; this call uses markdown + JSON = 5 credits per page.
 * When the monthly credits run out Firecrawl answers 402 and stops; there is no overage charge.
 */
import { AdapterError, type AdapterInfo } from './types.js';

export const http = { fetch: (url: string, init: RequestInit) => fetch(url, init) };

export const FIRECRAWL_SOURCE_NAME = 'Firecrawl (공개 제품 페이지 수집)';
export const FIRECRAWL_HOMEPAGE = 'https://www.firecrawl.dev';
export const CREDITS_PER_PAGE = 5;

const key = () => process.env.FIRECRAWL_API_KEY?.trim() || '';
const base = () => (process.env.FIRECRAWL_BASE_URL?.trim() || 'https://api.firecrawl.dev').replace(/\/+$/, '');
export const firecrawlConfigured = () => key().length > 0;

export function firecrawlInfo(): AdapterInfo {
  return {
    id: 'firecrawl-products',
    name: 'Firecrawl · 공개 제품 페이지',
    homepage: FIRECRAWL_HOMEPAGE,
    status: firecrawlConfigured() ? 'connected' : 'not_configured',
    description: '경쟁제품 공식 페이지의 제품명·가격·용량·전성분 (robots.txt 허용 페이지만)',
    env: ['FIRECRAWL_API_KEY'],
    costNote: `무료 플랜 월 1,000 크레딧, 카드 불필요. 제품 1개 ${CREDITS_PER_PAGE} 크레딧. 소진 시 수집이 멈추고 추가 과금 없음`,
  };
}

/** What we ask the extractor for. `*_text` fields must be copied exactly as printed so they can be checked against the page. */
export const PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    product_name: { type: 'string', description: 'Product name exactly as printed on the page' },
    brand: { type: 'string', description: 'Brand name exactly as printed on the page' },
    price_text: { type: 'string', description: 'The current selling price exactly as printed, including currency symbol or unit (e.g. "25,000원", "$18.00"). Empty if not shown.' },
    currency: { type: 'string', description: 'ISO currency code of price_text, e.g. KRW, USD' },
    volume_text: { type: 'string', description: 'Product size exactly as printed (e.g. "50ml", "150 mL", "1.69 fl oz"). Empty if not shown.' },
    ingredients: { type: 'array', items: { type: 'string' }, description: 'Full ingredient list (전성분 / INCI) in printed order, each ingredient copied exactly as printed. Empty array if the page does not show it as text.' },
    regular_price_text: { type: 'string', description: 'The regular / original price before discount exactly as printed (often struck through). Empty if the page shows only one price.' },
    sale_price_text: { type: 'string', description: 'The discounted price exactly as printed, only when a discount is shown next to a regular price. Empty otherwise.' },
    category_text: { type: 'string', description: 'Product type exactly as printed on the page or its breadcrumb (e.g. "Serum", "에센스", "Toner"). Empty if not shown.' },
    key_ingredients: { type: 'array', items: { type: 'string' }, description: 'Ingredients the page highlights as hero / key ingredients, copied exactly as printed. Empty array if none are highlighted.' },
    usp: { type: 'array', items: { type: 'string' }, description: 'Up to 5 short selling-point phrases or claims copied word for word from the page (e.g. "96% snail mucin", "자극 테스트 완료"). Do not paraphrase. Empty array if none.' },
  },
  required: ['product_name', 'brand', 'price_text', 'currency', 'volume_text', 'ingredients', 'regular_price_text', 'sale_price_text', 'category_text', 'key_ingredients', 'usp'],
} as const;

export interface ScrapeResult {
  markdown: string;
  json: Record<string, unknown> | null;
  metadata: { sourceURL?: string; url?: string; statusCode?: number; title?: string };
}

export async function scrapeProduct(url: string): Promise<ScrapeResult> {
  if (!firecrawlConfigured()) throw new AdapterError('NOT_CONFIGURED', 'FIRECRAWL_API_KEY가 서버 환경변수에 설정되지 않았습니다.');
  let r: Response;
  try {
    r = await http.fetch(`${base()}/v2/scrape`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        formats: ['markdown', { type: 'json', schema: PRODUCT_SCHEMA, prompt: 'Extract the main product on this page. Copy text exactly as printed. Never guess: leave a field empty if it is not on the page.' }],
        onlyMainContent: false,
        timeout: 60_000,
      }),
      signal: AbortSignal.timeout(75_000),
    });
  } catch {
    throw new AdapterError('NETWORK', 'Firecrawl 서버에 연결하지 못했습니다.');
  }
  const body = (await r.json().catch(() => null)) as { success?: boolean; error?: string; data?: { markdown?: string; json?: Record<string, unknown>; metadata?: ScrapeResult['metadata'] } } | null;
  if (r.status === 401 || r.status === 403) throw new AdapterError('AUTH', 'Firecrawl API 인증에 실패했습니다. FIRECRAWL_API_KEY를 확인하세요.', r.status);
  if (r.status === 402) throw new AdapterError('QUOTA', '이번 달 Firecrawl 무료 크레딧을 모두 사용했습니다. 다음 달 초기화 후 다시 수집하세요 (추가 과금 없음).', r.status);
  if (r.status === 429) throw new AdapterError('RATE_LIMIT', 'Firecrawl 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.', r.status);
  if (!r.ok || !body?.success || !body.data) throw new AdapterError('UPSTREAM', `페이지를 수집하지 못했습니다${body?.error ? `: ${String(body.error).slice(0, 160)}` : ` (Firecrawl ${r.status})`}`, r.status);
  return { markdown: body.data.markdown ?? '', json: body.data.json ?? null, metadata: body.data.metadata ?? {} };
}

// ── Search (/v2/search) ─────────────────────────────────────────────────────

/** Search costs 2 credits per 10 results (rounded up), without scraping the results. */
export const searchCredits = (limit: number) => Math.ceil(Math.max(1, limit) / 10) * 2;

export interface SearchHit {
  url: string;
  title: string;
  description: string;
  position: number;
}

export async function searchWeb(query: string, opts: { limit: number; location?: string }): Promise<SearchHit[]> {
  if (!firecrawlConfigured()) throw new AdapterError('NOT_CONFIGURED', 'FIRECRAWL_API_KEY가 서버 환경변수에 설정되지 않았습니다.');
  let r: Response;
  try {
    r = await http.fetch(`${base()}/v2/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: opts.limit, sources: ['web'], ...(opts.location ? { location: opts.location } : {}) }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new AdapterError('NETWORK', 'Firecrawl 서버에 연결하지 못했습니다.');
  }
  const body = (await r.json().catch(() => null)) as { success?: boolean; error?: string; data?: { web?: unknown[] } | unknown[] } | null;
  if (r.status === 401 || r.status === 403) throw new AdapterError('AUTH', 'Firecrawl API 인증에 실패했습니다. FIRECRAWL_API_KEY를 확인하세요.', r.status);
  if (r.status === 402) throw new AdapterError('QUOTA', '이번 달 Firecrawl 무료 크레딧을 모두 사용했습니다. 다음 달 초기화 후 다시 검색하세요 (추가 과금 없음).', r.status);
  if (r.status === 429) throw new AdapterError('RATE_LIMIT', 'Firecrawl 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.', r.status);
  if (!r.ok || !body?.success) throw new AdapterError('UPSTREAM', `검색하지 못했습니다${body?.error ? `: ${String(body.error).slice(0, 160)}` : ` (Firecrawl ${r.status})`}`, r.status);
  const list = (Array.isArray(body.data) ? body.data : (body.data?.web ?? [])) as Record<string, unknown>[];
  return list
    .map((x, i) => ({ url: String(x.url ?? ''), title: String(x.title ?? '').slice(0, 300), description: String(x.description ?? '').slice(0, 600), position: Number(x.position) || i + 1 }))
    .filter((x) => /^https?:\/\//.test(x.url));
}

// ── Image search (/v2/search, sources: images) · Packaging Reference Library ──

export interface ImageHit {
  /** the image file itself */
  imageUrl: string;
  /** the page the image appears on (source) */
  pageUrl: string;
  title: string;
  width: number | null;
  height: number | null;
  position: number;
}

/**
 * Image results only give an image address, its page and a title. Nothing here proves the
 * image loads, so the caller checks each image URL before showing it as an image.
 * Cost: billed like web search results (2 credits per 10, Firecrawl pricing at the time of writing; confirm on the dashboard).
 */
export async function searchImages(query: string, opts: { limit: number; location?: string }): Promise<ImageHit[]> {
  if (!firecrawlConfigured()) throw new AdapterError('NOT_CONFIGURED', 'FIRECRAWL_API_KEY가 서버 환경변수에 설정되지 않았습니다.');
  let r: Response;
  try {
    r = await http.fetch(`${base()}/v2/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: opts.limit, sources: ['images'], ...(opts.location ? { location: opts.location } : {}) }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new AdapterError('NETWORK', 'Firecrawl 서버에 연결하지 못했습니다.');
  }
  const body = (await r.json().catch(() => null)) as { success?: boolean; error?: string; data?: { images?: unknown[] } } | null;
  if (r.status === 401 || r.status === 403) throw new AdapterError('AUTH', 'Firecrawl API 인증에 실패했습니다. FIRECRAWL_API_KEY를 확인하세요.', r.status);
  if (r.status === 402) throw new AdapterError('QUOTA', '이번 달 Firecrawl 무료 크레딧을 모두 사용했습니다. 다음 달 초기화 후 다시 검색하세요 (추가 과금 없음).', r.status);
  if (r.status === 429) throw new AdapterError('RATE_LIMIT', 'Firecrawl 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.', r.status);
  if (!r.ok || !body?.success) throw new AdapterError('UPSTREAM', `이미지를 검색하지 못했습니다${body?.error ? `: ${String(body.error).slice(0, 160)}` : ` (Firecrawl ${r.status})`}`, r.status);
  const list = (body.data?.images ?? []) as Record<string, unknown>[];
  const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
  return list
    .map((x, i) => ({
      imageUrl: String(x.imageUrl ?? x.image_url ?? ''),
      pageUrl: String(x.url ?? ''),
      title: String(x.title ?? '').slice(0, 300),
      width: num(x.imageWidth ?? x.image_width),
      height: num(x.imageHeight ?? x.image_height),
      position: Number(x.position) || i + 1,
    }))
    .filter((x) => /^https?:\/\//.test(x.imageUrl) && /^https?:\/\//.test(x.pageUrl));
}

export interface PageImages {
  markdown: string;
  title: string | null;
  /** og:image / twitter:image declared by the page itself */
  ogImage: string | null;
  /** image addresses found in the page */
  images: string[];
  json: Record<string, unknown> | null;
}

export const PAGE_IMAGE_CREDITS = 5;

/** One official product page → brand / product name (grounded later) + the page's own image addresses. */
export async function scrapePageImages(url: string): Promise<PageImages> {
  if (!firecrawlConfigured()) throw new AdapterError('NOT_CONFIGURED', 'FIRECRAWL_API_KEY가 서버 환경변수에 설정되지 않았습니다.');
  let r: Response;
  try {
    r = await http.fetch(`${base()}/v2/scrape`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        formats: [
          'markdown',
          'images',
          {
            type: 'json',
            schema: {
              type: 'object',
              properties: {
                product_name: { type: 'string', description: 'Main product name exactly as printed. Empty if not shown.' },
                brand: { type: 'string', description: 'Brand name exactly as printed. Empty if not shown.' },
                packaging_text: { type: 'array', items: { type: 'string' }, description: 'Up to 5 phrases copied word for word from the page that describe the bottle, container, box or packaging (material, shape, finish). Empty array if none.' },
              },
              required: ['product_name', 'brand', 'packaging_text'],
            },
            prompt: 'Copy text exactly as printed. Never guess: leave a field empty if it is not on the page.',
          },
        ],
        onlyMainContent: false,
        timeout: 60_000,
      }),
      signal: AbortSignal.timeout(75_000),
    });
  } catch {
    throw new AdapterError('NETWORK', 'Firecrawl 서버에 연결하지 못했습니다.');
  }
  const body = (await r.json().catch(() => null)) as { success?: boolean; error?: string; data?: { markdown?: string; images?: unknown[]; json?: Record<string, unknown>; metadata?: Record<string, unknown> } } | null;
  if (r.status === 401 || r.status === 403) throw new AdapterError('AUTH', 'Firecrawl API 인증에 실패했습니다. FIRECRAWL_API_KEY를 확인하세요.', r.status);
  if (r.status === 402) throw new AdapterError('QUOTA', '이번 달 Firecrawl 무료 크레딧을 모두 사용했습니다. 다음 달 초기화 후 다시 수집하세요 (추가 과금 없음).', r.status);
  if (r.status === 429) throw new AdapterError('RATE_LIMIT', 'Firecrawl 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.', r.status);
  if (!r.ok || !body?.success || !body.data) throw new AdapterError('UPSTREAM', `페이지를 수집하지 못했습니다${body?.error ? `: ${String(body.error).slice(0, 160)}` : ` (Firecrawl ${r.status})`}`, r.status);
  const meta = body.data.metadata ?? {};
  const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const og = pick(meta.ogImage ?? meta['og:image'] ?? meta.twitterImage ?? meta['twitter:image']);
  const abs = (v: unknown) => {
    try {
      const s = String(v ?? '');
      return s ? new URL(s, url).toString() : null;
    } catch {
      return null;
    }
  };
  return {
    markdown: body.data.markdown ?? '',
    title: typeof meta.title === 'string' ? meta.title.slice(0, 300) : null,
    ogImage: abs(og),
    images: [...new Set((body.data.images ?? []).map(abs).filter((x): x is string => !!x && /^https?:\/\//.test(x)))].slice(0, 60),
    json: body.data.json ?? null,
  };
}
