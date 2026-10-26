/**
 * Data Validation for competitor product pages. Mirrors the `competitor_products` table.
 *
 * Firecrawl's JSON extraction is treated as a candidate only. Each field is kept ONLY when
 * the same text appears in the page markdown Firecrawl returned (grounding). Anything that
 * cannot be found in the page is dropped and marked, never repaired or guessed.
 */
import { hash } from './observation.js';
import type { ScrapeResult } from './adapters/firecrawl.js';

/** FOUND: value is printed on the page · NOT_FOUND: page has no such text · DROPPED: extractor returned text that is not on the page */
export type FieldStatus = 'FOUND' | 'NOT_FOUND' | 'DROPPED';

export interface CompetitorProduct {
  id: string;
  url: string;
  finalUrl: string;
  domain: string;
  collectedAt: string;
  productName: string | null;
  brand: string | null;
  pageTitle: string | null;
  priceValue: number | null;
  priceText: string | null;
  currency: string | null;
  volumeValue: number | null;
  volumeUnit: string | null;
  volumeText: string | null;
  ingredients: string[];
  /** ingredients the extractor listed but the page text does not contain */
  ingredientsDropped: number;
  fieldStatus: { name: FieldStatus; brand: FieldStatus; price: FieldStatus; volume: FieldStatus; ingredients: FieldStatus };
  robotsUrl: string | null;
  // ── added 2026-10-14 (auto discovery). Older rows have these as null / []. ──
  /** price before discount as printed; null when the page shows a single price */
  regularPriceValue: number | null;
  regularPriceText: string | null;
  /** discounted price as printed; null when no discount is shown */
  salePriceValue: number | null;
  salePriceText: string | null;
  /** product type as printed on the page / breadcrumb */
  category: string | null;
  keyIngredients: string[];
  /** selling-point phrases copied from the page */
  usp: string[];
  /** size in ml or g (metric value from the page, or fl oz / oz converted) */
  sizeValue: number | null;
  sizeUnit: 'ml' | 'g' | null;
  sizeConverted: boolean;
  /** price per 100 ml / 100 g in the page currency (computed from the stored price and size) */
  unitPricePer100: number | null;
  /** selling country estimated from the currency and domain, with the basis */
  country: string | null;
  countryBasis: string | null;
  sourceName: string;
  dataType: 'COLLECTED';
  markdownHash: string;
  markdownChars: number;
}

export const productId = (url: string) => `prd_${hash(normalizeUrl(url))}`;

/** Drop fragments and common tracking params so the same page maps to one row. */
export function normalizeUrl(raw: string) {
  const u = new URL(raw);
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|n_media$|n_query$)/i.test(k)) u.searchParams.delete(k);
  return u.toString();
}

/** lowercase, NFKC, no whitespace: "25, 000 원" and "25,000원" compare equal */
const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\s ​]+/g, '');
const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 300) : '');

export function parsePrice(text: string, currency: string): { value: number; currency: string } | null {
  const cur = /원|₩|krw/i.test(text) ? 'KRW' : /\$|usd/i.test(text) ? 'USD' : /€|eur/i.test(text) ? 'EUR' : /¥|jpy|円/i.test(text) ? 'JPY' : currency.toUpperCase().slice(0, 3) || null;
  const m = /\d[\d,.\s]*/.exec(text);
  if (!m || !cur) return null;
  const digits = m[0].replace(/\s/g, '');
  // KRW / JPY have no minor unit: "25,000" → 25000. Others: "1,299.00" → 1299
  const value = cur === 'KRW' || cur === 'JPY' ? Number(digits.replace(/[,.]/g, '')) : Number(digits.replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 && value < 10_000_000 ? { value, currency: cur } : null;
}

export function parseVolume(text: string): { value: number; unit: string } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(ml|㎖|g|㎎|mg|kg|l|ℓ|fl\.?\s*oz|oz)(?![a-z])/i.exec(text.normalize('NFKC'));
  if (!m) return null;
  const value = Number(m[1].replace(',', '.'));
  const u = m[2].toLowerCase().replace(/\s|\./g, '');
  const unit = u === 'ml' || u === '㎖' ? 'ml' : u === 'l' || u === 'ℓ' ? 'l' : u === 'floz' ? 'fl oz' : u;
  return value > 0 && value < 100_000 ? { value, unit } : null;
}

