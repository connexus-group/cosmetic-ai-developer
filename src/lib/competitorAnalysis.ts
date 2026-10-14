import { first, signals, vals } from '@/lib/spec';
import type { Project } from '@/data/types';
import type { CompetitorProduct, FxRates, IdeaAttributes } from '@/data/competitorProducts';

/**
 * Rule-based comparison of collected competitor products (no AI call).
 * Inputs are only values stored from real product pages; anything missing stays missing.
 * Relevance is an estimate of how close a product is to the idea, never market share or sales rank.
 */

// ── idea attributes ─────────────────────────────────────────────────────────

export type AttrKey = 'category' | 'subtype' | 'benefits' | 'target' | 'markets' | 'targetPrice' | 'ingredients';
export type AttrSource = '직접 입력' | '아이디어에서 추출' | '데모 추천' | '없음';

const modeLabel = (m: string | undefined): AttrSource => (m === 'user' ? '직접 입력' : m === 'idea' ? '아이디어에서 추출' : m === 'ai' ? '데모 추천' : '없음');
const splitList = (s: string) => s.split(/\s*[/,·]\s*/).map((x) => x.trim()).filter(Boolean);

/** Attributes for the search, taken from the 6-step intake first and the idea analysis second. */
export function ideaAttributes(p: Project): { attrs: IdeaAttributes; sources: Record<AttrKey, AttrSource> } {
  const s = p.spec ?? {};
  const sig = signals(p);
  const [iCat, iSub] = (p.intake?.category.value ?? '').split(' > ');
  const ideaKind = (k: keyof Project['intake']) => (p.intake?.[k].kind === 'AI_ANALYSIS' ? '아이디어에서 추출' : p.intake?.[k].kind === 'USER_INPUT' ? '직접 입력' : '데모 추천');
  const from = <T,>(specVal: T | undefined, specMode: string | undefined, fallback: T, fbSource: AttrSource): [T, AttrSource] => (specVal !== undefined && (Array.isArray(specVal) ? specVal.length > 0 : specVal !== '' && specVal !== null) ? [specVal, modeLabel(specMode)] : [fallback, fallback && (!Array.isArray(fallback) || fallback.length) ? fbSource : '없음']);

  const [category, cS] = from(first(s, 'category'), s.category?.mode, iCat ?? '', ideaKind('category'));
  const [subtype, stS] = from(first(s, 'subtype'), s.subtype?.mode, iSub ?? '', ideaKind('category'));
  const [benefits, bS] = from(vals(s, 'benefits'), s.benefits?.mode, splitList(p.intake?.benefit.value ?? '').filter((b) => b !== '안티에이징'), ideaKind('benefit'));
  const targetSpec = [...vals(s, 'ages'), ...vals(s, 'gender').filter((g) => g !== '성별 무관'), ...vals(s, 'skinTypes')].join(' ');
  const [target, tS] = from(targetSpec, s.ages?.mode ?? s.skinTypes?.mode, p.intake?.target.value ?? '', ideaKind('target'));
  const [markets, mS] = from(vals(s, 'markets'), s.markets?.mode, ['KR'], '없음');
  const fromIntake = Number((p.intake?.price.value.match(/[\d,]{4,}/g) ?? [])[0]?.replace(/,/g, '')) || null;
  const [targetPrice, pS] = from(sig.targetPrice ?? undefined, s.targetPrice?.mode, fromIntake, ideaKind('price'));
  const [ingredients, iS] = from([...vals(s, 'mustInclude'), ...vals(s, 'keywords')].slice(0, 5), s.mustInclude?.mode ?? s.keywords?.mode, [], '없음');

  return {
    attrs: { idea: p.idea ?? '', category, subtype, benefits: benefits.slice(0, 5), target, markets: markets.length ? markets : ['KR'], targetPrice: targetPrice ?? null, ingredients },
    sources: { category: cS, subtype: stS, benefits: bS, target: tS, markets: vals(s, 'markets').length ? mS : '없음', targetPrice: pS, ingredients: iS },
  };
}

// ── search queries and credit estimate (same rules as api/_lib/discovery.ts) ─

