import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import type { Trade } from '@shared/schema';

export function ManagementPhase() {
  const queryClient = useQueryClient();

  const { data: activeTrades = [], isLoading } = useQuery<Trade[]>({
    queryKey: ['/api/trades', { active: true }],
  });

  const updateTradeMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Trade> }) =>
      apiRequest('PATCH', `/api/trades/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
    },
  });

  const calculatePnL = (trade: Trade, currentPrice: number) => {
    const entryPrice = Number(trade.entryPrice);
    const pnl = (currentPrice - entryPrice) * trade.shares;
    const riskMultiple = pnl / Number(trade.riskAmount);
    return { pnl, riskMultiple };
  };

  const handleTrimPosition = (trade: Trade, percentage: number) => {
    const sharesToSell = Math.floor(trade.shares * (percentage / 100));
    const remainingShares = trade.shares - sharesToSell;
    
    updateTradeMutation.mutate({
      id: trade.id,
      updates: {
        shares: remainingShares,
        // In a real implementation, you'd also update the stop loss to break-even
      },
    });
  };

  const handleExitPosition = async (trade: Trade) => {
    try {
      // Get current market price for exit
      const response = await fetch(`/api/stock-price/${trade.symbol}`);
      const priceData = await response.json();
      const currentPrice = parseFloat(priceData.currentPrice);
      
      // Calculate P&L
      const entryPrice = Number(trade.entryPrice);
      const pnl = (currentPrice - entryPrice) * trade.shares;
      
      updateTradeMutation.mutate({
        id: trade.id,
        updates: {
          status: 'closed',
          exitDate: new Date(),
          exitPrice: currentPrice.toFixed(2),
          pnl: pnl.toFixed(2),
          exitReason: 'manual_exit'
        },
      });
    } catch (error) {
      console.error('Error getting exit price:', error);
      // Fallback to exit without price
      updateTradeMutation.mutate({
        id: trade.id,
        updates: {
          status: 'closed',
          exitDate: new Date(),
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-trading-primary mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Loading active trades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-chart-line text-trading-primary mr-2"></i>
        Phase 5: Active Trade Management
      </h3>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-white">Active Positions</h4>
        
        {activeTrades.length === 0 ? (
          <div className="text-center py-8">
            <i className="fas fa-chart-line text-4xl text-gray-400 mb-4"></i>
            <p className="text-gray-600 dark:text-gray-400">No active positions</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Execute trades in Phase 4 to see them here for management
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Shares</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Entry</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Stop Loss</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Risk Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Entry Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-gray-700">
                {activeTrades.map((trade) => {
                  // Calculate current P&L if we had real-time data
                  const entryPrice = Number(trade.entryPrice);
                  // For now, use entry price as current price placeholder until real-time data is fetched
                  const currentPrice = entryPrice; 
                  const { pnl, riskMultiple } = calculatePnL(trade, currentPrice);
                  
                  return (
                    <tr key={trade.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {trade.symbol}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {trade.shares}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        ${trade.entryPrice}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        ${trade.stopLoss}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-trading-error">
                        ${trade.riskAmount}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {trade.entryDate ? new Date(trade.entryDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTrimPosition(trade, 25)}
                            disabled={updateTradeMutation.isPending}
                          >
                            Trim 25%
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleExitPosition(trade)}
                            disabled={updateTradeMutation.isPending}
                          >
                            Exit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h5 className="font-medium text-trading-success mb-2">Profit Taking Rules</h5>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>• Trim 10-30% at 5x risk</li>
              <li>• Move stop to break-even</li>
              <li>• Full exit below 10 SMA close</li>
            </ul>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h5 className="font-medium text-trading-error mb-2">Risk Management</h5>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>• Stop loss at low of day</li>
              <li>• Max 1% account risk per trade</li>
              <li>• No timing tops</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
