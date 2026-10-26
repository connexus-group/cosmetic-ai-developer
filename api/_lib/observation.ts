/**
 * One collected data point. Mirrors the `market_observations` table (supabase/migrations).
 *
 * Collected values (dataType COLLECTED) and AI-written text (see `AiStatement`, table
 * `ai_analyses`) are kept in separate types and tables so an AI sentence can never be
 * stored or shown as a measured value.
 */
import { createHash } from 'node:crypto';

export type VerificationStatus = 'OFFICIAL_SOURCE' | 'UNVERIFIED' | 'REJECTED';

export interface Observation {
  /** deterministic: same source + query + metric + period → same id, so re-collection upserts */
  id: string;
  sourceName: string;
  sourceUrl: string;
  country: string;
  category: string;
  keyword: string | null;
  metricName: string;
  /** e.g. "all", "age:20", "gender:f" */
  dimension: string;
  metricValue: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  collectedAt: string;
  publishedAt: string | null;
  dataType: 'COLLECTED';
  verificationStatus: VerificationStatus;
  /** observations are only comparable within one query (relative indexes); this ties them together */
  queryHash: string;
}

export const hash = (s: string, len = 16) => createHash('sha256').update(s).digest('hex').slice(0, len);

export function observationId(o: Pick<Observation, 'sourceName' | 'queryHash' | 'metricName' | 'dimension' | 'keyword' | 'periodStart'>) {
  return `obs_${hash([o.sourceName, o.queryHash, o.metricName, o.dimension, o.keyword ?? '', o.periodStart].join('|'))}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Data Validation step of the pipeline. Rejects anything that is not a finite number with a
 * real period and source; never repairs a value by guessing.
 */
export function validateObservation(o: Observation): string | null {
  if (!o.sourceName || !/^https:\/\//.test(o.sourceUrl)) return 'source';
  if (!o.metricName || !o.unit) return 'metric';
  if (typeof o.metricValue !== 'number' || !Number.isFinite(o.metricValue)) return 'value';
  if (!DATE.test(o.periodStart) || !DATE.test(o.periodEnd) || o.periodStart > o.periodEnd) return 'period';
  if (Number.isNaN(Date.parse(o.collectedAt))) return 'collectedAt';
  if (o.dataType !== 'COLLECTED') return 'dataType';
  return null;
}

export function validateAll(list: Observation[]) {
  const valid: Observation[] = [];
  const rejected: { id: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const o of list) {
    const reason = validateObservation(o) ?? (seen.has(o.id) ? 'duplicate' : null);
    if (reason) rejected.push({ id: o.id, reason });
    else {
      seen.add(o.id);
      valid.push(o);
    }
  }
  return { valid, rejected };
}

/** A sentence in an analysis. Every statement names the observation ids it is based on. */
export interface AiStatement {
  id: string;
  text: string;
  observationIds: string[];
  /** COMPUTED: arithmetic over collected values by the analysis engine · AI_GENERATED: written by the AI model */
  dataType: 'COMPUTED' | 'AI_GENERATED';
}
