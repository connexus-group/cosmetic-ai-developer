import type { Observation } from '../observation.js';

/** What the user asked about. Every adapter maps this onto its own API. */
export interface MarketQuery {
  /** two-letter country code, e.g. KR */
  country: string;
  /** product category label (e.g. 스킨케어) */
  category: string;
  /** source-specific category code (Naver shopping cat_id, HS code, ...) */
  categoryCode?: string;
  /** search terms: product type, benefit, ingredient */
  keywords: string[];
  startDate: string;
  endDate: string;
  timeUnit: 'date' | 'week' | 'month';
}

/**
 * - connected: implemented and its server credentials are set
 * - not_configured: implemented, but credentials are missing
 * - planned: interface slot only; not implemented, never shown as connected
 */
export type AdapterStatus = 'connected' | 'not_configured' | 'planned';

export interface AdapterInfo {
  id: string;
  name: string;
  homepage: string;
  status: AdapterStatus;
  /** what the source measures, in plain words */
  description: string;
  /** env vars the server needs */
  env: string[];
  /** cost or quota the user should know about */
  costNote: string;
}

export class AdapterError extends Error {
  constructor(
    readonly code: 'NOT_CONFIGURED' | 'AUTH' | 'RATE_LIMIT' | 'BAD_REQUEST' | 'UPSTREAM' | 'NETWORK',
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface FetchResult {
  observations: Observation[];
  /** number of upstream API calls made (quota accounting) */
  calls: number;
  /** partial failures that did not stop the whole query */
  warnings: string[];
}

/** Common interface every external data source implements. */
export interface DataAdapter {
  info(): AdapterInfo;
  fetch(query: MarketQuery, queryHash: string): Promise<FetchResult>;
}
