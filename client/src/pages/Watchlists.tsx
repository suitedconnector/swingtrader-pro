import { useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';
import type { PriceAlert, Watchlist } from '@shared/schema';
import TradingViewChart from '@/components/TradingViewChart';
import { YahooQuoteLink } from '@/components/YahooQuoteLink';
import { useThemeContext } from '@/components/ThemeProvider';
import { AccentBar, EmptyState, PageHeader, Section } from '@/components/layout/primitives';
import { cn } from '@/lib/utils';

type ListType = 'focus' | 'flagged';

const LIST_NAMES: Record<ListType, string> = { focus: 'Focus List', flagged: 'Flagged List' };
const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

interface StockPrice {
  symbol: string;
  currentPrice: string;
  suggestedBreakout: string;
  previousBreakout?: string | null; // level the latest day had to beat (newer servers only)
  barDate?: string;
}

const breakoutLime = 'text-lime-600 dark:text-lime-400';

const fmt = (v: string | number | null | undefined) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? '—' : n.toFixed(2);
};

const numCol = 'w-16 shrink-0 text-right font-mono tabular-nums';

// Which lists are collapsed, remembered in this browser only.
const COLLAPSED_KEY = 'watchlists.collapsed';
function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default function Watchlists() {
  const queryClient = useQueryClient();
  const { theme } = useThemeContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [newSymbol, setNewSymbol] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  const toggleList = (key: string) =>
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable (private window); the toggle still works for this visit.
      }
      return next;
    });

  const { data: watchlists = [], isLoading } = useQuery<Watchlist[]>({ queryKey: ['/api/watchlists'] });

  const focus = watchlists.find((w) => w.type === 'focus');
  const flagged = watchlists.find((w) => w.type === 'flagged');
  const others = watchlists.filter((w) => w.type !== 'focus' && w.type !== 'flagged');
  const allSymbols = watchlists.flatMap((w) => w.symbols ?? []);
  const chartSymbol = selected ?? focus?.symbols[0] ?? flagged?.symbols[0] ?? allSymbols[0] ?? null;

  // Breakout alerts you set on the Alerts page. With several for one symbol, show the lowest.
  const { data: alerts = [] } = useQuery<PriceAlert[]>({ queryKey: ['/api/price-alerts'] });
  const alertPrice = new Map<string, number>();
  for (const a of alerts) {
    const target = Number(a.targetPrice);
    if (!a.isActive || a.alertType !== 'breakout' || !Number.isFinite(target)) continue;
    const prev = alertPrice.get(a.symbol);
    if (prev === undefined || target < prev) alertPrice.set(a.symbol, target);
  }

  // Last close and suggested breakout, one lookup per symbol (cached for the session).
  const uniqueSymbols = Array.from(new Set(allSymbols));
  const priceResults = useQueries({
    queries: uniqueSymbols.map((s) => ({ queryKey: [`/api/stock-price/${s}`] })),
  });
  const prices = new Map<string, { data?: StockPrice; isLoading: boolean }>();
  uniqueSymbols.forEach((s, i) =>
    prices.set(s, { data: priceResults[i]?.data as StockPrice | undefined, isLoading: priceResults[i]?.isLoading ?? false })
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });

  const setSymbols = (list: Watchlist, symbols: string[]) =>
    apiRequest('PATCH', `/api/watchlists/${list.id}`, { symbols });

  const ensureList = async (type: ListType): Promise<Watchlist> => {
    const existing = watchlists.find((w) => w.type === type);
    if (existing) return existing;
    const res = await apiRequest('POST', '/api/watchlists', { type, name: LIST_NAMES[type], symbols: [] });
    return (await res.json()) as Watchlist;
  };

  const addMutation = useMutation({
    mutationFn: async ({ symbol, type }: { symbol: string; type: ListType }) => {
      const list = await ensureList(type);
      if (list.symbols.includes(symbol)) return;
      await setSymbols(list, [...list.symbols, symbol]);
    },
    onSuccess: (_d, { symbol }) => {
      setNewSymbol('');
      setSelected(symbol);
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ list, symbol }: { list: Watchlist; symbol: string }) =>
      setSymbols(list, list.symbols.filter((s) => s !== symbol)),
    onSuccess: (_d, { symbol }) => {
      if (selected === symbol) setSelected(null);
      invalidate();
    },
  });

  // Flagged → Focus: add to focus first, then take it off the flagged list.
  const promoteMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const focusList = await ensureList('focus');
      if (!focusList.symbols.includes(symbol)) await setSymbols(focusList, [...focusList.symbols, symbol]);
      if (flagged) await setSymbols(flagged, flagged.symbols.filter((s) => s !== symbol));
    },
    onSettled: invalidate,
  });

  const busy = addMutation.isPending || removeMutation.isPending || promoteMutation.isPending;
  const symbolInput = newSymbol.trim().toUpperCase();
  const symbolValid = SYMBOL_PATTERN.test(symbolInput);

  const renderList = (list: Watchlist | undefined, title: string, type?: ListType) => {
    const symbols = list?.symbols ?? [];
    const key = type ?? `list-${list?.id}`;
    const isCollapsed = !!collapsed[key];
    const bodyId = `watchlist-${key}`;
    return (
      <Section>
        <button
          type="button"
          onClick={() => toggleList(key)}
          aria-expanded={!isCollapsed}
          aria-controls={bodyId}
          className={cn(
            'flex w-full min-w-0 items-center gap-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground',
            !isCollapsed && 'mb-4'
          )}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isCollapsed && '-rotate-90')}
          />
          <span className="shrink-0">
            {title} · {symbols.length}
          </span>
          {isCollapsed && symbols.length > 0 && (
            <span className="min-w-0 truncate font-mono normal-case tracking-normal text-muted-foreground/70">
              {symbols.join('  ')}
            </span>
          )}
        </button>
        <div id={bodyId} hidden={isCollapsed}>
        {symbols.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            {type === 'focus' ? 'Stocks you plan to trade soon.' : type === 'flagged' ? 'Stocks to keep an eye on.' : 'Empty.'}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            <li className="flex items-center gap-2 pb-2 text-xs uppercase tracking-wider text-muted-foreground" aria-hidden="true">
              <span className="flex-1" />
              <span className={cn(numCol, 'font-sans')}>Close</span>
              <span className={cn(numCol, 'font-sans')}>Breakout</span>
              <span className="w-7 shrink-0" />
              {type === 'flagged' && (
                // Invisible copy of the row's Focus button, so the column labels line up.
                <Button size="sm" variant="ghost" className="invisible h-7 px-2 text-xs" tabIndex={-1}>
                  <ArrowUp />
                  <span className="hidden sm:inline">Focus</span>
                </Button>
              )}
              {list && <span className="w-7 shrink-0" />}
            </li>
            {symbols.map((symbol) => {
              const active = symbol === chartSymbol;
              const price = prices.get(symbol);
              const myAlert = alertPrice.get(symbol);
              const data = price?.data;
              const closeNum = Number(data?.currentPrice);
              // Show the level the latest day had to beat; older servers only send the next level.
              const level = data?.previousBreakout ?? data?.suggestedBreakout;
              const levelNum = Number(level);
              const hasClose = Number.isFinite(closeNum) && closeNum > 0;
              const beatLevel =
                hasClose && data?.previousBreakout != null && Number.isFinite(levelNum) && closeNum >= levelNum;
              const beatAlert = hasClose && myAlert !== undefined && closeNum >= myAlert;
              const brokeOut = beatLevel || beatAlert;
              const close = price?.isLoading ? '…' : fmt(data?.currentPrice);
              const breakout = price?.isLoading ? '…' : fmt(level);
              const day = data?.barDate
                ? new Date(`${data.barDate}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : 'the last trading day';
              const brokeOutNote = brokeOut
                ? `Broke out: closed ${close} on ${day}, at or above ${[
                    beatLevel ? `the breakout level ${breakout}` : '',
                    beatAlert ? `your alert ${myAlert!.toFixed(2)}` : '',
                  ]
                    .filter(Boolean)
                    .join(' and ')}.`
                : '';
              return (
                <li key={symbol} className="group flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(symbol)}
                    aria-pressed={active}
                    aria-label={`${symbol}: close ${close}, breakout level ${breakout}${
                      myAlert !== undefined ? `, your breakout alert ${myAlert.toFixed(2)}` : ''
                    }${brokeOut ? `. ${brokeOutNote}` : ''}`}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left text-sm transition-colors',
                      active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <AccentBar signal="info" orientation="vertical" className={active ? '' : 'opacity-0'} />
                      <span className="min-w-0">
                        <span className="block font-medium">{symbol}</span>
                        {myAlert !== undefined && (
                          <span className="block text-xs text-signal-warn">Alert {myAlert.toFixed(2)}</span>
                        )}
                      </span>
                    </span>
                    <span className={cn(numCol, 'text-muted-foreground')}>{close}</span>
                    <span
                      className={cn(numCol, brokeOut ? cn(breakoutLime, 'font-semibold') : 'text-foreground')}
                      title={brokeOut ? brokeOutNote : `Breakout level for ${day}: 2% above the prior day's high or 3% above its close, whichever is higher.`}
                    >
                      {breakout}
                    </span>
                  </button>
                  <YahooQuoteLink symbol={symbol} />
                  {type === 'flagged' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => promoteMutation.mutate(symbol)}
                      disabled={busy}
                      title={`Move ${symbol} to the focus list`}
                      aria-label={`Move ${symbol} to the focus list`}
                    >
                      <ArrowUp aria-hidden="true" />
                      <span className="hidden sm:inline">Focus</span>
                    </Button>
                  )}
                  {list && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-signal-down"
                      onClick={() => removeMutation.mutate({ list, symbol })}
                      disabled={busy}
                      aria-label={`Remove ${symbol} from ${list.name}`}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </Section>
    );
  };

  return (
    <>
      <PageHeader title="Watchlists" description="Your focus and flagged stocks, with a daily chart for each." />

      <div className="grid gap-x-16 lg:grid-cols-3">
        <div className="min-w-0">
          <form
            className="pb-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (symbolValid) addMutation.mutate({ symbol: symbolInput, type: 'focus' });
            }}
          >
            <label htmlFor="add-symbol" className="sr-only">
              Add a symbol
            </label>
            <div className="flex gap-2">
              <Input
                id="add-symbol"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                placeholder="Add a symbol"
                autoComplete="off"
                className="border-0 bg-muted font-mono"
              />
              <Button type="submit" size="sm" className="h-10" disabled={!symbolValid || busy}>
                Focus
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-10 text-muted-foreground hover:text-foreground"
                disabled={!symbolValid || busy}
                onClick={() => addMutation.mutate({ symbol: symbolInput, type: 'flagged' })}
              >
                Flag
              </Button>
            </div>
            {newSymbol && !symbolValid && (
              <p className="pt-2 text-xs text-signal-down">Use a ticker like AAPL or BRK.B.</p>
            )}
            {(addMutation.isError || removeMutation.isError || promoteMutation.isError) && (
              <p className="pt-2 text-xs text-signal-down">Could not update the list. Try again.</p>
            )}
          </form>

          {isLoading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading watchlists…</p>
          ) : (
            <>
              {renderList(focus, 'Focus', 'focus')}
              {renderList(flagged, 'Flagged', 'flagged')}
              {others.map((list) => (
                <div key={list.id}>{renderList(list, list.name)}</div>
              ))}
            </>
          )}
        </div>

        <div className="min-w-0 lg:col-span-2">
          <Section title={chartSymbol ? `Chart · ${chartSymbol}` : 'Chart'}>
            {chartSymbol ? (
              <TradingViewChart
                key={`${chartSymbol}-${theme}`}
                symbol={chartSymbol}
                height={520}
                interval="D"
                theme={theme === 'dark' ? 'dark' : 'light'}
              />
            ) : (
              <EmptyState
                title="No stocks yet"
                description="Add a symbol, or flag stocks from the Scanner, to see their charts here."
              />
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
