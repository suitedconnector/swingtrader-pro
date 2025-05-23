import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import type { PositionCalculation, AccountSettings } from '@/lib/types';
import type { Trade, Stock } from '@shared/schema';

export function EntryPhase() {
  const queryClient = useQueryClient();
  const [accountSettings] = useState<AccountSettings>({
    balance: 125486.32,
    defaultRiskPercent: 1,
  });

  const [positionForm, setPositionForm] = useState({
    symbol: '',
    entryPrice: '',
    stopLoss: '',
    riskPercent: accountSettings.defaultRiskPercent.toString(),
  });

  const [isCalculatingPrices, setIsCalculatingPrices] = useState(false);
  const [priceCalculations, setPriceCalculations] = useState<{
    currentPrice: number;
    suggestedEntry: number;
    suggestedStopLoss: number;
    reasoning: string;
  } | null>(null);

  const [calculation, setCalculation] = useState<PositionCalculation>({
    riskAmount: 0,
    riskPerShare: 0,
    numShares: 0,
    positionValue: 0,
    percentOfAccount: 0,
  });

  const { data: activeTrades = [] } = useQuery<Trade[]>({
    queryKey: ['/api/trades', { active: true }],
  });

  const { data: watchlists = [] } = useQuery({
    queryKey: ['/api/watchlists'],
  });

  const { data: stocks = [] } = useQuery<Stock[]>({
    queryKey: ['/api/stocks'],
  });

  // Get all available symbols from both watchlists and stocks
  const watchlistStocks = watchlists.flatMap((wl: any) => wl.stocks || []);
  const allStockSymbols = [...stocks.map(stock => stock.symbol), ...watchlistStocks];
  const allStocks = Array.from(new Set(allStockSymbols));

  // Add hardcoded stocks from your current watchlist as fallback
  const fallbackStocks = ['ASST', 'VIGL', 'IONL'];
  const finalStocks = allStocks.length > 0 ? allStocks : fallbackStocks;

  // Function to automatically calculate entry and stop loss prices
  const calculateOptimalPrices = async (symbol: string) => {
    setIsCalculatingPrices(true);
    try {
      // Get current market data using the existing Alpha Vantage endpoint
      const response = await fetch(`/api/price-alert-suggestion/${symbol}`);
      const data = await response.json();
      
      if (data.currentPrice && data.suggestedBreakout) {
        const currentPrice = parseFloat(data.currentPrice);
        const suggestedEntry = parseFloat(data.suggestedBreakout);
        
        // Calculate stop loss based on common swing trading rules
        // Option 1: 8% below entry (conservative)
        // Option 2: Below recent low (technical)
        const conservativeStop = suggestedEntry * 0.92; // 8% stop loss
        const technicalStop = Math.min(conservativeStop, currentPrice * 0.95); // 5% below current price
        
        const suggestedStopLoss = Math.max(technicalStop, suggestedEntry * 0.85); // Max 15% stop
        
        let reasoning = `Entry: Breakout above $${currentPrice.toFixed(2)} (current price). `;
        reasoning += `Stop: ${((suggestedEntry - suggestedStopLoss) / suggestedEntry * 100).toFixed(1)}% risk below entry.`;
        
        setPriceCalculations({
          currentPrice,
          suggestedEntry,
          suggestedStopLoss,
          reasoning
        });
        
        // Auto-populate the form
        setPositionForm(prev => ({
          ...prev,
          entryPrice: suggestedEntry.toFixed(2),
          stopLoss: suggestedStopLoss.toFixed(2)
        }));
      }
    } catch (error) {
      console.error('Error calculating prices:', error);
    } finally {
      setIsCalculatingPrices(false);
    }
  };

  const createTradeMutation = useMutation({
    mutationFn: (tradeData: {
      symbol: string;
      entryPrice: string;
      stopLoss: string;
      shares: number;
      riskAmount: string;
    }) =>
      apiRequest('POST', '/api/trades', {
        symbol: tradeData.symbol.toUpperCase(),
        entryPrice: tradeData.entryPrice,
        stopLoss: tradeData.stopLoss,
        shares: tradeData.shares,
        riskAmount: tradeData.riskAmount,
        status: 'active',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
      setPositionForm({
        symbol: '',
        entryPrice: '',
        stopLoss: '',
        riskPercent: accountSettings.defaultRiskPercent.toString(),
      });
    },
  });

  useEffect(() => {
    const entryPrice = parseFloat(positionForm.entryPrice) || 0;
    const stopLoss = parseFloat(positionForm.stopLoss) || 0;
    const riskPercent = parseFloat(positionForm.riskPercent) || 1;

    const riskAmount = accountSettings.balance * (riskPercent / 100);
    const riskPerShare = entryPrice - stopLoss;
    const numShares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
    const positionValue = numShares * entryPrice;
    const percentOfAccount = (positionValue / accountSettings.balance) * 100;

    setCalculation({
      riskAmount,
      riskPerShare,
      numShares,
      positionValue,
      percentOfAccount,
    });
  }, [positionForm, accountSettings.balance]);

  const handleExecuteTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (positionForm.symbol && positionForm.entryPrice && positionForm.stopLoss && calculation.numShares > 0) {
      createTradeMutation.mutate({
        symbol: positionForm.symbol,
        entryPrice: positionForm.entryPrice,
        stopLoss: positionForm.stopLoss,
        shares: calculation.numShares,
        riskAmount: calculation.riskAmount.toFixed(2),
      });
    }
  };

  const totalRiskUsed = activeTrades.reduce((total, trade) => total + Number(trade.riskAmount), 0);
  const riskPercentUsed = (totalRiskUsed / accountSettings.balance) * 100;

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-play text-trading-primary mr-2"></i>
        Phase 4: Entry Execution & Position Sizing
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Position Size Calculator</h4>
          <form onSubmit={handleExecuteTrade} className="space-y-3">
            <div>
              <Label htmlFor="accountBalance">Account Balance</Label>
              <Input
                id="accountBalance"
                type="number"
                value={accountSettings.balance}
                readOnly
                className="bg-gray-50 dark:bg-gray-700"
              />
            </div>
            <div>
              <Label htmlFor="riskPercent">Risk Percentage (%)</Label>
              <Input
                id="riskPercent"
                type="number"
                max="5"
                step="0.1"
                value={positionForm.riskPercent}
                onChange={(e) => setPositionForm(prev => ({ ...prev, riskPercent: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="symbol">Stock Symbol</Label>
              <div className="flex space-x-2">
                <Select 
                  value={positionForm.symbol} 
                  onValueChange={(value) => {
                    setPositionForm(prev => ({ ...prev, symbol: value }));
                    setPriceCalculations(null);
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choose from watchlist" />
                  </SelectTrigger>
                  <SelectContent>
                    {finalStocks.map((symbol) => (
                      <SelectItem key={symbol} value={symbol}>
                        {symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => positionForm.symbol && calculateOptimalPrices(positionForm.symbol)}
                  disabled={!positionForm.symbol || isCalculatingPrices}
                  className="px-4"
                >
                  {isCalculatingPrices ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Auto Calculate'
                  )}
                </Button>
              </div>
            </div>

            {priceCalculations && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2">
                <h5 className="font-medium text-blue-900 dark:text-blue-100">Automated Price Analysis</h5>
                <div className="text-sm space-y-1">
                  <div>Current Price: <span className="font-mono">${priceCalculations.currentPrice.toFixed(2)}</span></div>
                  <div>Suggested Entry: <span className="font-mono text-green-600">${priceCalculations.suggestedEntry.toFixed(2)}</span></div>
                  <div>Suggested Stop: <span className="font-mono text-red-600">${priceCalculations.suggestedStopLoss.toFixed(2)}</span></div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">{priceCalculations.reasoning}</p>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="entryPrice">Entry Price ($)</Label>
              <Input
                id="entryPrice"
                type="number"
                step="0.01"
                value={positionForm.entryPrice}
                onChange={(e) => setPositionForm(prev => ({ ...prev, entryPrice: e.target.value }))}
                placeholder="Auto-calculated or manual entry"
                className={priceCalculations ? 'bg-green-50 dark:bg-green-900/20' : ''}
              />
            </div>
            <div>
              <Label htmlFor="stopLoss">Stop Loss Price ($)</Label>
              <Input
                id="stopLoss"
                type="number"
                step="0.01"
                value={positionForm.stopLoss}
                onChange={(e) => setPositionForm(prev => ({ ...prev, stopLoss: e.target.value }))}
                placeholder="Auto-calculated or manual entry"
                className={priceCalculations ? 'bg-red-50 dark:bg-red-900/20' : ''}
              />
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Calculated Results</h4>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Risk Amount:</span>
              <span className="text-sm font-mono font-medium text-trading-error">
                ${calculation.riskAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Risk Per Share:</span>
              <span className="text-sm font-mono font-medium">
                ${calculation.riskPerShare.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Number of Shares:</span>
              <span className="text-sm font-mono font-medium text-trading-primary">
                {calculation.numShares}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Position Value:</span>
              <span className="text-sm font-mono font-medium">
                ${calculation.positionValue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">% of Account:</span>
              <span className={`text-sm font-mono font-medium ${calculation.percentOfAccount > 30 ? 'text-trading-warning' : ''}`}>
                {calculation.percentOfAccount.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h5 className="font-medium text-trading-primary mb-2">Current Risk Usage</h5>
            <div className="flex justify-between text-sm">
              <span>Total Risk Used:</span>
              <span className="font-mono">${totalRiskUsed.toFixed(2)} ({riskPercentUsed.toFixed(2)}%)</span>
            </div>
          </div>

          {calculation.percentOfAccount > 30 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Position size exceeds 30% of account. Consider reducing position before end of day.
              </p>
            </div>
          )}

          <Button
            onClick={handleExecuteTrade}
            disabled={createTradeMutation.isPending || calculation.numShares === 0}
            className="w-full"
          >
            {createTradeMutation.isPending ? 'Executing Trade...' : 'Execute Trade'}
          </Button>
        </div>
      </div>
    </div>
  );
}
