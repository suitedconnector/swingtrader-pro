import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import type { ScanResult, Trade, Watchlist } from '@shared/schema';
import { PageHeader, Section, Stat } from '@/components/layout/primitives';
import { cn } from '@/lib/utils';

const MAX_RISK_PERCENT = 5;
const STOP_BELOW_ENTRY = 0.08; // 8% below entry
const REWARD_MULTIPLE = 2; // 2:1 reward to risk
const CONCENTRATION_WARN = 30; // % of bankroll in one position

const usd = (n: number, digits = 2) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const num = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) ? n : null;
};

const fieldClass = 'border-0 bg-muted font-mono';

const emptyForm = { symbol: '', entryPrice: '', stopLoss: '', profitTarget: '' };

export function EntryPhase() {
  const queryClient = useQueryClient();

  const { data: userProfile } = useQuery<{ tradingBankroll?: string | number | null }>({
    queryKey: ['/api/profile'],
    queryFn: async () => {
      const res = await fetch('/api/profile', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
  });
  const { data: trades = [] } = useQuery<Trade[]>({ queryKey: ['/api/trades'] });
  const { data: watchlists = [] } = useQuery<Watchlist[]>({ queryKey: ['/api/watchlists'] });
  const { data: scanResults = [] } = useQuery<ScanResult[]>({ queryKey: ['/api/scan-results'] });

  // Bankroll comes from Settings; it can be overridden here for one plan.
  const [bankroll, setBankroll] = useState('');
  const [bankrollTouched, setBankrollTouched] = useState(false);
  useEffect(() => {
    const saved = Number(userProfile?.tradingBankroll);
    if (!bankrollTouched && Number.isFinite(saved) && saved > 0) setBankroll(String(saved));
  }, [userProfile, bankrollTouched]);

  const [riskPercent, setRiskPercent] = useState('1');
  const [form, setForm] = useState(emptyForm);
  const [priceNote, setPriceNote] = useState('');
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [recorded, setRecorded] = useState<string | null>(null);
  // Ignores a slow price lookup that finishes after another symbol was picked.
  const priceRequest = useRef(0);

  // Symbols: focus list, flagged list, other watchlists, then scan results.
  const groups: { label: string; symbols: string[] }[] = [];
  const seen = new Set<string>();
  const addGroup = (label: string, symbols: string[]) => {
    const fresh = symbols.filter((s) => s && !seen.has(s));
    fresh.forEach((s) => seen.add(s));
    if (fresh.length) groups.push({ label, symbols: fresh });
  };
  addGroup('Focus list', watchlists.find((w) => w.type === 'focus')?.symbols ?? []);
  addGroup('Flagged list', watchlists.find((w) => w.type === 'flagged')?.symbols ?? []);
  addGroup(
    'Other watchlists',
    watchlists.filter((w) => w.type !== 'focus' && w.type !== 'flagged').flatMap((w) => w.symbols ?? [])
  );
  addGroup('Scan results', scanResults.map((r) => r.symbol));

  const suggestPrices = async (symbol: string) => {
    const request = ++priceRequest.current;
    setIsLoadingPrice(true);
    setPriceNote('Looking up the last close…');
    try {
      const response = await fetch(`/api/stock-price/${encodeURIComponent(symbol)}`, { credentials: 'include' });
      const data = response.ok ? await response.json() : null;
      if (request !== priceRequest.current) return;
      const last = Number(data?.currentPrice);
      const entry = Number(data?.suggestedBreakout);
      if (Number.isFinite(entry) && entry > 0) {
        const stop = entry * (1 - STOP_BELOW_ENTRY);
        const target = entry + (entry - stop) * REWARD_MULTIPLE;
        setForm((prev) => ({
          ...prev,
          entryPrice: entry.toFixed(2),
          stopLoss: stop.toFixed(2),
          profitTarget: target.toFixed(2),
        }));
        setPriceNote(
          `Suggested from the last close${Number.isFinite(last) ? ` (${last.toFixed(2)})` : ''}: breakout entry, stop 8% below, target at 2:1. Adjust to your chart.`
        );
      } else {
        setPriceNote('No recent price available. Enter entry, stop and target yourself.');
      }
    } catch {
      if (request === priceRequest.current) setPriceNote('No recent price available. Enter entry, stop and target yourself.');
    } finally {
      if (request === priceRequest.current) setIsLoadingPrice(false);
    }
  };

  const handleSymbol = (symbol: string) => {
    setRecorded(null);
    setForm({ ...emptyForm, symbol });
    suggestPrices(symbol);
  };

  // Position sizing
  const balance = num(bankroll) ?? 0;
  const riskPct = num(riskPercent);
  const entry = num(form.entryPrice);
  const stop = num(form.stopLoss);
  const target = num(form.profitTarget);

  const riskPctValid = riskPct !== null && riskPct > 0 && riskPct <= MAX_RISK_PERCENT;
  const stopValid = entry !== null && stop !== null && stop > 0 && stop < entry;
  const targetValid = target === null || (entry !== null && target > entry);

  const riskAmount = balance > 0 && riskPctValid ? balance * (riskPct! / 100) : 0;
  const riskPerShare = stopValid ? entry! - stop! : 0;
  const shares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
  const positionValue = entry !== null ? shares * entry : 0;
  const percentOfAccount = balance > 0 ? (positionValue / balance) * 100 : 0;
  // Risk actually taken after rounding down to whole shares.
  const actualRisk = shares * riskPerShare;
  const rewardMultiple = stopValid && target !== null && targetValid ? (target - entry!) / riskPerShare : null;

  const openRisk = trades
    .filter((t) => t.status === 'active')
    .reduce((sum, t) => sum + (Number(t.riskAmount) || 0), 0);
  const openRiskPct = balance > 0 ? (openRisk / balance) * 100 : null;
  const riskAfterPct = balance > 0 ? ((openRisk + actualRisk) / balance) * 100 : null;

  const canRecord = Boolean(form.symbol) && stopValid && targetValid && shares > 0;

  const createTradeMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/trades', {
        symbol: form.symbol.toUpperCase(),
        entryPrice: entry!.toFixed(2),
        stopLoss: stop!.toFixed(2),
        profitTarget: target !== null ? target.toFixed(2) : null,
        shares,
        riskAmount: actualRisk.toFixed(2),
        status: 'active',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
      setRecorded(`${shares} ${form.symbol}`);
      setForm(emptyForm);
      setPriceNote('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canRecord) createTradeMutation.mutate();
  };

  return (
    <>
      <PageHeader title="Trade Planner" description="Size a position from your bankroll and the risk you take per trade." />

      <div className="grid gap-x-16 lg:grid-cols-5">
        <form onSubmit={handleSubmit} className="min-w-0 lg:col-span-3" noValidate>
          <Section title="Trade">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Select value={form.symbol} onValueChange={handleSymbol} disabled={groups.length === 0}>
                  <SelectTrigger id="symbol" className="w-full border-0 bg-muted">
                    <SelectValue placeholder={groups.length ? 'Choose a symbol' : 'No symbols yet'} />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {groups.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel className="text-xs font-normal text-muted-foreground">{group.label}</SelectLabel>
                        {group.symbols.map((symbol) => (
                          <SelectItem key={symbol} value={symbol}>
                            {symbol}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {groups.length === 0 && (
                  <p className="text-xs text-muted-foreground">Run a scan or add stocks to a watchlist first.</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {(
                  [
                    ['entryPrice', 'Entry'],
                    ['stopLoss', 'Stop'],
                    ['profitTarget', 'Target'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder={key === 'profitTarget' ? 'Optional' : '0.00'}
                      value={form[key]}
                      onChange={(e) => {
                        setRecorded(null);
                        setForm((prev) => ({ ...prev, [key]: e.target.value }));
                      }}
                      className={fieldClass}
                    />
                  </div>
                ))}
              </div>
              {priceNote && <p className="text-xs text-muted-foreground">{priceNote}</p>}
              {entry !== null && stop !== null && !stopValid && (
                <p className="text-xs text-signal-down">The stop must be above 0 and below the entry.</p>
              )}
              {!targetValid && <p className="text-xs text-signal-down">The target must be above the entry.</p>}
            </div>
          </Section>

          <Section title="Risk">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bankroll">Bankroll</Label>
                <Input
                  id="bankroll"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={bankroll}
                  onChange={(e) => {
                    setBankrollTouched(true);
                    setBankroll(e.target.value);
                  }}
                  placeholder="Set in Settings"
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="riskPercent">Risk per trade (%)</Label>
                <Input
                  id="riskPercent"
                  type="number"
                  min="0.1"
                  max={MAX_RISK_PERCENT}
                  step="0.1"
                  inputMode="decimal"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
            {!riskPctValid && (
              <p className="pt-2 text-xs text-signal-down">Risk per trade must be above 0 and at most {MAX_RISK_PERCENT}%.</p>
            )}
            {bankrollTouched && (
              <p className="pt-2 text-xs text-muted-foreground">This change applies to this plan only. Your saved bankroll is in Settings.</p>
            )}
          </Section>
        </form>

        <div className="min-w-0 lg:col-span-2">
          <Section title="Position">
            <div className="grid grid-cols-2 gap-x-8 gap-y-8">
              <Stat label="Shares" value={shares} signal={shares > 0 ? 'info' : undefined} />
              <Stat label="Risk" value={usd(actualRisk)} hint={riskPerShare > 0 ? `${usd(riskPerShare)} per share` : undefined} />
              <Stat
                label="Position value"
                value={usd(positionValue, 0)}
                hint={balance > 0 ? `${percentOfAccount.toFixed(1)}% of bankroll` : undefined}
                signal={percentOfAccount > CONCENTRATION_WARN ? 'warn' : undefined}
              />
              <Stat label="Reward : risk" value={rewardMultiple !== null ? `${rewardMultiple.toFixed(1)} : 1` : '—'} />
            </div>
          </Section>

          <Section title="Open risk">
            <p className="text-sm text-muted-foreground">
              Now <span className="font-mono tabular-nums text-foreground">{usd(openRisk, 0)}</span>
              {openRiskPct !== null && <span> ({openRiskPct.toFixed(1)}%)</span>}
              {shares > 0 && riskAfterPct !== null && (
                <>
                  {' '}
                  · after this trade{' '}
                  <span className="font-mono tabular-nums text-foreground">{riskAfterPct.toFixed(1)}%</span>
                </>
              )}
            </p>
          </Section>

          {percentOfAccount > CONCENTRATION_WARN && (
            <p className="pb-4 text-xs text-signal-warn">
              This position is over {CONCENTRATION_WARN}% of your bankroll. Consider a smaller size.
            </p>
          )}

          <Button
            type="button"
            className="w-full"
            onClick={() => canRecord && createTradeMutation.mutate()}
            disabled={!canRecord || isLoadingPrice || createTradeMutation.isPending}
          >
            {createTradeMutation.isPending ? 'Saving…' : 'Add to positions'}
          </Button>
          <p className="pt-2 text-xs text-muted-foreground">Records the trade here. It does not place an order with a broker.</p>
          {createTradeMutation.isError && (
            <p className="pt-2 text-xs text-signal-down">Could not save the trade. Try again.</p>
          )}
          {recorded && (
            <p className={cn('pt-2 text-xs text-foreground')}>
              Added {recorded} shares.{' '}
              <Link href="/positions" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                View positions →
              </Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
