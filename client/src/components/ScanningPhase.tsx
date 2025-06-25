import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { apiRequest } from '@/lib/queryClient';
import type { ScanResult, Watchlist } from '@shared/schema';

export function ScanningPhase() {
  const queryClient = useQueryClient();
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [currentStock, setCurrentStock] = useState<string>('');
  // Market data for context
  const { data: marketData } = useQuery<any>({
    queryKey: ['/api/market-data'],
  });

  // Top trading sectors (excluding biotech)
  const tradingSectors = [
    { value: 'all', label: 'All Sectors' },
    { value: 'Technology', label: 'Technology' },
    { value: 'Financial Services', label: 'Financial Services' },
    { value: 'Healthcare', label: 'Healthcare (Non-Biotech)' },
    { value: 'Consumer Discretionary', label: 'Consumer Discretionary' },
    { value: 'Energy', label: 'Energy' },
    { value: 'Industrials', label: 'Industrials' },
    { value: 'Materials', label: 'Materials' },
    { value: 'Real Estate', label: 'Real Estate' },
    { value: 'Communication Services', label: 'Communication Services' },
    { value: 'Utilities', label: 'Utilities' },
    { value: 'Consumer Staples', label: 'Consumer Staples' },
  ];

  const { data: scanResults = [], isLoading: scanLoading } = useQuery<ScanResult[]>({
    queryKey: ['/api/scan-results'],
  });

  const { data: watchlists = [] } = useQuery<Watchlist[]>({
    queryKey: ['/api/watchlists'],
  });

  const runScansMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      setScanProgress(0);
      setCurrentStock('Initializing...');
      
      // Simulate progress updates during scanning
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          const newProgress = Math.min(prev + Math.random() * 10, 90);
          if (newProgress < 30) setCurrentStock('Fetching market symbols...');
          else if (newProgress < 60) setCurrentStock('Analyzing stocks...');
          else if (newProgress < 90) setCurrentStock('Applying criteria...');
          return newProgress;
        });
      }, 500);
      
      try {
        const result = await apiRequest('POST', '/api/run-scans');
        clearInterval(progressInterval);
        setScanProgress(100);
        setCurrentStock('Scan complete!');
        setTimeout(() => {
          setIsScanning(false);
          setScanProgress(0);
          setCurrentStock('');
        }, 1000);
        return result;
      } catch (error) {
        clearInterval(progressInterval);
        setIsScanning(false);
        setScanProgress(0);
        setCurrentStock('');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scan-results'] });
    },
  });

  const resetScansMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/scan-results'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scan-results'] });
    },
  });

  const addToWatchlistMutation = useMutation({
    mutationFn: ({ watchlistId, symbol }: { watchlistId: number; symbol: string }) => {
      const watchlist = watchlists.find(w => w.id === watchlistId);
      if (!watchlist) throw new Error('Watchlist not found');
      
      const updatedSymbols = [...watchlist.symbols, symbol];
      return apiRequest('PATCH', `/api/watchlists/${watchlistId}`, {
        symbols: updatedSymbols
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
    },
  });

  const handleRunScans = () => {
    runScansMutation.mutate();
  };

  const handleAddToWatchlist = (symbol: string, type: 'focus' | 'flagged') => {
    const watchlist = watchlists.find(w => w.type === type);
    if (watchlist) {
      addToWatchlistMutation.mutate({ watchlistId: watchlist.id, symbol });
    }
  };

  const isBiotechStock = (sector: string) => sector.toLowerCase().includes('biotechnology');

  // Filter scan results by selected sector
  const filteredScanResults = scanResults.filter(result => {
    if (selectedSector === 'all') return true;
    if (selectedSector === 'Healthcare' && isBiotechStock(result.sector)) return false;
    return result.sector.toLowerCase().includes(selectedSector.toLowerCase());
  });

  // Calculate summary statistics
  const scanStats = {
    totalResults: filteredScanResults.length,
    strongGainers: filteredScanResults.filter(r => parseFloat(r.changePercent) > 10).length,
    topSectors: Array.from(new Set(filteredScanResults.map(r => r.sector))).slice(0, 3),
    avgGain: filteredScanResults.length > 0 
      ? (filteredScanResults.reduce((sum, r) => sum + parseFloat(r.changePercent), 0) / filteredScanResults.length).toFixed(1)
      : '0'
  };

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-search text-trading-primary mr-2"></i>
        Phase 1: Scanning & Initial Stock Identification
      </h3>
      
      <div className="space-y-4">
        {/* Morgan's Trading Criteria Status */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Morgan's Swing Trading Criteria</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✓</span>
              <span>Price Movement &gt; 5% gain (30-day)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✓</span>
              <span>Volume &gt; 500K shares (liquidity)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✓</span>
              <span>Dollar Volume &gt; $5M (institutional interest)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✓</span>
              <span>Exclude biotechnology stocks</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✓</span>
              <span>Price &gt; $10 (avoid penny stocks)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✓</span>
              <span>Multi-sector diversification</span>
            </div>
          </div>
        </div>

        {/* Market Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Market Context</h4>
            {marketData ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>SPY:</span>
                  <span className="font-mono">${marketData.spy.price} {marketData.spy.change}</span>
                </div>
                <div className="flex justify-between">
                  <span>NASDAQ:</span>
                  <span className="font-mono">${marketData.nasdaq.price} {marketData.nasdaq.change}</span>
                </div>
                <div className="flex justify-between">
                  <span>VIX:</span>
                  <span className="font-mono">${marketData.vix.price} {marketData.vix.change}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Trend: </span>
                  <span className={`text-xs font-medium ${
                    marketData.trend === 'Bullish' ? 'text-green-600' : 
                    marketData.trend === 'Bearish' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {marketData.trend}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading market data...</p>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Scan Statistics</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Results:</span>
                <span className="font-medium">{scanStats.totalResults}</span>
              </div>
              <div className="flex justify-between">
                <span>Strong Gainers (&gt;10%):</span>
                <span className="font-medium text-green-600">{scanStats.strongGainers}</span>
              </div>
              <div className="flex justify-between">
                <span>Average Gain:</span>
                <span className="font-medium">{scanStats.avgGain}%</span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-xs text-gray-600 dark:text-gray-400">Top Sectors: </span>
                <span className="text-xs">{scanStats.topSectors.join(', ')}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Scan Status</h4>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <i className="fas fa-check text-green-500 w-4"></i>
                  <span>Moving Averages</span>
                </div>
                <span className="text-green-600 font-medium">Above 20-day</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <i className="fas fa-check text-green-500 w-4"></i>
                  <span>Price Movement</span>
                </div>
                <span className="text-green-600 font-medium">&gt; 5% gain</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <i className="fas fa-check text-green-500 w-4"></i>
                  <span>Volume Activity</span>
                </div>
                <span className="text-green-600 font-medium">Above average</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <i className="fas fa-check text-green-500 w-4"></i>
                  <span>Price Level</span>
                </div>
                <span className="text-green-600 font-medium">&gt; $1.00</span>
              </div>
            </div>
            <div className="flex space-x-2 mt-4">
              <Button 
                onClick={handleRunScans} 
                disabled={isScanning || runScansMutation.isPending}
                className="flex-1 text-xs"
                size="sm"
              >
                {isScanning ? 'Scanning...' : 'Run Scan'}
              </Button>
              <Button 
                onClick={() => resetScansMutation.mutate()} 
                disabled={resetScansMutation.isPending || isScanning}
                variant="outline"
                className="flex-1 text-xs"
                size="sm"
              >
                {resetScansMutation.isPending ? 'Clearing...' : 'Reset'}
              </Button>
            </div>
            
            {/* Progress bar during scanning */}
            {isScanning && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{currentStock}</span>
                  <span className="text-gray-600 dark:text-gray-400">{Math.round(scanProgress)}%</span>
                </div>
                <Progress value={scanProgress} className="h-2" />
                <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-trading-primary"></div>
                  <span>Scanning market for opportunities...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Scan Results</h4>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Filter by Sector:</span>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tradingSectors.map((sector) => (
                    <SelectItem key={sector.value} value={sector.value}>
                      {sector.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {scanLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-trading-primary mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Loading scan results...</p>
            </div>
          ) : filteredScanResults.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-search text-4xl text-gray-400 mb-4"></i>
              <p className="text-gray-600 dark:text-gray-400">
                {scanResults.length === 0 
                  ? "No scan results yet. Run scans to see potential trading candidates."
                  : `No stocks found in ${selectedSector === 'all' ? 'selected' : selectedSector} sector.`
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Change</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Volume</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sector</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredScanResults.map((result) => (
                    <tr key={result.id} className={isBiotechStock(result.sector) ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{result.symbol}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">${result.price}</td>
                      <td className="px-4 py-3 text-sm font-mono text-trading-success">+{result.changePercent}%</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{(Number(result.volume) / 1000000).toFixed(1)}M</td>
                      <td className={`px-4 py-3 text-sm ${isBiotechStock(result.sector) ? 'text-trading-error' : 'text-gray-600 dark:text-gray-400'}`}>
                        {result.sector}
                      </td>
                      <td className="px-4 py-3">
                        {isBiotechStock(result.sector) ? (
                          <Button size="sm" variant="destructive" disabled>
                            Avoid
                          </Button>
                        ) : (
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleAddToWatchlist(result.symbol, 'flagged')}
                              disabled={addToWatchlistMutation.isPending}
                            >
                              Add to Flagged
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleAddToWatchlist(result.symbol, 'focus')}
                              disabled={addToWatchlistMutation.isPending}
                            >
                              Add to Focus
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
