import { getHistoricalAggregates } from './massiveService';

// One place for every daily-price lookup on the server (watchlist prices,
// the Alerts and Trade Planner lookups, the Exit dialog, Overview market data,
// the trade monitor and the alert checker).
//
// - Cache: daily bars per symbol, kept for the rest of the New York trading
//   date. The provider only publishes a day's bar after it ends, so the bars
//   cannot change during the day.
// - Queue: the price provider allows 5 requests a minute on this plan. Extra
//   lookups wait for a free slot instead of failing.
// - A failed lookup is not retried for a few minutes, so a bad symbol cannot
//   use up the limit.

const MARKET_TIME_ZONE = 'America/New_York';
const LOOKBACK_DAYS = 10; // covers weekends and market holidays
const CALLS_PER_WINDOW = 5;
const WINDOW_MS = 60_000;
const FAILURE_RETRY_MS = 5 * 60_000;

export interface DailyBar {
  barDate: string; // YYYY-MM-DD trading day, New York time
  date: string; // bar start as an ISO timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// YYYY-MM-DD for the given instant, in New York (exchange) time.
export function marketDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MARKET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// ---- Rate-limit queue ----------------------------------------------------

const callTimes: number[] = [];
let queue: Promise<void> = Promise.resolve();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Resolves when a request may be sent. Calls take slots in arrival order.
function takeSlot(): Promise<void> {
  const slot = queue.then(async () => {
    for (;;) {
      const now = Date.now();
      while (callTimes.length > 0 && now - callTimes[0] >= WINDOW_MS) callTimes.shift();
      if (callTimes.length < CALLS_PER_WINDOW) {
        callTimes.push(now);
        return;
      }
      await sleep(callTimes[0] + WINDOW_MS - now + 50);
    }
  });
  queue = slot;
  return slot;
}

// ---- Cache ---------------------------------------------------------------

const cache = new Map<string, { day: string; bars: DailyBar[] }>();
const retryAfter = new Map<string, number>();
const inflight = new Map<string, Promise<DailyBar[] | null>>();

/**
 * Recent daily bars for a symbol, oldest first, possibly including a bar for
 * today. Returns null when the provider fails or has no bars; never throws.
 */
export function getDailyBars(symbol: string): Promise<DailyBar[] | null> {
  const s = symbol.toUpperCase();
  const today = marketDate(new Date());

  const hit = cache.get(s);
  if (hit && hit.day === today) return Promise.resolve(hit.bars);

  const wait = retryAfter.get(s);
  if (wait !== undefined && Date.now() < wait) return Promise.resolve(null);

  const running = inflight.get(s);
  if (running) return running;

  const lookup = (async (): Promise<DailyBar[] | null> => {
    try {
      const apiKey = process.env.MASSIVE_API_KEY;
      if (!apiKey) {
        console.error('Price lookup skipped: MASSIVE_API_KEY is not configured.');
        return null;
      }
      await takeSlot();
      const end = new Date();
      const start = new Date(end.getTime() - LOOKBACK_DAYS * 86_400_000);
      const raw = await getHistoricalAggregates(s, apiKey, marketDate(start), marketDate(end));
      const bars: DailyBar[] = (Array.isArray(raw) ? raw : [])
        .map((b: any) => ({
          barDate: marketDate(new Date(b.date)),
          date: String(b.date),
          open: Number(b.open),
          high: Number(b.high),
          low: Number(b.low),
          close: Number(b.close),
          volume: Number(b.volume),
        }))
        .filter((b) => [b.high, b.low, b.close].every((v) => Number.isFinite(v) && v > 0));
      if (bars.length === 0) throw new Error(`No daily bars for ${s}`);
      // Drop entries from earlier dates so the cache does not grow forever.
      cache.forEach((entry, key) => {
        if (entry.day !== today) cache.delete(key);
      });
      cache.set(s, { day: today, bars });
      retryAfter.delete(s);
      console.log(`Price lookup: ${s} ${bars.length} daily bars, latest ${bars[bars.length - 1].barDate} (cached for ${today})`);
      return bars;
    } catch (err) {
      console.error(`Price lookup failed for ${s}:`, err instanceof Error ? err.message : err);
      retryAfter.set(s, Date.now() + FAILURE_RETRY_MS);
      return null;
    }
  })();

  // Registered after creation and removed when done (lookup never rejects).
  inflight.set(s, lookup);
  lookup.then(() => inflight.delete(s));
  return lookup;
}
