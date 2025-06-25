import { storage } from './storage';
import { sendPriceAlertEmail } from './emailService';

interface PriceData {
  symbol: string;
  currentPrice: number;
}

// Mock price data for demo - in production, connect to real market data API
const getCurrentPrices = async (symbols: string[]): Promise<PriceData[]> => {
  const mockPrices: Record<string, number> = {
    'TSLA': 248.50,
    'GOOGL': 185.20,
    'CVS': 69.15,
    'MSFT': 445.80,
    'AVGO': 182.45,
    'AMD': 140.25,
    'NVDA': 149.80,
    'BAC': 45.20,
    'ASST': 12.35
  };

  return symbols.map(symbol => ({
    symbol,
    currentPrice: mockPrices[symbol] || 100.00
  }));
};

export async function monitorActiveTrades(): Promise<void> {
  try {
    const activeTrades = await storage.getActiveTrades();
    
    if (activeTrades.length === 0) {
      return;
    }

    const symbols = activeTrades.map(trade => trade.symbol);
    const currentPrices = await getCurrentPrices(symbols);

    for (const trade of activeTrades) {
      const priceData = currentPrices.find(p => p.symbol === trade.symbol);
      
      if (!priceData) continue;

      const currentPrice = priceData.currentPrice;
      const entryPrice = Number(trade.entryPrice);
      const stopLoss = Number(trade.stopLoss);
      const profitTarget = trade.profitTarget ? Number(trade.profitTarget) : null;

      let shouldClose = false;
      let exitReason = '';
      let exitPrice = currentPrice;

      // Check for stop loss hit
      if (currentPrice <= stopLoss) {
        shouldClose = true;
        exitReason = 'stop_loss';
        exitPrice = stopLoss;
      }
      // Check for profit target hit
      else if (profitTarget && currentPrice >= profitTarget) {
        shouldClose = true;
        exitReason = 'profit_target';
        exitPrice = profitTarget;
      }

      if (shouldClose) {
        // Calculate P&L
        const pnl = (exitPrice - entryPrice) * Number(trade.shares);
        
        // Close the trade
        await storage.updateTrade(trade.id, {
          status: 'closed',
          exitReason,
          exitPrice: exitPrice.toString(),
          exitDate: new Date(),
          pnl: pnl.toString()
        });

        // Send notification email
        try {
          await sendPriceAlertEmail({
            to: 'tfrei320@gmail.com',
            symbol: trade.symbol,
            currentPrice: exitPrice,
            targetPrice: exitReason === 'stop_loss' ? stopLoss : profitTarget!,
            alertType: exitReason === 'stop_loss' ? 'breakdown' : 'breakout',
            changePercent: ((exitPrice - entryPrice) / entryPrice) * 100
          });
          
          console.log(`Trade closed: ${trade.symbol} ${exitReason} at $${exitPrice.toFixed(2)}, P&L: $${pnl.toFixed(2)}`);
        } catch (emailError) {
          console.error('Failed to send trade closure email:', emailError);
        }
      }
    }
  } catch (error) {
    console.error('Error monitoring trades:', error);
  }
}

// Start monitoring trades every 30 seconds
export function startTradeMonitoring(): NodeJS.Timeout {
  console.log('Starting trade monitoring system...');
  return setInterval(monitorActiveTrades, 30000); // Check every 30 seconds
}