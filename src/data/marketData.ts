/**
 * Client for the real market data API (/api/market-data). Kept separate from the demo
 * `dataSource`: these values come from an external source and are never mixed with mock data.
 * When the call fails the caller gets an error; nothing falls back to demo numbers.
 */
import type { Project } from './types';
import { signals } from '@/lib/spec';

export interface MarketObservation {
  id: string;
  sourceName: string;
  sourceUrl: string;
  country: string;
  category: string;
  keyword: string | null;
  metricName: string;
  dimension: string;
  metricValue: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  collectedAt: string;
  publishedAt: string | null;
  dataType: 'COLLECTED';
  verificationStatus: string;
}

export interface Statement {
  id: string;
  text: string;
  observationIds: string[];
  dataType: 'COMPUTED' | 'AI_GENERATED';
  kind?: string;
}

export interface SourceMeta {
  id: string;
  name: string;
  url: string;
  docsUrl: string;
  country: string;
  unit: string;
  metrics: Record<string, string>;
  caution: string;
}

export interface MarketQueryInput {
  category: string;
  categoryCode: string;
  keywords: string[];
  months: number;
}

export interface MarketDataResult {
  status: 'OK' | 'NO_DATA';
  source: SourceMeta;
  query: { country: string; category: string; categoryCode: string; keywords: string[]; startDate: string; endDate: string; timeUnit: string };
  queryHash: string;
  fetchedAt: string;
  fromCache: 'memory' | 'database' | null;
  stale: boolean;
  error?: string;
  message?: string;
  observations: MarketObservation[];
  rejected: number;
  calls: number;
  storage: 'saved' | 'not_configured' | 'error';
  warnings: string[];
  findings: { statements: Statement[]; gaps: string[] };
  narrative: { status: 'OK' | 'NO_API_KEY' | 'NO_DATA' | 'ERROR'; model: string | null; statements: Statement[]; dropped: number; message?: string };
}

export interface SourceInfo {
  id: string;
  name: string;
  homepage: string;
  status: 'connected' | 'not_configured' | 'planned';
  description: string;
  env: string[];
  costNote: string;
}

export interface MarketDataStatus {
  sources: SourceInfo[];
  storage: { supabase: boolean };
  ai: { configured: boolean };
  source: SourceMeta;
}

export class MarketDataError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const isJson = (r: Response) => (r.headers.get('content-type') ?? '').includes('application/json');
const NO_SERVER = '서버 API(/api/market-data)에 연결할 수 없습니다. Vercel 배포 또는 `npm run dev`로 실행 중인지 확인하세요.';

export async function fetchMarketStatus(): Promise<MarketDataStatus> {
  let r: Response;
  try {
    r = await fetch('/api/market-data', { headers: { accept: 'application/json' } });
  } catch {
    throw new MarketDataError('NO_SERVER', NO_SERVER);
  }
  if (!r.ok || !isJson(r)) throw new MarketDataError('NO_SERVER', NO_SERVER);
  return (await r.json()) as MarketDataStatus;
}

/** one in-flight / finished request per query, so Market, Consumer and Trend share a single API call */
const cache = new Map<string, Promise<MarketDataResult>>();

export function fetchMarketData(input: MarketQueryInput & { idea?: string }, opts: { refresh?: boolean } = {}): Promise<MarketDataResult> {
  const key = JSON.stringify([input.category, input.categoryCode, input.keywords, input.months]);
  const existing = cache.get(key);
  if (existing && !opts.refresh) return existing;
  const p = (async () => {
    let r: Response;
    try {
      r = await fetch('/api/market-data', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ ...input, refresh: opts.refresh === true }) });
    } catch {
      throw new MarketDataError('NO_SERVER', NO_SERVER);
    }
    if (!isJson(r)) throw new MarketDataError('NO_SERVER', NO_SERVER);
    const j = (await r.json()) as MarketDataResult & { error?: string; message?: string };
    if (!r.ok) throw new MarketDataError(j.error ?? 'ERROR', j.message ?? `서버 오류 (${r.status})`);
    return j;
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

const clean = (s: string | undefined) => (s ?? '').replace(/\(.*?\)/g, '').trim();

/**
 * Starting keywords from the project: product type, benefit + type, key ingredients.
 * The user can edit them on screen before collecting.
 */
export function defaultMarketQuery(p: Project): MarketQueryInput {
  const e = p.blueprint?.entries ?? {};
  const val = (k: string) => clean(e[k]?.origin === 'UNDETERMINED' ? '' : e[k]?.value);
  const s = signals(p);
  const category = val('category') || clean(p.spec.category?.value[0]) || clean(p.intake.category.value.split(/[·/]/)[0]) || '스킨케어';
  const type = (val('productType') || clean(p.spec.subtype?.value[0]) || '').split('/')[0].trim();
  const benefits = (val('benefits') || p.spec.benefits?.value.join(',') || clean(p.intake.benefit.value))
    .split(/[,·/]/)
    .map((x) => x.trim())
    .filter(Boolean);
  const ingredients = [...(val('hero') ? val('hero').split(',') : []), ...s.mustInclude].map((x) => clean(x)).filter((x) => x && x.length <= 20);
  const kw = [type, benefits[0] && type ? `${benefits[0]} ${type}` : benefits[0], ...ingredients, benefits[1]].filter((x): x is string => !!x && x.length <= 40);
  return { category, categoryCode: '50000002', keywords: [...new Set(kw)].slice(0, 5), months: 12 };
}

/** Same starting keywords, read from a Product Blueprint alone (the screen before a project exists). */
export function queryFromBlueprint(bp: { entries: Record<string, { value: string; origin: string }> }): MarketQueryInput {
  const val = (k: string) => clean(bp.entries[k]?.origin === 'UNDETERMINED' ? '' : bp.entries[k]?.value);
  const category = val('category') || '스킨케어';
  const type = val('productType').split('/')[0].trim();
  const benefits = val('benefits').split(/[,·/]/).map((x) => x.trim()).filter(Boolean);
  const ingredients = val('hero').split(',').map((x) => clean(x)).filter((x) => x && x.length <= 20);
  const kw = [type, benefits[0] && type ? `${benefits[0]} ${type}` : benefits[0], ...ingredients, benefits[1]].filter((x): x is string => !!x && x.length <= 40);
  return { category, categoryCode: '50000002', keywords: [...new Set(kw)].slice(0, 5), months: 12 };
}