/** Metric size first ("3.38 fl.oz / 100mL" → 100 ml); fl oz / oz converted only when no metric value is printed. */
export function normalizeSize(text: string): { value: number; unit: 'ml' | 'g'; converted: boolean } | null {
  const t = text.normalize('NFKC');
  const metric = /(\d+(?:[.,]\d+)?)\s*(ml|g|l|kg)(?![a-z])/i.exec(t);
  if (metric) {
    const v = Number(metric[1].replace(',', '.'));
    const u = metric[2].toLowerCase();
    const value = u === 'l' ? v * 1000 : u === 'kg' ? v * 1000 : v;
    return value > 0 && value < 100_000 ? { value: Math.round(value * 100) / 100, unit: u === 'g' || u === 'kg' ? 'g' : 'ml', converted: false } : null;
  }
  const floz = /(\d+(?:[.,]\d+)?)\s*fl\.?\s*oz/i.exec(t);
  if (floz) return { value: Math.round(Number(floz[1].replace(',', '.')) * 29.5735 * 10) / 10, unit: 'ml', converted: true };
  const oz = /(\d+(?:[.,]\d+)?)\s*oz(?![a-z])/i.exec(t);
  if (oz) return { value: Math.round(Number(oz[1].replace(',', '.')) * 28.3495 * 10) / 10, unit: 'g', converted: true };
  return null;
}

const COUNTRY_BY_CURRENCY: Record<string, string> = { KRW: 'KR', USD: 'US', JPY: 'JP', EUR: 'EU', GBP: 'GB', CNY: 'CN', SGD: 'SG', AUD: 'AU', CAD: 'CA' };
const COUNTRY_BY_TLD: Record<string, string> = { kr: 'KR', jp: 'JP', uk: 'GB', cn: 'CN', sg: 'SG', au: 'AU', ca: 'CA', de: 'EU', fr: 'EU', it: 'EU', es: 'EU', nl: 'EU' };

/** Estimate only: the page rarely states its selling country, so the basis is stored with it. */
export function estimateCountry(host: string, currency: string | null): { country: string | null; basis: string | null } {
  const tld = host.split('.').pop()?.toLowerCase() ?? '';
  if (COUNTRY_BY_TLD[tld]) return { country: COUNTRY_BY_TLD[tld], basis: `도메인 .${tld}` };
  const sub = host.split('.')[0].toLowerCase();
  if (sub.length === 2 && COUNTRY_BY_TLD[sub]) return { country: COUNTRY_BY_TLD[sub], basis: `하위 도메인 ${sub}.` };
  if (currency && COUNTRY_BY_CURRENCY[currency]) return { country: COUNTRY_BY_CURRENCY[currency], basis: `가격 통화 ${currency}` };
  return { country: null, basis: null };
}

