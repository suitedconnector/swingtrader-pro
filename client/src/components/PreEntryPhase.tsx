import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import type { PriceAlert, Watchlist } from '@shared/schema';

export function PreEntryPhase() {
  const queryClient = useQueryClient();
  const [alertForm, setAlertForm] = useState({
    symbol: '',
    targetPrice: '',
    alertType: 'breakout' as 'breakout' | 'breakdown',
  });

  const { data: priceAlerts = [] } = useQuery<PriceAlert[]>({
    queryKey: ['/api/price-alerts'],
    select: (data) => data.filter(alert => alert.isActive),
  });

  const { data: watchlists = [] } = useQuery<Watchlist[]>({
    queryKey: ['/api/watchlists'],
  });

  const createAlertMutation = useMutation({
    mutationFn: (alertData: { symbol: string; targetPrice: string; alertType: string }) =>
      apiRequest('POST', '/api/price-alerts', {
        symbol: alertData.symbol.toUpperCase(),
        targetPrice: alertData.targetPrice,
        alertType: alertData.alertType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
      setAlertForm({ symbol: '', targetPrice: '', alertType: 'breakout' });
    },
  });

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (alertForm.symbol && alertForm.targetPrice) {
      createAlertMutation.mutate(alertForm);
    }
  };

  const focusList = watchlists.find(w => w.type === 'focus');
  const flaggedList = watchlists.find(w => w.type === 'flagged');

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-bell text-trading-primary mr-2"></i>
        Phase 3: Pre-Entry Preparation
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Focused Watchlist Review</h4>
          
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h5 className="font-medium text-trading-primary mb-2">Focus List ({focusList?.symbols.length || 0})</h5>
              {focusList?.symbols.length ? (
                <div className="flex flex-wrap gap-2">
                  {focusList.symbols.map((symbol) => (
                    <span key={symbol} className="px-2 py-1 bg-trading-primary text-white text-xs rounded">
                      {symbol}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">No stocks in focus list</p>
              )}
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Flagged List ({flaggedList?.symbols.length || 0})</h5>
              {flaggedList?.symbols.length ? (
                <div className="flex flex-wrap gap-2">
                  {flaggedList.symbols.map((symbol) => (
                    <span key={symbol} className="px-2 py-1 bg-gray-500 text-white text-xs rounded">
                      {symbol}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">No stocks in flagged list</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Set Price Alerts</h4>
          
          <form onSubmit={handleCreateAlert} className="space-y-3">
            <div>
              <Label htmlFor="symbol">Stock Symbol</Label>
              <Input
                id="symbol"
                value={alertForm.symbol}
                onChange={(e) => setAlertForm(prev => ({ ...prev, symbol: e.target.value }))}
                placeholder="e.g., NVDA"
                className="uppercase"
              />
            </div>
            <div>
              <Label htmlFor="targetPrice">Target Price ($)</Label>
              <Input
                id="targetPrice"
                type="number"
                step="0.01"
                value={alertForm.targetPrice}
                onChange={(e) => setAlertForm(prev => ({ ...prev, targetPrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="alertType">Alert Type</Label>
              <select
                id="alertType"
                value={alertForm.alertType}
                onChange={(e) => setAlertForm(prev => ({ ...prev, alertType: e.target.value as 'breakout' | 'breakdown' }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-trading-primary focus:border-trading-primary dark:bg-gray-700 dark:text-white"
              >
                <option value="breakout">Breakout</option>
                <option value="breakdown">Breakdown</option>
              </select>
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={createAlertMutation.isPending || !alertForm.symbol || !alertForm.targetPrice}
            >
              {createAlertMutation.isPending ? 'Creating Alert...' : 'Create Price Alert'}
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Active Price Alerts</h4>
        {priceAlerts.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-600 dark:text-gray-400">No active price alerts</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {priceAlerts.map((alert) => (
              <div key={alert.id} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900 dark:text-white">{alert.symbol}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{alert.alertType}</span>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Target: ${alert.targetPrice}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
