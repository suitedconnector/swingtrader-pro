import { storage } from './storage';
import { sendPriceAlertEmail } from './emailService';
import { getHistoricalAggregates } from './massiveService';

// Check active trades every 30 seconds; the next cycle is scheduled only
// after the current one finishes, so cycles never overlap.
const MONITOR_INTERVAL_MS = 30_000;

// How far back to look for the latest completed daily bar. Ten calendar days
// covers weekends and market holidays.
const LOOKBACK_DAYS = 10;

const MARKET_TIME_ZONE = 'America/New_York';

interface DailyClose {
  price: number;
  barDate: string; // YYYY-MM-DD trading day of the bar, in New York time
}

// YYYY-MM-DD for the given instant, in New York (exchange) time.
function marketDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MARKET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Fetch each unique symbol once and use the close of the most recent
// COMPLETED daily bar: any bar dated today (New York time) is ignored, even
// after the close, so an unfinished bar is never used. Symbols without a
// valid price are left out, so their trades are skipped for this cycle
// instead of being closed.
async function getCurrentPrices(symbols: string[]): Promise<Map<string, DailyClose>> {
  const prices = new Map<string, DailyClose>();
  const apiKey = process.env.MASSIVE_API_KEY;

  if (!apiKey) {
    console.error('Trade monitor: MASSIVE_API_KEY is not configured; skipping this cycle.');
    return prices;
  }

  const now = new Date();
  const today = marketDate(now);
  const start = marketDate(new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));

  for (const symbol of Array.from(new Set(symbols))) {
    try {
      const bars = await getHistoricalAggregates(symbol, apiKey, start, today);

      const completed = bars
        .map((bar: { date: string; close: number }) => ({
          barDate: marketDate(new Date(bar.date)),
          price: Number(bar.close),
        }))
        .filter((bar: DailyClose) => bar.barDate < today);

      const latest = completed[completed.length - 1];

      if (!latest || !Number.isFinite(latest.price) || latest.price <= 0) {
        console.error(`Trade monitor: no valid completed daily bar for ${symbol}; skipping this quote.`);
        continue;
      }

      console.log(
        `Trade monitor: ${symbol} close $${latest.price.toFixed(2)} from completed daily bar ${latest.barDate}`
      );
      prices.set(symbol, latest);
    } catch (error) {
      console.error(`Trade monitor: could not get a price for ${symbol}; skipping this quote:`, error);
    }
  }

  return prices;
}

export async function monitorActiveTrades(): Promise<void> {
  const activeTrades = await storage.getAllActiveTrades();
  if (activeTrades.length === 0) {
    return;
  }

  const currentPrices = await getCurrentPrices(activeTrades.map(trade => trade.symbol));

  for (const trade of activeTrades) {
    try {
      const quote = currentPrices.get(trade.symbol);
      if (quote === undefined) continue;
      const currentPrice = quote.price;

      const entryPrice = Number(trade.entryPrice);
      const stopLoss = Number(trade.stopLoss);
      const shares = Number(trade.shares);
      const profitTarget = trade.profitTarget != null && trade.profitTarget !== ''
        ? Number(trade.profitTarget)
        : null;

      // Never change trade status when required trade values are invalid.
      if (
        !Number.isFinite(entryPrice) || entryPrice <= 0 ||
        !Number.isFinite(stopLoss) || stopLoss <= 0 ||
        !Number.isFinite(shares) || shares <= 0 ||
        (profitTarget !== null && (!Number.isFinite(profitTarget) || profitTarget <= 0))
      ) {
        console.error(`Trade monitor: invalid trade values for ${trade.symbol}; skipping trade ${trade.id}.`);
        continue;
      }

      let exitReason: 'stop_loss' | 'profit_target' | null = null;
      let exitPrice = currentPrice;

      if (currentPrice <= stopLoss) {
        exitReason = 'stop_loss';
        exitPrice = stopLoss;
      } else if (profitTarget !== null && currentPrice >= profitTarget) {
        exitReason = 'profit_target';
        exitPrice = profitTarget;
      }

      if (!exitReason) continue;

      const pnl = (exitPrice - entryPrice) * shares;

      const closedTrade = await storage.updateTrade(trade.id, trade.userId, {
        status: 'closed',
        exitReason,
        exitPrice: exitPrice.toFixed(2),
        exitDate: new Date(),
        pnl: pnl.toFixed(2),
      });

      if (!closedTrade) {
        console.error(`Trade monitor: trade ${trade.id} was not updated; it may have been changed or removed.`);
        continue;
      }

      console.log(
        `Trade monitor: closed ${trade.symbol} (trade ${trade.id}) ${exitReason} at $${exitPrice.toFixed(2)}, P&L: $${pnl.toFixed(2)} (daily close $${currentPrice.toFixed(2)} from ${quote.barDate})`
      );

      // Notify the trade owner only if they have an email and alerts are on.
      const owner = await storage.getUser(trade.userId);
      if (owner?.email && owner.emailAlerts !== false) {
        try {
          await sendPriceAlertEmail({
            to: owner.email,
            symbol: trade.symbol,
            currentPrice: exitPrice,
            targetPrice: exitReason === 'stop_loss' ? stopLoss : (profitTarget as number),
            alertType: exitReason === 'stop_loss' ? 'breakdown' : 'breakout',
            changePercent: ((exitPrice - entryPrice) / entryPrice) * 100,
          });
        } catch (emailError) {
          console.error(`Trade monitor: failed to send closure email for trade ${trade.id}:`, emailError);
        }
      }
    } catch (error) {
      console.error(`Trade monitor: error processing trade ${trade.id}:`, error);
    }
  }
}

export function startTradeMonitoring(): void {
  console.log('Starting trade monitoring system...');

  const run = async () => {
    try {
      await monitorActiveTrades();
    } catch (error) {
      console.error('Trade monitor: unexpected error in monitoring cycle:', error);
    } finally {
      setTimeout(run, MONITOR_INTERVAL_MS);
    }
  };

  run();
}
