/**
 * Competitor discovery from a product idea: search queries, candidate filtering and a rule-based
 * relevance estimate. Nothing here calls an AI model; every score is labelled as an estimate.
 */
import { blockedDomain } from './robots.js';
import { normalizeUrl } from './product.js';
import type { SearchHit } from './adapters/firecrawl.js';

export interface IdeaAttributes {
  idea: string;
  category: string;
  subtype: string;
  benefits: string[];
  target: string;
  markets: string[];
  targetPrice: number | null;
  ingredients: string[];
}

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const list = (v: unknown, n: number, len: number) => (Array.isArray(v) ? [...new Set(v.map((x) => clip(x, len)).filter(Boolean))].slice(0, n) : []);

export function parseAttributes(raw: unknown): IdeaAttributes {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const price = Number(b.targetPrice);
  return {
    idea: clip(b.idea, 1000),
    category: clip(b.category, 30),
    subtype: clip(b.subtype, 30),
    benefits: list(b.benefits, 5, 30),
    target: clip(b.target, 60),
    markets: list(b.markets, 6, 4).map((m) => m.toUpperCase()),
    targetPrice: Number.isFinite(price) && price > 0 ? price : null,
    ingredients: list(b.ingredients, 5, 40),
  };
}

/** Search location per selling market (Firecrawl `location`). */
export const LOCATION: Record<string, string> = { KR: 'South Korea', US: 'United States', JP: 'Japan', CN: 'China', GB: 'United Kingdom', UK: 'United Kingdom', EU: 'Germany', SG: 'Singapore', VN: 'Vietnam', TH: 'Thailand', AU: 'Australia', CA: 'Canada', SEA: 'Singapore' };

/** Small fixed dictionary so non-Korean markets get English queries without an AI call. */
const EN: Record<string, string> = {
  '앰플/세럼': 'serum', 앰플: 'ampoule', 세럼: 'serum', 에센스: 'essence', 크림: 'cream', 토너: 'toner', 로션: 'lotion', 패드: 'toner pad', 마스크팩: 'sheet mask', 선크림: 'sunscreen', 클렌저: 'cleanser',
  스킨케어: 'skincare', 선케어: 'sun care', 클렌징: 'cleansing', 헤어: 'hair care', 바디: 'body care', 메이크업: 'makeup',
  탄력: 'firming', 주름: 'anti-wrinkle', 진정: 'soothing', 보습: 'hydrating', 미백: 'brightening', 브라이트닝: 'brightening', 트러블: 'acne', 모공: 'pore', 장벽: 'barrier', 재생: 'repair', 안티에이징: 'anti-aging', 각질: 'exfoliating', 수분: 'hydrating', 영양: 'nourishing', 자외선차단: 'sunscreen',
  병풀: 'centella', 시카: 'cica', 나이아신아마이드: 'niacinamide', 히알루론산: 'hyaluronic acid', 레티놀: 'retinol', 레티날: 'retinal', 펩타이드: 'peptide', 세라마이드: 'ceramide', 비타민C: 'vitamin C', 콜라겐: 'collagen', 달팽이: 'snail mucin', 어성초: 'heartleaf', 프로폴리스: 'propolis',
};
const en = (w: string) => EN[w] ?? (/^[\x20-\x7e]+$/.test(w) ? w : '');

/** Two queries per market: "type + benefit (+ ingredient)" and "ingredient + type". Users can edit them on screen. */
export function buildQueries(a: IdeaAttributes, market: string): string[] {
  const korean = market === 'KR';
  const t = (w: string) => (korean ? w.replace(/\s*\/\s*/g, ' ') : en(w));
  const type = t(a.subtype) || t(a.category);
  const benefit = a.benefits.map(t).find(Boolean) ?? '';
  const ingredient = a.ingredients.map(t).find(Boolean) ?? '';
  const q1 = [ingredient, benefit, type].filter(Boolean).join(' ');
  const q2 = [ingredient || benefit, type, korean ? '공식몰' : 'official'].filter(Boolean).join(' ');
  return [...new Set([q1, q2].map((q) => q.trim()).filter((q) => q.split(' ').length >= 2))];
}

/** Hosts that are not product pages of a seller (social, video, news, blogs, ingredient databases, search). */
const NOT_SELLERS = /(^|\.)(blog\.naver\.com|tistory\.com|youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com|reddit\.com|wikipedia\.org|pinterest\.[a-z.]+|x\.com|twitter\.com|medium\.com|incidecoder\.com|skinsort\.com|cosdna\.com|google\.[a-z.]+|naver\.com|daum\.net|brunch\.co\.kr|namu\.wiki|allure\.com|byrdie\.com|vogue\.[a-z.]+|cosmopolitan\.com)$/i;

/** URL looks like a single product detail page. */
export const isProductUrl = (u: URL) => /\/(products?|goods|item|items|p|shop\/product|product-detail)\/[^/]+/i.test(u.pathname) || /[?&](product_no|goodsno|goods_no|itemid|item_id|pid)=/i.test(u.search) || /\/product\/detail\.html/i.test(u.pathname);

export interface Candidate {
  url: string;
  domain: string;
  title: string;
  description: string;
  query: string;
  /** rule-based relevance estimate 0-100 (not market share, not sales rank) */
  score: number;
  matches: { category: boolean; benefit: boolean; ingredient: boolean; target: boolean; market: boolean };
  excluded: string | null;
}

const has = (text: string, words: string[]) => words.some((w) => w && text.includes(w.toLowerCase()));

export function scoreHit(hit: SearchHit, a: IdeaAttributes, market: string): Pick<Candidate, 'score' | 'matches'> {
  const text = `${hit.title} ${hit.description} ${hit.url}`.toLowerCase();
  const both = (words: string[]) => [...words, ...words.map(en)].filter(Boolean);
  const host = new URL(hit.url).hostname;
  const matches = {
    category: has(text, both([a.subtype, ...a.subtype.split('/'), a.category])),
    benefit: has(text, both(a.benefits)),
    ingredient: has(text, both(a.ingredients)),
    target: has(text, a.target.split(/[\s,·/]+/).filter((w) => w.length >= 2)),
    market: market === 'KR' ? /\.kr$|\.co\.kr$/.test(host) || /[가-힣]/.test(hit.title) : !/\.kr$/.test(host),
  };
  const score = (matches.category ? 30 : 0) + (matches.benefit ? 25 : 0) + (matches.ingredient ? 25 : 0) + (matches.target ? 10 : 0) + (matches.market ? 10 : 0);
  return { score, matches };
}

/** Filter, de-duplicate and score search hits. Excluded hits are kept with a reason so the screen can say why. */
export function toCandidates(hits: (SearchHit & { query: string })[], a: IdeaAttributes, market: string): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const h of hits) {
    let u: URL;
    try {
      u = new URL(normalizeUrl(h.url));
    } catch {
      continue;
    }
    const key = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const domain = u.hostname.replace(/^www\./, '');
    const blocked = blockedDomain(u.hostname);
    const excluded = blocked ? `${blocked}: 이용약관상 자동 수집 불가` : NOT_SELLERS.test(u.hostname) ? '판매 페이지가 아님 (블로그·SNS·기사·성분 사전 등)' : !isProductUrl(u) ? '제품 상세 페이지 주소가 아님' : null;
    out.push({ url: u.toString(), domain, title: h.title, description: h.description, query: h.query, ...scoreHit(h, a, market), excluded });
  }
  return out.sort((x, y) => Number(!!x.excluded) - Number(!!y.excluded) || y.score - x.score);
}
