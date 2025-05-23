import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TradingViewChart from './TradingViewChart';
import { useTheme } from '@/hooks/useTheme';
import type { Watchlist } from '@shared/schema';

export function ChartSetupPhase() {
  const { theme } = useTheme();
  const [selectedStock, setSelectedStock] = useState<string>('');
  const [technicalChecklist, setTechnicalChecklist] = useState({
    initialMove: false,
    pullback: false,
    higherLows: false,
    holdingSMA: false,
    volumeDrying: false,
  });

  const [maAlignment, setMaAlignment] = useState({
    sma10Above20: false,
    sma20Above50: false,
    sma50Above200: false,
    priceAbove200: false,
    marketTrending: false,
  });

  const { data: watchlists = [] } = useQuery<Watchlist[]>({
    queryKey: ['/api/watchlists'],
  });

  // Get all unique symbols from both Focus and Flagged lists
  const allStocks = watchlists.reduce((stocks: string[], watchlist) => {
    return [...stocks, ...watchlist.symbols];
  }, []);

  const handleTechnicalChange = (key: keyof typeof technicalChecklist) => {
    setTechnicalChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMAChange = (key: keyof typeof maAlignment) => {
    setMaAlignment(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-chart-bar text-trading-primary mr-2"></i>
        Phase 2: Daily Chart Setup Analysis
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Technical Analysis Checklist</h4>
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={technicalChecklist.initialMove}
                onCheckedChange={() => handleTechnicalChange('initialMove')}
              />
              <span className="text-sm">Initial move up ≥30%</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={technicalChecklist.pullback}
                onCheckedChange={() => handleTechnicalChange('pullback')}
              />
              <span className="text-sm">Orderly pullback/consolidation</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={technicalChecklist.higherLows}
                onCheckedChange={() => handleTechnicalChange('higherLows')}
              />
              <span className="text-sm">Higher lows pattern</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={technicalChecklist.holdingSMA}
                onCheckedChange={() => handleTechnicalChange('holdingSMA')}
              />
              <span className="text-sm">Holding 10/20 SMA during pullback</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={technicalChecklist.volumeDrying}
                onCheckedChange={() => handleTechnicalChange('volumeDrying')}
              />
              <span className="text-sm">Volume drying up</span>
            </label>
          </div>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Moving Average Alignment</h4>
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={maAlignment.sma10Above20}
                onCheckedChange={() => handleMAChange('sma10Above20')}
              />
              <span className="text-sm">10 SMA {'>'} 20 SMA</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={maAlignment.sma20Above50}
                onCheckedChange={() => handleMAChange('sma20Above50')}
              />
              <span className="text-sm">20 SMA {'>'} 50 SMA</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={maAlignment.sma50Above200}
                onCheckedChange={() => handleMAChange('sma50Above200')}
              />
              <span className="text-sm">50 SMA {'>'} 200 SMA</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={maAlignment.priceAbove200}
                onCheckedChange={() => handleMAChange('priceAbove200')}
              />
              <span className="text-sm">Price above 200 SMA</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={maAlignment.marketTrending}
                onCheckedChange={() => handleMAChange('marketTrending')}
              />
              <span className="text-sm">Market trending higher</span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center space-x-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Select Stock to Analyze:</h4>
          <Select value={selectedStock} onValueChange={setSelectedStock}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Choose a stock" />
            </SelectTrigger>
            <SelectContent>
              {allStocks.map((symbol) => (
                <SelectItem key={symbol} value={symbol}>
                  {symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedStock && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <TradingViewChart
              symbol={selectedStock}
              height={500}
              theme={theme === 'dark' ? 'dark' : 'light'}
              interval="D"
              allow_symbol_change={false}
              enable_publishing={false}
            />
          </div>
        )}

        {!selectedStock && allStocks.length === 0 && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
            <i className="fas fa-chart-candlestick text-4xl text-gray-400 mb-4"></i>
            <p className="text-gray-600 dark:text-gray-400">Add stocks to your watchlists from Phase 1 to analyze them here</p>
          </div>
        )}

        {!selectedStock && allStocks.length > 0 && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
            <i className="fas fa-chart-line text-4xl text-gray-400 mb-4"></i>
            <p className="text-gray-600 dark:text-gray-400">Select a stock from the dropdown to view its chart</p>
          </div>
        )}
      </div>
    </div>
  );
}
