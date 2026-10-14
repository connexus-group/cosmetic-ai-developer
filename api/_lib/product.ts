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
    sourceName: 'Firecrawl',
    dataType: 'COLLECTED',
    markdownHash: hash(md, 32),
    markdownChars: md.length,
  };
}

/** A row worth storing must carry at least one real field besides the URL. */
export const hasData = (p: CompetitorProduct) => Boolean(p.productName || p.priceValue !== null || p.volumeValue !== null || p.ingredients.length);
