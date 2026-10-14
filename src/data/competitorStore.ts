import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { fetchCompetitorStatus, type CompetitorProduct } from './competitorProducts';

/**
 * Collected competitor products shared between the Competitors screen (collection, discovery,
 * comparison) and the Overview / Concept evidence panels. Holds only rows returned by
 * /api/competitor-products (Firecrawl → Supabase), never demo competitors.
 */
const byId = new Map<string, CompetitorProduct>();
let version = 0;
const listeners = new Set<() => void>();
const loaded = new Set<string>();

export function publishProducts(list: CompetitorProduct[]) {
  if (!list.length) return;
  for (const p of list) byId.set(p.id, p);
  version++;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** same rule as the server (api/_lib/product.ts normalizeUrl): no fragment, no tracking params */
export function cleanUrl(raw: string) {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|n_media$|n_query$)/i.test(k)) u.searchParams.delete(k);
    return u.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}
export const sameUrl = (a: string, b: string) => cleanUrl(a) === cleanUrl(b);

/**
 * Products for the project's URL list. When `load` is set and nothing for these URLs is in memory
 * yet, the stored rows are read from Supabase once (no Firecrawl call, no credits).
 */
export function useCollectedProducts(urls: string[] | undefined, load = false) {
  const v = useSyncExternalStore(subscribe, () => version);
  const key = (urls ?? []).join('\n');
  useEffect(() => {
    if (!load || !key || loaded.has(key)) return;
    loaded.add(key);
    fetchCompetitorStatus(key.split('\n')).then(
      (s) => publishProducts(s.products),
      () => loaded.delete(key),
    );
  }, [key, load]);
  return useMemo(() => {
    const list = key ? key.split('\n') : [];
    return [...byId.values()].filter((p) => list.some((u) => sameUrl(u, p.url))).sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, v]);
}
