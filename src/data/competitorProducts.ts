/**
 * Client for /api/competitor-products (Firecrawl → Supabase). Kept apart from the demo
 * `dataSource`: these rows are collected from real product pages and are never mixed with mock competitors.
 */

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
  ingredientsDropped: number;
  fieldStatus: { name: FieldStatus; brand: FieldStatus; price: FieldStatus; volume: FieldStatus; ingredients: FieldStatus };
  robotsUrl: string | null;
  sourceName: string;
  dataType: 'COLLECTED';
  // added 2026-10-14 (auto discovery). Rows saved before the discovery migration have these as null / [].
  regularPriceValue?: number | null;
  regularPriceText?: string | null;
  salePriceValue?: number | null;
  salePriceText?: string | null;
  category?: string | null;
  keyIngredients?: string[];
  usp?: string[];
  sizeValue?: number | null;
  sizeUnit?: 'ml' | 'g' | null;
  sizeConverted?: boolean;
  unitPricePer100?: number | null;
  country?: string | null;
  countryBasis?: string | null;
}

export interface CompetitorStatus {
  firecrawl: { configured: boolean; homepage: string; creditsPerPage: number; env: string[] };
  storage: { supabase: boolean; env: string[] };
  cacheHours: number;
  maxUrls: number;
  products: CompetitorProduct[];
  storageError: string | null;
}

export type ItemStatus = 'OK' | 'CACHED' | 'BLOCKED' | 'NO_DATA' | 'ERROR' | 'SKIPPED' | 'INVALID';
export interface ItemResult {
  url: string;
  status: ItemStatus;
  message?: string;
  code?: string;
  product?: CompetitorProduct;
  stored?: boolean;
}
export interface CollectResult extends Omit<CompetitorStatus, 'products' | 'storageError'> {
  collectedAt: string;
  results: ItemResult[];
  creditsUsedEstimate: number;
}

export class CompetitorDataError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const NO_SERVER = '서버 API(/api/competitor-products)에 연결할 수 없습니다. Vercel 배포 또는 `npm run dev`로 실행 중인지 확인하세요.';
const isJson = (r: Response) => (r.headers.get('content-type') ?? '').includes('application/json');

export async function fetchCompetitorStatus(urls: string[]): Promise<CompetitorStatus> {
  let r: Response;
  try {
    r = await fetch(`/api/competitor-products${urls.length ? `?urls=${encodeURIComponent(urls.join(','))}` : ''}`, { headers: { accept: 'application/json' } });
  } catch {
    throw new CompetitorDataError('NO_SERVER', NO_SERVER);
  }
  if (!r.ok || !isJson(r)) throw new CompetitorDataError('NO_SERVER', NO_SERVER);
  return (await r.json()) as CompetitorStatus;
}

export async function collectCompetitors(urls: string[], refresh = false): Promise<CollectResult> {
  let r: Response;
  try {
    r = await fetch('/api/competitor-products', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ urls, refresh }) });
  } catch {
    throw new CompetitorDataError('NO_SERVER', NO_SERVER);
  }
  if (!isJson(r)) throw new CompetitorDataError('NO_SERVER', NO_SERVER);
  const body = (await r.json()) as CollectResult & { error?: string; message?: string };
  if (!r.ok) throw new CompetitorDataError(body.error ?? 'ERROR', body.message ?? '수집에 실패했습니다.');
  return body;
}

/** one URL per line or comma; http(s) only, de-duplicated */
export const parseUrlList = (text: string) => [...new Set(text.split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^https?:\/\/\S+\.\S+/i.test(s)))];

// ── Auto discovery (/api/competitor-discovery) ──────────────────────────────

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

export interface DiscoveryStatus {
  firecrawl: { configured: boolean };
  storage: { supabase: boolean };
  costs: { perSearch10: number; perProduct: number; freeMonthly: number };
  usage: { total: number; search: number; scrape: number } | null;
  usageError: string | null;
  locations: Record<string, string>;
}

export interface Candidate {
  url: string;
  domain: string;
  title: string;
  description: string;
  query: string;
  /** rule-based relevance estimate 0-100 from the search title/description (not market share, not sales rank) */
  score: number;
  matches: { category: boolean; benefit: boolean; ingredient: boolean; target: boolean; market: boolean };
  excluded: string | null;
  robots?: string;
}

export interface DiscoveryResult {
  market: string;
  location: string;
  queries: string[];
  runs: { query: string; fromCache: boolean; results: number; credits: number; searchedAt: string }[];
  creditsUsed: number;
  candidates: Candidate[];
  allowedCount: number;
  unchecked: number;
  scoreNote: string;
  warnings: string[];
}

const NO_DISCOVERY = '서버 API(/api/competitor-discovery)에 연결할 수 없습니다. Vercel 배포 또는 `npm run dev`로 실행 중인지 확인하세요.';

export async function fetchDiscoveryStatus(): Promise<DiscoveryStatus> {
  let r: Response;
  try {
    r = await fetch('/api/competitor-discovery', { headers: { accept: 'application/json' } });
  } catch {
    throw new CompetitorDataError('NO_SERVER', NO_DISCOVERY);
  }
  if (!r.ok || !isJson(r)) throw new CompetitorDataError('NO_SERVER', NO_DISCOVERY);
  return (await r.json()) as DiscoveryStatus;
}

export async function discoverCompetitors(body: { attributes: IdeaAttributes; market: string; queries: string[]; limit: number; refresh?: boolean }): Promise<DiscoveryResult> {
  let r: Response;
  try {
    r = await fetch('/api/competitor-discovery', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new CompetitorDataError('NO_SERVER', NO_DISCOVERY);
  }
  if (!isJson(r)) throw new CompetitorDataError('NO_SERVER', NO_DISCOVERY);
  const out = (await r.json()) as DiscoveryResult & { error?: string; message?: string };
  if (!r.ok) throw new CompetitorDataError(out.error ?? 'ERROR', out.message ?? '검색에 실패했습니다.');
  return out;
}

// ── Exchange rates (/api/fx-rates) ──────────────────────────────────────────

export interface FxRates {
  quote: 'KRW';
  rates: Record<string, { rate: number; date: string }>;
  missing: string[];
  source: string;
  sourceUrl: string;
}

export async function fetchFxRates(currencies: string[]): Promise<FxRates> {
  const r = await fetch(`/api/fx-rates?currencies=${encodeURIComponent(currencies.join(','))}`, { headers: { accept: 'application/json' } });
  if (!r.ok || !isJson(r)) throw new CompetitorDataError('NO_SERVER', '환율 API(/api/fx-rates)에 연결할 수 없습니다.');
  return (await r.json()) as FxRates;
}
