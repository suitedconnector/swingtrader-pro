import { storage } from './storage';
import { sendPriceAlertEmail } from './emailService';
import { getDailyBars, marketDate, type DailyBar } from './priceCache';
import type { PriceAlert, User } from '../shared/schema';

// Check active trades and price alerts every 30 seconds; the next cycle is
// scheduled only after the current one finishes, so cycles never overlap.
// Prices come from the shared daily cache (api/priceCache.ts), so each
// symbol costs at most one provider request per New York trading date.
const MONITOR_INTERVAL_MS = 30_000;

interface DailyClose {
  price: number;
  barDate: string; // YYYY-MM-DD trading day of the bar, in New York time
}

// Completed daily bars only: any bar dated today (New York time) is ignored,
// even after the close, so an unfinished bar is never used.
function completedBars(bars: DailyBar[], today: string): DailyBar[] {
  return bars.filter((bar) => bar.barDate < today);
}

// The close of each symbol's most recent completed bar. Symbols without a
// valid price are left out, so their trades are skipped for this cycle
// instead of being closed.
async function getCurrentPrices(symbols: string[]): Promise<Map<string, DailyClose>> {
  const prices = new Map<string, DailyClose>();
  const today = marketDate(new Date());

  for (const symbol of Array.from(new Set(symbols))) {
    const bars = await getDailyBars(symbol);
    if (!bars) continue; // lookup failed; logged by the price cache
    const completed = completedBars(bars, today);
    const latest = completed[completed.length - 1];
    if (!latest) {
      console.error(`Trade monitor: no completed daily bar for ${symbol}; skipping this quote.`);
      continue;
    }
    prices.set(symbol, { price: latest.close, barDate: latest.barDate });
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

const round2 = (n: number) => Math.round(n * 100) / 100;

// Fire price alerts set on the Alerts page. A breakout fires when a completed
// day's HIGH reaches the target, a breakdown when its LOW reaches it. Only
// days on or after the day the alert was created count. Each alert fires
// once: it is switched off and its fired date and price are saved before the
// email goes out, so a failed email never causes a repeat.
export async function checkPriceAlerts(): Promise<void> {
  const alerts = await storage.getAllActivePriceAlerts();
  if (alerts.length === 0) return;

  const today = marketDate(new Date());
  const owners = new Map<number, User | undefined>();

  for (const alert of alerts) {
    try {
      const target = Number(alert.targetPrice);
      const type = alert.alertType;
      if (!Number.isFinite(target) || target <= 0 || (type !== 'breakout' && type !== 'breakdown')) {
        console.error(`Alert checker: invalid alert ${alert.id} (${alert.symbol}); skipping.`);
        continue;
      }

      const bars = await getDailyBars(alert.symbol);
      if (!bars) continue; // lookup failed; logged by the price cache

      const since = alert.createdAt ? marketDate(new Date(alert.createdAt)) : '';
      const completed = completedBars(bars, today);
      const index = completed.findIndex(
        (bar) => bar.barDate >= since && (type === 'breakout' ? bar.high >= target : bar.low <= target)
      );
      if (index === -1) continue;

      const bar = completed[index];
      const trigger = type === 'breakout' ? bar.high : bar.low;
      const fired = await markFired(alert, trigger, bar);
      if (!fired) continue; // already fired or deleted meanwhile

      console.log(
        `Alert checker: ${alert.symbol} ${type} alert ${alert.id} fired at $${trigger.toFixed(2)} (target $${target.toFixed(2)}, bar ${bar.barDate})`
      );

      if (!owners.has(alert.userId)) owners.set(alert.userId, await storage.getUser(alert.userId));
      const owner = owners.get(alert.userId);
      if (!owner?.email || owner.emailAlerts === false) continue;

      const prev = index > 0 ? completed[index - 1] : undefined;
      const changePercent = prev && prev.close > 0 ? ((bar.close - prev.close) / prev.close) * 100 : 0;
      try {
        await sendPriceAlertEmail({
          to: owner.email,
          symbol: alert.symbol,
          currentPrice: round2(trigger),
          targetPrice: round2(target),
          alertType: type,
          changePercent,
        });
      } catch (emailError) {
        console.error(`Alert checker: failed to send email for alert ${alert.id}:`, emailError);
      }
    } catch (error) {
      console.error(`Alert checker: error processing alert ${alert.id}:`, error);
    }
  }
}

function markFired(alert: PriceAlert, trigger: number, bar: DailyBar) {
  // firedAt is the start of the trading day that crossed the level.
  return storage.markPriceAlertFired(alert.id, trigger.toFixed(2), new Date(bar.date));
}

export function startTradeMonitoring(): void {
  console.log('Starting trade monitoring system...');

  const run = async () => {
    try {
      await monitorActiveTrades();
    } catch (error) {
      console.error('Trade monitor: unexpected error in monitoring cycle:', error);
    }
    try {
      await checkPriceAlerts();
    } catch (error) {
      console.error('Alert checker: unexpected error in monitoring cycle:', error);
    } finally {
      setTimeout(run, MONITOR_INTERVAL_MS);
    }
  };

  run();
}
