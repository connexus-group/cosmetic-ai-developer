/**
 * Client for /api/trade-data — Korea's cosmetics exports by destination (UN Comtrade, free, no key).
 * Errors are thrown; nothing falls back to demo values.
 */
import { MarketDataError, type MarketObservation, type Statement } from './marketData';

export interface TradeMarket {
  key: string;
  label: string;
  value: number | null;
  share: number | null;
  rank: number | null;
  change: number | null;
  members: number;
  reported: number;
  ids: string[];
}

export interface TradeResult {
  status: 'OK' | 'NO_DATA';
  source: { id: string; name: string; url: string; country: string; unit: string; hs: string; hsLabel: string; definition: string };
  fetchedAt: string;
  fromCache: 'memory' | 'database' | null;
  storage: 'saved' | 'not_configured' | 'error';
  years: number[];
  latest?: number;
  prev?: number;
  statements: Statement[];
  gaps: string[];
  markets: TradeMarket[];
  top: { rank: number; code: number; name: string; value: number; share: number; change: number | null; ids: string[] }[];
  unmatchedMarkets: string[];
  observations: MarketObservation[];
  warnings: string[];
}

const cache = new Map<string, Promise<TradeResult>>();
const NO_SERVER = '서버 API(/api/trade-data)에 연결할 수 없습니다. Vercel 배포 또는 `npm run dev`로 실행 중인지 확인하세요.';

export function fetchTradeData(category: string, markets: string[], opts: { refresh?: boolean } = {}): Promise<TradeResult> {
  const key = JSON.stringify([category, [...markets].sort()]);
  const hit = cache.get(key);
  if (hit && !opts.refresh) return hit;
  const p = (async () => {
    let r: Response;
    try {
      r = await fetch('/api/trade-data', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ category, markets, refresh: opts.refresh === true }) });
    } catch {
      throw new MarketDataError('NO_SERVER', NO_SERVER);
    }
    if (!(r.headers.get('content-type') ?? '').includes('application/json')) throw new MarketDataError('NO_SERVER', NO_SERVER);
    const j = (await r.json()) as TradeResult & { error?: string; message?: string };
    if (!r.ok) throw new MarketDataError(j.error ?? 'ERROR', j.message ?? `서버 오류 (${r.status})`);
    return j;
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

/** US$ → "15.5억 달러" / "7.3백만 달러" */
export const fmtUsd = (n: number) => (n >= 1e8 ? `${(Math.round(n / 1e7) / 10).toLocaleString()}억 달러` : `${(Math.round(n / 1e5) / 10).toLocaleString()}백만 달러`);
