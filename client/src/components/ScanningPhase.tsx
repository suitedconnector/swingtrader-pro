import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import type { ScanResult, Watchlist } from '@shared/schema';

export function ScanningPhase() {
  const queryClient = useQueryClient();
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [scanChecklist, setScanChecklist] = useState({
    oneMonth: false,
    threeMonth: false,
    sixMonth: false,
    oneWeek: false,
    top2Percent: false,
    adr5Percent: false,
    price1Dollar: false,
    volume30Million: false,
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
    mutationFn: () => apiRequest('POST', '/api/run-scans'),
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

  const handleChecklistChange = (key: keyof typeof scanChecklist) => {
    setScanChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

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

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-search text-trading-primary mr-2"></i>
        Phase 1: Scanning & Initial Stock Identification
      </h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Scan Execution</h4>
            <div className="space-y-2">
              <label className="flex items-center space-x-3">
                <Checkbox
                  checked={scanChecklist.oneMonth}
                  onCheckedChange={() => handleChecklistChange('oneMonth')}
                />
                <span className="text-sm">One-Month Gainer Scan</span>
              </label>
              <label className="flex items-center space-x-3">
                <Checkbox
                  checked={scanChecklist.threeMonth}
                  onCheckedChange={() => handleChecklistChange('threeMonth')}
                />
                <span className="text-sm">Three-Month Gainer Scan</span>
              </label>
              <label className="flex items-center space-x-3">
                <Checkbox
                  checked={scanChecklist.sixMonth}
                  onCheckedChange={() => handleChecklistChange('sixMonth')}
                />
                <span className="text-sm">Six-Month Gainer Scan</span>
              </label>
              <label className="flex items-center space-x-3">
                <Checkbox
                  checked={scanChecklist.oneWeek}
                  onCheckedChange={() => handleChecklistChange('oneWeek')}
                />
                <span className="text-sm">One-Week Gainer Scan</span>
              </label>
            </div>
            <div className="flex space-x-2 mt-4">
              <Button 
                onClick={handleRunScans} 
                disabled={runScansMutation.isPending}
                className="flex-1"
              >
                {runScansMutation.isPending ? 'Running Scans...' : 'Run All Scans'}
              </Button>
              <Button 
                onClick={() => resetScansMutation.mutate()} 
                disabled={resetScansMutation.isPending}
                variant="outline"
                className="flex-1"
              >
                {resetScansMutation.isPending ? 'Clearing...' : 'Reset Results'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Scan Criteria Verification</h4>
            <div className="space-y-2">
              <label className="flex items-center space-x-3">
                <Checkbox
                  checked={scanChecklist.top2Percent}
                  onCheckedChange={() => handleChecklistChange('top2Percent')}
                />
                <span className="text-sm">Top 2% strongest stocks</span>
              </label>
              <label className="flex items-center space-x-3">
                <Checkbox
                  checked={scanChecklist.adr5Percent}
                  onCheckedChange={() => handleChecklistChange('adr5Percent')}
                />
                <span className="text-sm">ADR {'>'} 5%</span>
              </label>
              <label className="flex items-center space-x-3">
                <Checkbox
                  checked={scanChecklist.price1Dollar}
                  onCheckedChange={() => handleChecklistChange('price1Dollar')}
                />
                <span className="text-sm">Price {'>'} $1.00</span>
              </label>
              <label className="flex items-center space-x-3">
                <Checkbox
                  checked={scanChecklist.volume30Million}
                  onCheckedChange={() => handleChecklistChange('volume30Million')}
                />
                <span className="text-sm">Dollar Volume {'>'}$30M</span>
              </label>
            </div>
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
