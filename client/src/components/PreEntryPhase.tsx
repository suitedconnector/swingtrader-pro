import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import type { PriceAlert, Watchlist, ScanResult } from '@shared/schema';
import { AccentBar, EmptyState, PageHeader, Section } from '@/components/layout/primitives';
import { cn } from '@/lib/utils';

type AlertType = 'breakout' | 'breakdown';

const th = 'pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground';

const price = (v: string | number | null | undefined) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? '—' : n.toFixed(2);
};

export function PreEntryPhase() {
  const queryClient = useQueryClient();
  const [alertForm, setAlertForm] = useState({
    symbol: '',
    targetPrice: '',
    alertType: 'breakout' as AlertType,
  });
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [priceNote, setPriceNote] = useState('');
  // Ignores a slow price lookup that finishes after another symbol was picked.
  const priceRequest = useRef(0);

  const { data: priceAlerts = [], isLoading: alertsLoading } = useQuery<PriceAlert[]>({
    queryKey: ['/api/price-alerts'],
    select: (data) => data.filter((alert) => alert.isActive),
  });

  const { data: watchlists = [] } = useQuery<Watchlist[]>({
    queryKey: ['/api/watchlists'],
  });

  const { data: scanResults = [] } = useQuery<ScanResult[]>({
    queryKey: ['/api/scan-results'],
  });

  // Symbols to choose from: focus list first, then flagged, then scan results.
  const focusSymbols = watchlists.find((w) => w.type === 'focus')?.symbols ?? [];
  const flaggedSymbols = (watchlists.find((w) => w.type === 'flagged')?.symbols ?? []).filter(
    (s) => !focusSymbols.includes(s)
  );
  const listed = new Set([...focusSymbols, ...flaggedSymbols]);
  const scanSymbols = Array.from(new Set(scanResults.map((r) => r.symbol))).filter((s) => s && !listed.has(s));
  const symbolGroups = [
    { label: 'Focus list', symbols: focusSymbols },
    { label: 'Flagged list', symbols: flaggedSymbols },
    { label: 'Scan results', symbols: scanSymbols },
  ].filter((g) => g.symbols.length > 0);
  const hasSymbols = symbolGroups.length > 0;

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
      setPriceNote('');
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (alertId: number) => apiRequest('DELETE', `/api/price-alerts/${alertId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
    },
  });

  const targetNum = Number(alertForm.targetPrice);
  const targetValid = alertForm.targetPrice.trim() !== '' && Number.isFinite(targetNum) && targetNum > 0;

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (alertForm.symbol && targetValid) {
      createAlertMutation.mutate(alertForm);
    }
  };

  const fetchPriceAndSetBreakout = async (symbol: string) => {
    if (!symbol) return;
    const request = ++priceRequest.current;
    setIsLoadingPrice(true);
    setPriceNote('Looking up a suggested breakout level…');
    try {
      const response = await fetch(`/api/stock-price/${encodeURIComponent(symbol.toUpperCase())}`, {
        credentials: 'include',
      });
      const data = response.ok ? await response.json() : null;
      if (request !== priceRequest.current) return;
      const suggested = Number(data?.suggestedBreakout);
      if (Number.isFinite(suggested) && suggested > 0) {
        setAlertForm((prev) => ({ ...prev, targetPrice: suggested.toFixed(2) }));
        setPriceNote(`Suggested from the last close (${price(data?.currentPrice)}). Adjust as needed.`);
      } else {
        setPriceNote('No recent price available. Enter a target price.');
      }
    } catch {
      if (request === priceRequest.current) setPriceNote('No recent price available. Enter a target price.');
    } finally {
      if (request === priceRequest.current) setIsLoadingPrice(false);
    }
  };

  const handleSymbolChange = (value: string) => {
    setAlertForm((prev) => ({ ...prev, symbol: value, targetPrice: '' }));
    fetchPriceAndSetBreakout(value);
  };

  return (
    <>
      <PageHeader title="Alerts" description="Price levels you are watching for a breakout or breakdown." />

      <div className="grid gap-x-16 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Section title={`Active alerts · ${priceAlerts.length}`}>
            {alertsLoading ? (
              <p className="py-8 text-sm text-muted-foreground">Loading alerts…</p>
            ) : priceAlerts.length === 0 ? (
              <EmptyState title="No active alerts" description="Add a price level to watch for a stock on your lists." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className={th}>Symbol</th>
                      <th className={th}>Type</th>
                      <th className={cn(th, 'text-right')}>Target</th>
                      <th className={cn(th, 'pl-6')}>Created</th>
                      <th className={th}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {priceAlerts.map((alert) => (
                      <tr key={alert.id}>
                        <td className="py-2.5">
                          <span className="inline-flex items-center gap-3">
                            <AccentBar signal={alert.alertType === 'breakdown' ? 'down' : 'warn'} orientation="vertical" />
                            <span className="font-medium text-foreground">{alert.symbol}</span>
                          </span>
                        </td>
                        <td className="py-2.5 capitalize text-muted-foreground">{alert.alertType}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-foreground">{price(alert.targetPrice)}</td>
                        <td className="py-2.5 pl-6 text-muted-foreground">
                          {alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-signal-down"
                            disabled={deleteAlertMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`Delete the ${alert.symbol} price alert?`)) {
                                deleteAlertMutation.mutate(alert.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="min-w-0">
          <Section title="New alert">
            <form onSubmit={handleCreateAlert} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Select value={alertForm.symbol} onValueChange={handleSymbolChange} disabled={!hasSymbols}>
                  <SelectTrigger id="symbol" className="w-full border-0 bg-muted">
                    <SelectValue placeholder={hasSymbols ? 'Choose a symbol' : 'No symbols yet'} />
                  </SelectTrigger>
                  <SelectContent>
                    {symbolGroups.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel className="text-xs font-normal text-muted-foreground">{group.label}</SelectLabel>
                        {group.symbols.map((symbol) => (
                          <SelectItem key={`${group.label}-${symbol}`} value={symbol}>
                            {symbol}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {!hasSymbols && (
                  <p className="text-xs text-muted-foreground">Run a scan or add stocks to a watchlist first.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="block">Alert when price</Label>
                <div className="inline-flex rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Alert type">
                  {(['breakout', 'breakdown'] as AlertType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={alertForm.alertType === type}
                      onClick={() => setAlertForm((prev) => ({ ...prev, alertType: type }))}
                      className={cn(
                        'rounded px-3 py-1 text-xs transition-colors',
                        alertForm.alertType === type
                          ? 'bg-background text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {type === 'breakout' ? 'Rises above' : 'Falls below'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetPrice">Target price</Label>
                <Input
                  id="targetPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={alertForm.targetPrice}
                  onChange={(e) => setAlertForm((prev) => ({ ...prev, targetPrice: e.target.value }))}
                  placeholder="0.00"
                  className="border-0 bg-muted font-mono"
                />
                {priceNote && <p className="text-xs text-muted-foreground">{priceNote}</p>}
              </div>

              {createAlertMutation.isError && (
                <p className="text-xs text-signal-down">Could not create the alert. Try again.</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={createAlertMutation.isPending || isLoadingPrice || !alertForm.symbol || !targetValid}
              >
                {createAlertMutation.isPending ? 'Creating…' : 'Create alert'}
              </Button>
            </form>
          </Section>
        </div>
      </div>
    </>
  );
}