/** Korean → English for non-Korean markets and for matching English product pages. */
export const EN: Record<string, string> = {
  '앰플/세럼': 'serum', 앰플: 'ampoule', 세럼: 'serum', 에센스: 'essence', 크림: 'cream', 토너: 'toner', 로션: 'lotion', 패드: 'toner pad', 마스크팩: 'sheet mask', 선크림: 'sunscreen', 클렌저: 'cleanser',
  스킨케어: 'skincare', 선케어: 'sun care', 클렌징: 'cleansing', 헤어: 'hair care', 바디: 'body care', 메이크업: 'makeup',
  탄력: 'firming', 주름: 'wrinkle', 진정: 'soothing', 보습: 'hydrating', 미백: 'brightening', 브라이트닝: 'brightening', 트러블: 'acne', 모공: 'pore', 장벽: 'barrier', 재생: 'repair', 안티에이징: 'anti-aging', 각질: 'exfoliating', 수분: 'hydrating', 영양: 'nourishing', 자외선차단: 'sunscreen',
  병풀: 'centella', 시카: 'cica', 나이아신아마이드: 'niacinamide', 히알루론산: 'hyaluronic', 레티놀: 'retinol', 레티날: 'retinal', 펩타이드: 'peptide', 세라마이드: 'ceramide', 비타민C: 'vitamin c', 콜라겐: 'collagen', 달팽이: 'snail', 어성초: 'heartleaf', 프로폴리스: 'propolis', PDRN: 'pdrn', 판테놀: 'panthenol', 아데노신: 'adenosine', 스쿠알란: 'squalane',
  민감성: 'sensitive', 건성: 'dry', 지성: 'oily', 복합성: 'combination',
};
const en = (w: string) => EN[w] ?? (/^[\x20-\x7e]+$/.test(w) ? w : '');

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

export const searchCredits = (limit: number) => Math.ceil(Math.max(1, limit) / 10) * 2;

// ── normalization ───────────────────────────────────────────────────────────

const words = (list: string[]) => [...new Set(list.flatMap((w) => [w, ...w.split(/[\s/·,]+/), en(w)]).map((w) => w.toLowerCase().trim()).filter((w) => w.length >= 2))];
const contains = (text: string, list: string[]) => list.some((w) => text.includes(w));

/** price actually charged on the page: sale price when a discount is shown, else the listed price */
export const effectivePrice = (p: CompetitorProduct) => p.salePriceValue ?? p.priceValue;

/** size in ml/g: stored normalized value, or the original parse when the row predates the discovery migration */
export function sizeOf(p: CompetitorProduct): { value: number; unit: 'ml' | 'g'; converted: boolean } | null {
  if (p.sizeValue && p.sizeUnit) return { value: p.sizeValue, unit: p.sizeUnit, converted: !!p.sizeConverted };
  if (p.volumeValue && (p.volumeUnit === 'ml' || p.volumeUnit === 'g')) return { value: p.volumeValue, unit: p.volumeUnit, converted: false };
  return null;
}

export interface FxUse {
  rate: number;
  date: string;
}
export const toKrw = (value: number | null | undefined, currency: string | null | undefined, fx: FxRates | null): { krw: number; fx: FxUse | null } | null => {
  if (value === null || value === undefined || !currency) return null;
  if (currency === 'KRW') return { krw: value, fx: null };
  const r = fx?.rates[currency];
  return r ? { krw: value * r.rate, fx: r } : null;
};

// ── relevance after collection (6 criteria) ─────────────────────────────────

export const CRITERIA = [
  { key: 'category', label: '제품 유형', weight: 25 },
  { key: 'benefit', label: '효능', weight: 20 },
  { key: 'ingredient', label: '원료', weight: 20 },
  { key: 'price', label: '가격대', weight: 15 },
  { key: 'country', label: '판매 국가', weight: 10 },
  { key: 'target', label: '타깃', weight: 10 },
] as const;
export type CriterionKey = (typeof CRITERIA)[number]['key'];
/** true = matches, false = does not match, null = the page has no data to judge */
export type Match = Record<CriterionKey, boolean | null>;

export interface Analyzed {
  p: CompetitorProduct;
  priceKrw: number | null;
  per100Krw: number | null;
  size: ReturnType<typeof sizeOf>;
  fx: FxUse | null;
  match: Match;
  /** rule-based relevance estimate 0-100 */
  relevance: number;
}

export function analyzeProduct(p: CompetitorProduct, a: IdeaAttributes, fx: FxRates | null): Analyzed {
  const size = sizeOf(p);
  const price = toKrw(effectivePrice(p), p.currency, fx);
  const per100Raw = p.unitPricePer100 ?? (effectivePrice(p) && size ? (effectivePrice(p)! / size.value) * 100 : null);
  const per100 = toKrw(per100Raw, p.currency, fx);
  const name = `${p.productName ?? ''} ${p.pageTitle ?? ''} ${p.category ?? ''}`.toLowerCase();
  const claims = `${name} ${(p.usp ?? []).join(' ')} ${(p.keyIngredients ?? []).join(' ')}`.toLowerCase();
  const inci = `${p.ingredients.join(' ')} ${(p.keyIngredients ?? []).join(' ')}`.toLowerCase();
  const cat = words([a.subtype, a.category]);
  const ben = words(a.benefits);
  const ing = words(a.ingredients);
  const tgt = words(a.target.split(/\s+/)).filter((w) => !/^\d/.test(w));
  const market = (c: string | null | undefined) => (c ? a.markets.some((m) => m === c || (m === 'UK' && c === 'GB') || (m === 'SEA' && ['SG', 'VN', 'TH', 'MY', 'ID', 'PH'].includes(c))) : null);
  const match: Match = {
    category: cat.length && name.trim() ? contains(name, cat) : null,
    benefit: ben.length && claims.trim() ? contains(claims, ben) : null,
    ingredient: ing.length && inci.trim() ? contains(inci, ing) : null,
    price: a.targetPrice && price ? Math.abs(price.krw - a.targetPrice) / a.targetPrice <= 0.3 : null,
    country: market(p.country),
    target: tgt.length && claims.trim() ? contains(claims, tgt) : null,
  };
  const relevance = CRITERIA.reduce((s, c) => s + (match[c.key] ? c.weight : 0), 0);
  return { p, priceKrw: price?.krw ?? null, per100Krw: per100?.krw ?? null, size, fx: price?.fx ?? per100?.fx ?? null, match, relevance };
}

