import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'bi.chunk-reload';

/** Factories of every lazily loaded route, so they can be prefetched after the first screen is shown. */
const factories: (() => Promise<unknown>)[] = [];

/**
 * React.lazy with recovery for stale deployments: when a new version is deployed,
 * an already-open tab may request chunk files that no longer exist. In that case
 * reload the page once to pick up the new index.html instead of rendering a blank screen.
 */
export function lazyWithRetry<T extends ComponentType<object>>(factory: () => Promise<{ default: T }>) {
  factories.push(() => factory().catch(() => undefined));
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* ignore */
      }
      return mod;
    } catch (err) {
      let reloaded = false;
      try {
        reloaded = sessionStorage.getItem(RELOAD_KEY) === '1';
        if (!reloaded) sessionStorage.setItem(RELOAD_KEY, '1');
      } catch {
        /* ignore */
      }
      if (!reloaded) {
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

/**
 * Download every route chunk in the background once the browser is idle, so that
 * sidebar / tab navigation renders the next screen immediately instead of waiting
 * on the network.
 */
export function prefetchRoutes() {
  const run = () => factories.forEach((f) => void f());
  if (typeof window === 'undefined') return;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 2500 });
  else window.setTimeout(run, 1200);
}
