/**
 * GET /api/fx-rates?currencies=USD,JPY — exchange rates to KRW with their reference date.
 *
 * Source: Frankfurter (https://frankfurter.dev), a free public API built on central-bank reference
 * rates; no key, no charge. Cached in Supabase (fx_rates) per day when storage is configured.
 * A currency whose rate cannot be fetched is returned as missing, never guessed.
 * Env (tests only): FX_BASE_URL (default https://api.frankfurter.dev/v2).
 */
import * as db from './_lib/supabase.js';

export const http = { fetch: (url: string, init: RequestInit) => fetch(url, init) };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const base = () => (process.env.FX_BASE_URL?.trim() || 'https://api.frankfurter.dev/v2').replace(/\/+$/, '');
const SOURCE = 'Frankfurter (중앙은행 기준환율)';
const memory = new Map<string, { rate: number; date: string }>();

export async function GET(request: Request) {
  const want = [...new Set((new URL(request.url).searchParams.get('currencies') ?? '').toUpperCase().split(',').map((c) => c.trim()).filter((c) => /^[A-Z]{3}$/.test(c) && c !== 'KRW'))].slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const rates: Record<string, { rate: number; date: string }> = { KRW: { rate: 1, date: today } };
  const missing: string[] = [];
  for (const cur of want) {
    const mk = `${cur}|${today}`;
    const hit = memory.get(mk);
    if (hit) {
      rates[cur] = hit;
      continue;
    }
    if (db.supabaseConfigured()) {
      const saved = await db.loadFx(cur, today).catch(() => null);
      if (saved) {
        rates[cur] = { rate: saved.rate, date: saved.rate_date };
        memory.set(mk, rates[cur]);
        continue;
      }
    }
    try {
      const r = await http.fetch(`${base()}/rates?base=${cur}&quotes=KRW`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
      const body = (await r.json().catch(() => null)) as { date?: string; quote?: string; rate?: number }[] | null;
      const row = Array.isArray(body) ? body.find((x) => x.quote === 'KRW') : null;
      if (!r.ok || !row || typeof row.rate !== 'number' || !row.date) throw new Error('no rate');
      rates[cur] = { rate: row.rate, date: row.date };
      memory.set(mk, rates[cur]);
      if (db.supabaseConfigured()) await db.saveFx({ base: cur, quote: 'KRW', rate: row.rate, rate_date: row.date, fetched_on: today, source: SOURCE }).catch(() => undefined);
    } catch {
      missing.push(cur);
    }
  }
  return json(200, { quote: 'KRW', rates, missing, source: SOURCE, sourceUrl: 'https://frankfurter.dev' });
}