// ── cross-product summaries ─────────────────────────────────────────────────

export const MIN_FOR_CHARTS = 3;

const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'skin', 'of', 'to', 'in', 'a', 'an', 'is', 'on', 'all', 'that', 'this', 'from', 'by', 'it', 'up', 'our', '및', '위한', '있는', '하는', '피부']);

/** Ingredients printed on 2+ competitor pages (INCI name as printed, compared case-insensitively). */
export function ingredientOverlap(list: Analyzed[]) {
  const count = new Map<string, { name: string; n: number }>();
  for (const x of list) for (const raw of new Set(x.p.ingredients.map((i) => i.trim()))) {
    const k = raw.toLowerCase();
    const cur = count.get(k) ?? { name: raw, n: 0 };
    cur.n++;
    count.set(k, cur);
  }
  return [...count.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, 15);
}

/** Words that recur in the USP phrases copied from 2+ pages. */
export function commonClaims(list: Analyzed[]) {
  const count = new Map<string, number>();
  for (const x of list) {
    const terms = new Set(
      (x.p.usp ?? [])
        .join(' ')
        .toLowerCase()
        .split(/[^\p{L}\p{N}%]+/u)
        .filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w)),
    );
    for (const t of terms) count.set(t, (count.get(t) ?? 0) + 1);
  }
  return [...count.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([term, n]) => ({ term, n }));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

/**
 * Differentiation openings derived only from the stored rows and the user's own inputs.
 * Each line says what it is based on; when data is thin it says so instead of guessing.
 */
export function differentiation(list: Analyzed[], a: IdeaAttributes, ourSizeMl: number | null): string[] {
  const out: string[] = [];
  const n = list.length;
  if (n < 2) return out;
  for (const ing of a.ingredients.slice(0, 3)) {
    const w = words([ing]);
    const used = list.filter((x) => contains(`${x.p.ingredients.join(' ')} ${(x.p.keyIngredients ?? []).join(' ')}`.toLowerCase(), w)).length;
    out.push(used === 0 ? `필수 원료 '${ing}'는 비교한 ${n}개 제품의 페이지 성분에 없습니다. 원료 차별화 여지가 있습니다.` : `필수 원료 '${ing}'는 ${n}개 중 ${used}개 제품이 이미 쓰고 있습니다.${used / n >= 0.5 ? ' 원료만으로는 차별화가 어렵습니다.' : ''}`);
  }
  const per100 = list.map((x) => x.per100Krw).filter((v): v is number => v !== null);
  const med = median(per100);
  if (med && a.targetPrice && ourSizeMl) {
    const ours = (a.targetPrice / ourSizeMl) * 100;
    const diff = Math.round(((ours - med) / med) * 100);
    out.push(`목표가 ${a.targetPrice.toLocaleString('ko-KR')}원 · ${ourSizeMl}ml 기준 100ml당 ${Math.round(ours).toLocaleString('ko-KR')}원으로, 비교 제품 중앙값(${Math.round(med).toLocaleString('ko-KR')}원)보다 ${Math.abs(diff)}% ${diff >= 0 ? '높습니다. 가격을 뒷받침할 근거가 필요합니다.' : '낮습니다. 가성비 포지션이 가능합니다.'}`);
  } else if (med) out.push(`비교 제품의 100ml당 가격 중앙값은 ${Math.round(med).toLocaleString('ko-KR')}원입니다. 목표가와 용량을 입력하면 비교할 수 있습니다.`);
  const claims = commonClaims(list).slice(0, 3);
  if (claims.length) out.push(`경쟁 페이지에 반복되는 표현: ${claims.map((c) => `'${c.term}'(${c.n}개)`).join(', ')}. 같은 메시지 대신 다른 근거를 내세우는 것을 검토하세요.`);
  const sale = list.filter((x) => x.p.salePriceValue !== null && x.p.salePriceValue !== undefined).length;
  if (sale) out.push(`${n}개 중 ${sale}개 제품이 수집 시점에 할인가를 표시했습니다.`);
  return out;
}

export const fmtKrw = (v: number | null) => (v === null ? null : `${Math.round(v).toLocaleString('ko-KR')}원`);
