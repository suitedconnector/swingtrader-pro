import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import type { Trade } from '@shared/schema';
import { EmptyState, PageHeader, Section, Stat } from '@/components/layout/primitives';
import { cn } from '@/lib/utils';
import { YahooQuoteLink } from '@/components/YahooQuoteLink';

const TRIM_PERCENT = 25;

const th = 'pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground';

const usd = (n: number, digits = 2) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const price = (v: string | number | null | undefined) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? '—' : n.toFixed(2);
};

const RULES = [
  { title: 'Taking profit', items: ['Trim 10–30% at 5× risk', 'Move stop to break-even', 'Full exit on a close below the 10 SMA'] },
  { title: 'Managing risk', items: ['Stop at the low of the entry day', 'Max 1% of the account at risk per trade', "Don't try to time the top"] },
];

export default function Positions() {
  const queryClient = useQueryClient();
  const [exitTrade, setExitTrade] = useState<Trade | null>(null);
  // 'exit' sells every share; 'trim' sells some and keeps the trade open.
  const [mode, setMode] = useState<'exit' | 'trim'>('exit');
  const [trimShares, setTrimShares] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [priceNote, setPriceNote] = useState('');
  // Ignores a slow price lookup that finishes after another Exit was opened.
  const exitRequest = useRef(0);

  const { data: trades = [], isLoading } = useQuery<Trade[]>({
    queryKey: ['/api/trades'],
  });
  // The API returns every trade; only open ones are managed here.
  const activeTrades = trades.filter((t) => t.status === 'active');

  const updateTradeMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest('PATCH', `/api/trades/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
    },
  });

  // The server saves the sold shares as a closed "trim" trade with its P&L
  // and lowers the open trade's shares and risk.
  const trimTradeMutation = useMutation({
    mutationFn: ({ id, shares, exitPrice }: { id: number; shares: number; exitPrice: string }) =>
      apiRequest('POST', `/api/trades/${id}/trim`, { shares, exitPrice }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
    },
  });

  // Default trim size: 25% of the shares, at least 1, always leaving 1 open.
  const defaultTrim = (trade: Trade) =>
    Math.min(trade.shares - 1, Math.max(1, Math.floor(trade.shares * (TRIM_PERCENT / 100))));

  const busy = updateTradeMutation.isPending || trimTradeMutation.isPending;

  const openExit = async (trade: Trade, nextMode: 'exit' | 'trim' = 'exit') => {
    const request = ++exitRequest.current;
    updateTradeMutation.reset();
    trimTradeMutation.reset();
    setMode(nextMode);
    setTrimShares(nextMode === 'trim' ? String(defaultTrim(trade)) : '');
    setExitTrade(trade);
    setExitPrice('');
    setPriceNote('Fetching the last close…');
    try {
      const response = await fetch(`/api/stock-price/${encodeURIComponent(trade.symbol)}`, {
        credentials: 'include',
      });
      const data = response.ok ? await response.json() : null;
      const last = Number(data?.currentPrice);
      if (request !== exitRequest.current) return;
      if (Number.isFinite(last) && last > 0) {
        setExitPrice(last.toFixed(2));
        setPriceNote('Prefilled with the last close. Change it to your actual fill.');
      } else {
        setPriceNote('No recent price available. Enter your fill price.');
      }
    } catch {
      if (request !== exitRequest.current) return;
      setPriceNote('No recent price available. Enter your fill price.');
    }
  };

  const exitPriceNum = Number(exitPrice);
  const exitPriceValid = exitPrice.trim() !== '' && Number.isFinite(exitPriceNum) && exitPriceNum > 0;
  const trimSharesNum = Number(trimShares);
  const trimSharesValid =
    exitTrade !== null && Number.isInteger(trimSharesNum) && trimSharesNum >= 1 && trimSharesNum < exitTrade.shares;
  const soldShares = mode === 'trim' ? (trimSharesValid ? trimSharesNum : null) : exitTrade?.shares ?? null;
  const exitPnl =
    exitTrade && exitPriceValid && soldShares !== null ? (exitPriceNum - Number(exitTrade.entryPrice)) * soldShares : null;
  const activeError = mode === 'trim' ? trimTradeMutation.isError : updateTradeMutation.isError;

  const confirmTrim = () => {
    if (!exitTrade || !exitPriceValid || !trimSharesValid) return;
    trimTradeMutation.mutate(
      { id: exitTrade.id, shares: trimSharesNum, exitPrice: exitPriceNum.toFixed(2) },
      { onSuccess: () => setExitTrade(null) }
    );
  };

  const confirmExit = () => {
    if (!exitTrade || !exitPriceValid || exitPnl === null) return;
    updateTradeMutation.mutate(
      {
        id: exitTrade.id,
        updates: {
          status: 'closed',
          exitDate: new Date(),
          exitPrice: exitPriceNum.toFixed(2),
          pnl: exitPnl.toFixed(2),
          exitReason: 'manual_exit',
        },
      },
      { onSuccess: () => setExitTrade(null) }
    );
  };

  const openRisk = activeTrades.reduce((sum, t) => sum + (Number(t.riskAmount) || 0), 0);
  const exposure = activeTrades.reduce((sum, t) => sum + Number(t.entryPrice) * t.shares, 0);

  return (
    <>
      <PageHeader title="Positions" description="Open trades, with trim and exit controls." />

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 pb-6 lg:grid-cols-4">
        <Stat label="Open positions" value={activeTrades.length} />
        <Stat label="Open risk" value={usd(openRisk, 0)} signal="info" />
        <Stat label="Exposure" value={usd(exposure, 0)} hint="At entry prices" />
      </div>

      <Section title="Open positions">
        {isLoading ? (
          <p className="py-8 text-sm text-muted-foreground">Loading positions…</p>
        ) : activeTrades.length === 0 ? (
          <EmptyState
            title="No open positions"
            description="Trades you place from the Trade Planner appear here."
            action={
              <Link href="/plan" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                Open the trade planner →
              </Link>
            }
          />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className={th}>Symbol</th>
                  <th className={cn(th, 'text-right')}>Shares</th>
                  <th className={cn(th, 'text-right')}>Entry</th>
                  <th className={cn(th, 'text-right')}>Stop</th>
                  <th className={cn(th, 'text-right')}>Target</th>
                  <th className={cn(th, 'text-right')}>Risk</th>
                  <th className={cn(th, 'pl-6')}>Opened</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {activeTrades.map((trade) => (
                  <tr key={trade.id}>
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium text-foreground">{trade.symbol}</span>
                        <YahooQuoteLink symbol={trade.symbol} />
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{trade.shares}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{price(trade.entryPrice)}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-signal-down">{price(trade.stopLoss)}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{price(trade.profitTarget)}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{usd(Number(trade.riskAmount) || 0, 0)}</td>
                    <td className="py-2.5 pl-6 text-muted-foreground">
                      {trade.entryDate ? new Date(trade.entryDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => openExit(trade, 'trim')}
                          disabled={busy || trade.shares < 2}
                          title={trade.shares < 2 ? 'Only 1 share left. Use Exit.' : 'Sell part of this position'}
                        >
                          Trim
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-signal-down hover:text-signal-down"
                          onClick={() => openExit(trade)}
                          disabled={busy}
                        >
                          Exit
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Rules">
        <div className="grid gap-8 sm:grid-cols-2">
          {RULES.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-foreground">{group.title}</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Dialog open={exitTrade !== null} onOpenChange={(open) => !open && setExitTrade(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {mode === 'trim' ? 'Trim' : 'Close'} {exitTrade?.symbol}
            </DialogTitle>
            <DialogDescription>
              {mode === 'trim'
                ? `Sells part of your ${exitTrade?.shares} shares. The sold shares and their P&L go to the journal; the rest stays open.`
                : `Marks all ${exitTrade?.shares} shares as sold and moves the trade to the journal.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {mode === 'trim' && exitTrade && (
              <div className="space-y-2 pb-2">
                <Label htmlFor="trim-shares">Shares to sell</Label>
                <Input
                  id="trim-shares"
                  inputMode="numeric"
                  value={trimShares}
                  onChange={(e) => setTrimShares(e.target.value)}
                  className="font-mono"
                />
                <p className={cn('text-xs', trimShares !== '' && !trimSharesValid ? 'text-signal-down' : 'text-muted-foreground')}>
                  {trimSharesValid
                    ? `${exitTrade.shares - trimSharesNum} shares stay open.`
                    : `Enter 1 to ${exitTrade.shares - 1}. To sell all ${exitTrade.shares}, use Exit.`}
                </p>
              </div>
            )}
            <Label htmlFor="exit-price">{mode === 'trim' ? 'Sale price' : 'Exit price'}</Label>
            <Input
              id="exit-price"
              inputMode="decimal"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{priceNote}</p>
            {exitPnl !== null && (
              <p className="text-sm">
                <span className="text-muted-foreground">P&amp;L </span>
                <span className={cn('font-mono tabular-nums', exitPnl < 0 ? 'text-signal-down' : 'text-signal-up')}>
                  {exitPnl > 0 ? '+' : ''}
                  {usd(exitPnl)}
                </span>
              </p>
            )}
            {activeError && (
              <p className="text-xs text-signal-down">
                {mode === 'trim' ? 'Could not save the trim. Try again.' : 'Could not close the trade. Try again.'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExitTrade(null)}>
              Cancel
            </Button>
            {mode === 'trim' ? (
              <Button onClick={confirmTrim} disabled={!exitPriceValid || !trimSharesValid || busy}>
                {trimTradeMutation.isPending ? 'Saving…' : 'Save trim'}
              </Button>
            ) : (
              <Button onClick={confirmExit} disabled={!exitPriceValid || busy}>
                {updateTradeMutation.isPending ? 'Closing…' : 'Close position'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