export function validateProduct(inputUrl: string, scrape: ScrapeResult, robotsUrl: string | null, collectedAt = new Date().toISOString()): CompetitorProduct {
  const md = scrape.markdown ?? '';
  const page = norm(md);
  const onPage = (s: string) => s.length > 0 && page.includes(norm(s));
  const j = scrape.json ?? {};
  const finalUrl = str(scrape.metadata.url) || str(scrape.metadata.sourceURL) || inputUrl;
  const title = str(scrape.metadata.title) || null;

  const pick = (v: unknown): [string | null, FieldStatus] => {
    const s = str(v);
    if (!s) return [null, 'NOT_FOUND'];
    return onPage(s) || (title !== null && norm(title).includes(norm(s))) ? [s, 'FOUND'] : [null, 'DROPPED'];
  };
  const [productName, nameStatus] = pick(j.product_name);
  const [brand, brandStatus] = pick(j.brand);

  let price: ReturnType<typeof parsePrice> = null;
  let priceStatus: FieldStatus = 'NOT_FOUND';
  const priceText = str(j.price_text);
  if (priceText) {
    price = onPage(priceText) ? parsePrice(priceText, str(j.currency)) : null;
    priceStatus = price ? 'FOUND' : 'DROPPED';
  }

  let volume: ReturnType<typeof parseVolume> = null;
  let volumeStatus: FieldStatus = 'NOT_FOUND';
  const volumeText = str(j.volume_text);
  if (volumeText) {
    volume = onPage(volumeText) ? parseVolume(volumeText) : null;
    volumeStatus = volume ? 'FOUND' : 'DROPPED';
  }

  const listed = Array.isArray(j.ingredients) ? [...new Set((j.ingredients as unknown[]).map(str).filter((s) => s.length > 0 && s.length <= 120))] : [];
  const ingredients = listed.filter(onPage).slice(0, 200);
  const ingredientsDropped = listed.length - ingredients.length;
  const ingredientsStatus: FieldStatus = !listed.length ? 'NOT_FOUND' : ingredients.length ? 'FOUND' : 'DROPPED';

  const priced = (v: unknown) => {
    const t = str(v);
    const p = t && onPage(t) ? parsePrice(t, str(j.currency) || price?.currency || '') : null;
    return p ? { value: p.value, text: t } : null;
  };
  const regular = priced(j.regular_price_text);
  const sale = regular ? priced(j.sale_price_text) : null;
  const strList = (v: unknown, max: number, len: number) => (Array.isArray(v) ? [...new Set((v as unknown[]).map(str).filter((x) => x.length > 0 && x.length <= len))].filter(onPage).slice(0, max) : []);
  const [category] = pick(j.category_text);
  const size = volume && volumeText ? normalizeSize(volumeText) : null;
  const effective = sale?.value ?? price?.value ?? null;
  const host = new URL(inputUrl).hostname.replace(/^www\./, '');
  const where = estimateCountry(host, price?.currency ?? null);

  return {
    id: productId(inputUrl),
    url: normalizeUrl(inputUrl),
    finalUrl,
    domain: new URL(inputUrl).hostname.replace(/^www\./, ''),
    collectedAt,
    productName,
    brand,
    pageTitle: title,
    priceValue: price?.value ?? null,
    priceText: price ? priceText : null,
    currency: price?.currency ?? null,
    volumeValue: volume?.value ?? null,
    volumeUnit: volume?.unit ?? null,
    volumeText: volume ? volumeText : null,
    ingredients,
    ingredientsDropped,
    fieldStatus: { name: nameStatus, brand: brandStatus, price: priceStatus, volume: volumeStatus, ingredients: ingredientsStatus },
    robotsUrl,
    regularPriceValue: regular?.value ?? null,
    regularPriceText: regular?.text ?? null,
    salePriceValue: sale && regular && sale.value < regular.value ? sale.value : null,
    salePriceText: sale && regular && sale.value < regular.value ? sale.text : null,
    category,
    keyIngredients: strList(j.key_ingredients, 10, 80),
    usp: strList(j.usp, 5, 160),
    sizeValue: size?.value ?? null,
    sizeUnit: size?.unit ?? null,
    sizeConverted: size?.converted ?? false,
    unitPricePer100: effective !== null && size ? Math.round((effective / size.value) * 100 * 100) / 100 : null,
    country: where.country,
    countryBasis: where.basis,
    sourceName: 'Firecrawl',
    dataType: 'COLLECTED',
    markdownHash: hash(md, 32),
    markdownChars: md.length,
  };
}

/** A row worth storing must carry at least one real field besides the URL. */
export const hasData = (p: CompetitorProduct) => Boolean(p.productName || p.priceValue !== null || p.volumeValue !== null || p.ingredients.length);
