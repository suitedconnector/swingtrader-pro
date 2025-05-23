import { useQuery } from '@tanstack/react-query';
import type { Trade } from '@shared/schema';

export function AnalysisPhase() {
  const { data: allTrades = [], isLoading } = useQuery<Trade[]>({
    queryKey: ['/api/trades'],
  });

  const { data: activeTrades = [] } = useQuery<Trade[]>({
    queryKey: ['/api/trades', { active: true }],
  });

  const closedTrades = allTrades.filter(trade => trade.status === 'closed');
  const winningTrades = closedTrades.filter(trade => Number(trade.pnl || 0) > 0);
  const losingTrades = closedTrades.filter(trade => Number(trade.pnl || 0) < 0);
  
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  const totalPnL = closedTrades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const averageWin = winningTrades.length > 0 
    ? winningTrades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0) / winningTrades.length 
    : 0;
  const averageLoss = losingTrades.length > 0 
    ? Math.abs(losingTrades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0) / losingTrades.length)
    : 0;

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-trading-primary mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Loading trade data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-analytics text-trading-primary mr-2"></i>
        Phase 6: Post-Trading Analysis
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-trading-primary">{allTrades.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Trades</div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-trading-success">{winRate.toFixed(1)}%</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Win Rate</div>
        </div>
        
        <div className={`rounded-lg p-4 ${totalPnL >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-trading-success' : 'text-trading-error'}`}>
            ${totalPnL.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total P&L</div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{activeTrades.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Active Trades</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Performance Metrics</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Winning Trades:</span>
              <span className="text-sm font-medium text-trading-success">{winningTrades.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Losing Trades:</span>
              <span className="text-sm font-medium text-trading-error">{losingTrades.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Average Win:</span>
              <span className="text-sm font-medium text-trading-success">${averageWin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Average Loss:</span>
              <span className="text-sm font-medium text-trading-error">$-{averageLoss.toFixed(2)}</span>
            </div>
            {averageLoss > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Profit Factor:</span>
                <span className="text-sm font-medium">{(averageWin / averageLoss).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Recent Trades</h4>
          {closedTrades.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-600 dark:text-gray-400">No completed trades yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {closedTrades.slice(-10).reverse().map((trade) => (
                <div key={trade.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{trade.symbol}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                      {trade.shares} shares
                    </span>
                  </div>
                  <div className={`text-sm font-medium ${
                    Number(trade.pnl || 0) >= 0 ? 'text-trading-success' : 'text-trading-error'
                  }`}>
                    {Number(trade.pnl || 0) >= 0 ? '+' : ''}${Number(trade.pnl || 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h5 className="font-medium text-trading-primary mb-2">Key Analysis Points</h5>
        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li>• Review charts of both winning and losing trades</li>
          <li>• Identify common patterns in successful setups</li>
          <li>• Analyze adherence to entry and exit rules</li>
          <li>• Evaluate position sizing and risk management effectiveness</li>
          <li>• Document lessons learned for future reference</li>
        </ul>
      </div>
    </div>
  );
}
