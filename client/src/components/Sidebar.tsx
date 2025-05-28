import { useQuery } from '@tanstack/react-query';
import type { MarketData } from '@/lib/types';
import type { Watchlist, PriceAlert, Trade } from '@shared/schema';

export function Sidebar() {
  const { data: marketData } = useQuery<MarketData>({
    queryKey: ['/api/market-data'],
  });

  const { data: watchlists = [] } = useQuery<Watchlist[]>({
    queryKey: ['/api/watchlists'],
  });

  const { data: priceAlerts = [] } = useQuery<PriceAlert[]>({
    queryKey: ['/api/price-alerts'],
    select: (data) => data.filter(alert => alert.isActive),
  });

  const { data: activeTrades = [] } = useQuery<Trade[]>({
    queryKey: ['/api/trades', { active: true }],
  });

  const focusList = watchlists.find(w => w.type === 'focus');
  const flaggedList = watchlists.find(w => w.type === 'flagged');

  const todaysPnL = activeTrades.reduce((total, trade) => {
    // In a real implementation, this would calculate current P&L based on current prices
    return total + 0; // Placeholder
  }, 0);

  const winRate = 75; // Placeholder - would be calculated from historical data
  const totalRiskUsed = activeTrades.reduce((total, trade) => total + Number(trade.riskAmount), 0);
  const accountBalance = 125486.32; // Would come from user settings
  const riskPercentUsed = (totalRiskUsed / accountBalance) * 100;

  return (
    <div className="space-y-6">
      {/* Market Status */}
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <i className="fas fa-chart-area text-trading-primary mr-2"></i>
          Market Status
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">SPY</span>
            <div className="text-right">
              <div className="text-sm font-mono">{marketData?.spy.price || '$428.45'}</div>
              <div className="text-xs text-trading-success">{marketData?.spy.change || '+0.85%'}</div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">NASDAQ</span>
            <div className="text-right">
              <div className="text-sm font-mono">{marketData?.nasdaq.price || '$15,234'}</div>
              <div className="text-xs text-trading-success">{marketData?.nasdaq.change || '+1.24%'}</div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">VIX</span>
            <div className="text-right">
              <div className="text-sm font-mono">{marketData?.vix.price || '$18.45'}</div>
              <div className="text-xs text-trading-error">{marketData?.vix.change || '-2.15%'}</div>
            </div>
          </div>
        </div>
        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center text-sm text-trading-success">
            <i className="fas fa-check-circle mr-2"></i>
            Market trend: {marketData?.trend || 'Bullish'}
          </div>
        </div>
      </div>

      {/* Watchlists */}
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center justify-between">
          <div className="flex items-center">
            <i className="fas fa-list text-trading-primary mr-2"></i>
            Watchlists
          </div>
        </h3>
        
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Focus List ({focusList?.symbols.length || 0})
            </h4>
            {focusList?.symbols.length ? (
              <div className="space-y-2">
                {focusList.symbols.slice(0, 3).map((symbol) => (
                  <div key={symbol} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{symbol}</span>
                    <span className="text-trading-success">--</span>
                  </div>
                ))}
                {focusList.symbols.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    +{focusList.symbols.length - 3} more
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">No stocks in focus list</div>
            )}
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Flagged List ({flaggedList?.symbols.length || 0})
            </h4>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {flaggedList?.symbols.length || 0} stocks showing momentum
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <i className="fas fa-chart-pie text-trading-primary mr-2"></i>
          Today's Stats
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">P&L Today:</span>
            <span className={`text-sm font-mono ${todaysPnL >= 0 ? 'text-trading-success' : 'text-trading-error'}`}>
              {todaysPnL >= 0 ? '+' : ''}${todaysPnL.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Win Rate:</span>
            <span className="text-sm font-mono">{winRate}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Active Trades:</span>
            <span className="text-sm font-mono">{activeTrades.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Risk Used:</span>
            <span className="text-sm font-mono">{riskPercentUsed.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Price Alerts */}
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <i className="fas fa-bell text-trading-warning mr-2"></i>
          Price Alerts
        </h3>
        {priceAlerts.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {priceAlerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="flex justify-between items-center text-sm bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                <span className="font-medium">{alert.symbol}</span>
                <span className="text-xs capitalize">{alert.alertType}: ${alert.targetPrice}</span>
              </div>
            ))}
            {priceAlerts.length > 3 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                +{priceAlerts.length - 3} more alerts
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Profile */}
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <i className="fas fa-user text-trading-primary mr-2"></i>
          Profile
        </h3>
        <div className="space-y-2">
          <button className="w-full text-left text-sm p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <i className="fas fa-envelope mr-2 text-gray-500"></i>
            Email & SMS Settings
          </button>
          <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
            Configure alerts for price breakouts
          </div>
        </div>
      </div>
    </div>
  );
}
