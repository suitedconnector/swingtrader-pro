import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { apiRequest } from '@/lib/queryClient';
import type { ScanResult, Watchlist } from '@shared/schema';
import { Check, Play, RotateCcw } from 'lucide-react';
import { EmptyState, PageHeader, Section, Stat } from '@/components/layout/primitives';
import { cn } from '@/lib/utils';

const SCAN_CRITERIA = [
  '> 5% gain over 30 days',
  'Volume > 500K',
  'Dollar volume > $5M',
  'Price > $10',
  'Biotech excluded',
];

const th = 'pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground';

export function ScanningPhase() {
  const queryClient = useQueryClient();
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [currentStock, setCurrentStock] = useState<string>('');

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
        const result = await apiRequest('POST', '/api/run-scans-v2');
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
      setCurrentPage(1);
      queryClient.invalidateQueries({ queryKey: ['/api/scan-results'] });
    },
  });

  const resetScansMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/scan-results'),
    onSuccess: () => {
      setCurrentPage(1);
      queryClient.invalidateQueries({ queryKey: ['/api/scan-results'] });
    },
  });

  const addToWatchlistMutation = useMutation({
    mutationFn: async ({
      watchlist,
      symbol
    }: {
      watchlist: Watchlist;
      symbol: string;
    }) => {
      const updatedSymbols = Array.from(
        new Set([...watchlist.symbols, symbol])
      );

      if (updatedSymbols.length === watchlist.symbols.length) {
        return;
      }

      await apiRequest('PATCH', `/api/watchlists/${watchlist.id}`, {
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

  const createWatchlistMutation = useMutation({
    mutationFn: async ({ type, name }: { type: string; name: string }) => {
      const res = await apiRequest('POST', '/api/watchlists', {
        type,
        name,
        symbols: []
      });
      return await res.json() as Watchlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
    },
  });

  const handleAddToWatchlist = async (
    symbol: string,
    type: 'focus' | 'flagged'
  ) => {
    try {
      let watchlist = watchlists.find(w => w.type === type);

      if (!watchlist) {
        const name = type === 'focus' ? 'Focus List' : 'Flagged List';
        watchlist = await createWatchlistMutation.mutateAsync({
          type,
          name
        });
      }

      await addToWatchlistMutation.mutateAsync({
        watchlist,
        symbol
      });
    } catch (err) {
      console.error(`Failed to add ${symbol} to ${type} list:`, err);
    }
  };

  const isBiotechStock = (sector: string) => sector.toLowerCase().includes('biotechnology');

  // Filter scan results by selected sector
  const filteredScanResults = scanResults.filter(result => {
    if (selectedSector === 'all') return true;
    if (selectedSector === 'Healthcare' && isBiotechStock(result.sector)) return false;
    return result.sector.toLowerCase().includes(selectedSector.toLowerCase());
  });

  // Paginate the filtered results without changing the underlying scan data.
  const totalPages = Math.max(1, Math.ceil(filteredScanResults.length / pageSize));
  // Clamp in case the result list shrinks (filter, reset) while on a later page.
  const safePage = Math.min(currentPage, totalPages);
  const paginatedScanResults = filteredScanResults.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const firstDisplayed = filteredScanResults.length === 0
    ? 0
    : (safePage - 1) * pageSize + 1;
  const lastDisplayed = Math.min(safePage * pageSize, filteredScanResults.length);

  const focusSymbols = new Set(watchlists.find(w => w.type === 'focus')?.symbols ?? []);
  const flaggedSymbols = new Set(watchlists.find(w => w.type === 'flagged')?.symbols ?? []);
  const listBusy = addToWatchlistMutation.isPending || createWatchlistMutation.isPending;

  // Calculate summary statistics
  const scanStats = {
    totalResults: filteredScanResults.length,
    strongGainers: filteredScanResults.filter(r => parseFloat(r.changePercent) > 10).length,
    topSectors: Array.from(new Set(filteredScanResults.map(r => r.sector))).slice(0, 3),
    avgGain: filteredScanResults.length > 0 
      ? (filteredScanResults.reduce((sum, r) => sum + parseFloat(r.changePercent), 0) / filteredScanResults.length).toFixed(1)
      : '0'
  };

  const busy = isScanning || runScansMutation.isPending;

  const listButton = (symbol: string, type: 'focus' | 'flagged') => {
    const inList = (type === 'focus' ? focusSymbols : flaggedSymbols).has(symbol);
    const label = type === 'focus' ? 'Focus' : 'Flag';
    return (
      <Button
        size="sm"
        variant="ghost"
        className={cn('h-7 px-2 text-xs', inList ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
        onClick={() => handleAddToWatchlist(symbol, type)}
        disabled={inList || listBusy}
        aria-label={inList ? `${symbol} is on the ${type} list` : `Add ${symbol} to the ${type} list`}
      >
        {inList && <Check aria-hidden="true" />}
        {inList ? (type === 'focus' ? 'Focused' : 'Flagged') : label}
      </Button>
    );
  };

  return (
    <>
      <PageHeader
        title="Scanner"
        description="Stocks that match your swing-trading criteria."
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => resetScansMutation.mutate()}
              disabled={resetScansMutation.isPending || isScanning}
            >
              <RotateCcw aria-hidden="true" />
              {resetScansMutation.isPending ? 'Clearing…' : 'Clear results'}
            </Button>
            <Button size="sm" onClick={handleRunScans} disabled={busy}>
              <Play aria-hidden="true" />
              {busy ? 'Scanning…' : 'Run scan'}
            </Button>
          </>
        }
      />

      {isScanning && (
        <div className="-mt-4 pb-8" role="status" aria-live="polite">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{currentStock}</span>
            <span className="font-mono tabular-nums">{Math.round(scanProgress)}%</span>
          </div>
          <Progress value={scanProgress} className="h-[3px] bg-muted" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 pb-6 lg:grid-cols-4">
        <Stat label="Results" value={scanStats.totalResults} />
        <Stat
          label="Strong gainers"
          value={scanStats.strongGainers}
          hint="Up more than 10%"
          signal={scanStats.strongGainers > 0 ? 'up' : undefined}
        />
        <Stat label="Average gain" value={`${scanStats.avgGain}%`} />
        <Stat
          label="Top sectors"
          value={<span className="font-sans text-sm">{scanStats.topSectors.join(', ') || '—'}</span>}
        />
      </div>

      <p className="pb-8 text-xs text-muted-foreground">
        <span className="mr-2 uppercase tracking-wider">Criteria</span>
        {SCAN_CRITERIA.join('  ·  ')}
      </p>

      <Section
        title="Results"
        actions={
          <Select
            value={selectedSector}
            onValueChange={(value) => {
              setSelectedSector(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-52 border-0 bg-muted text-xs" aria-label="Filter by sector">
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
        }
      >
        {scanLoading ? (
          <p className="py-8 text-sm text-muted-foreground">Loading scan results…</p>
        ) : filteredScanResults.length === 0 ? (
          <EmptyState
            title={scanResults.length === 0 ? 'No scan results yet' : `No stocks in ${selectedSector}`}
            description={
              scanResults.length === 0
                ? 'Run a scan to find candidates that meet the criteria.'
                : 'Choose another sector or All Sectors.'
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className={th}>Symbol</th>
                    <th className={cn(th, 'text-right')}>Price</th>
                    <th className={cn(th, 'text-right')}>Change</th>
                    <th className={cn(th, 'text-right')}>Volume</th>
                    <th className={cn(th, 'pl-6')}>Sector</th>
                    <th className={cn(th, 'text-right')}>
                      <span className="sr-only">Watchlists</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedScanResults.map((result) => {
                    const biotech = isBiotechStock(result.sector);
                    return (
                      <tr key={result.id}>
                        <td className="py-2.5 font-medium text-foreground">{result.symbol}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">{Number(result.price).toFixed(2)}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-signal-up">+{result.changePercent}%</td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                          {(Number(result.volume) / 1000000).toFixed(1)}M
                        </td>
                        <td className={cn('py-2.5 pl-6', biotech ? 'text-signal-down' : 'text-muted-foreground')}>
                          {result.sector}
                        </td>
                        <td className="py-2.5 text-right">
                          {biotech ? (
                            <span className="text-xs text-signal-down">Avoid</span>
                          ) : (
                            <span className="inline-flex gap-1">
                              {listButton(result.symbol, 'flagged')}
                              {listButton(result.symbol, 'focus')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 pt-6 text-xs text-muted-foreground sm:flex-row">
              <div className="flex items-center gap-3">
                <span>
                  {firstDisplayed}–{lastDisplayed} of {filteredScanResults.length}
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 w-16 border-0 bg-muted text-xs" aria-label="Rows per page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 30, 40, 50].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                >
                  Previous
                </Button>
                <span className="px-2 font-mono tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Section>
    </>
  );
}
