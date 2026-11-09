import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import type { PriceAlert, Trade, Watchlist } from '@shared/schema';
import {
  AccentBar,
  EmptyState,
  PageHeader,
  Section,
  Stat,
  type Signal,
} from '@/components/layout/primitives';

interface MarketQuote {
  price?: string;
  change?: string;
}

interface MarketData {
  spy?: MarketQuote;
  nasdaq?: MarketQuote;
}

interface Profile {
  tradingBankroll?: string | number | null;
}

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

/** Regular US session, Mon–Fri 9:30–16:00 New York time (exchange holidays not included). */
function marketSession(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday');
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const weekend = weekday === 'Sat' || weekday === 'Sun';
  const open = !weekend && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
  return { open, weekend };
}

function ViewAll({ href, children = 'View all' }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
      {children}
    </Link>
  );
}

const rowClass = 'flex items-center justify-between gap-4 py-3 text-sm';

export default function Overview() {
  const { data: profile } = useQuery<Profile>({
    queryKey: ['/api/profile'],
    queryFn: async () => {
      const res = await fetch('/api/profile', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
  });
  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({ queryKey: ['/api/trades'] });
  const { data: alerts = [] } = useQuery<PriceAlert[]>({ queryKey: ['/api/price-alerts'] });
  const { data: watchlists = [] } = useQuery<Watchlist[]>({ queryKey: ['/api/watchlists'] });
  const { data: market, isLoading: marketLoading, isError: marketError } = useQuery<MarketData>({
    queryKey: ['/api/market-data'],
  });

  const openTrades = trades.filter((t) => t.status === 'active');
  const closedTrades = trades.filter((t) => t.status === 'closed' && t.pnl !== null);
  const wins = closedTrades.filter((t) => Number(t.pnl) > 0).length;
  const realized = closedTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
  const openRisk = openTrades.reduce((sum, t) => sum + (Number(t.riskAmount) || 0), 0);
  const activeAlerts = alerts.filter((a) => a.isActive);

  const bankrollNum = Number(profile?.tradingBankroll);
  const bankroll = Number.isFinite(bankrollNum) && bankrollNum > 0 ? bankrollNum : null;
  const riskPct = bankroll ? (openRisk / bankroll) * 100 : null;

  const focus = watchlists.find((w) => w.type === 'focus');
  const flagged = watchlists.find((w) => w.type === 'flagged');

  const session = marketSession();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const realizedSignal: Signal = realized > 0 ? 'up' : realized < 0 ? 'down' : 'neutral';

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          <span className="inline-flex items-center gap-2">
            {today}
            <span aria-hidden="true">·</span>
            <AccentBar signal={session.open ? 'up' : 'neutral'} className="w-3" />
            {session.open ? 'Market open' : session.weekend ? 'Market closed for the weekend' : 'Market closed'}
          </span>
        }
      />

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-8 pb-10 lg:grid-cols-4">
        <Stat label="Bankroll" value={bankroll ? usd(bankroll, 0) : '—'} hint={bankroll ? undefined : 'Set it in Settings'} />
        <Stat
          label="Open risk"
          value={usd(openRisk, 0)}
          hint={riskPct === null ? undefined : `${riskPct.toFixed(1)}% of bankroll`}
          signal={riskPct !== null && riskPct > 6 ? 'warn' : 'info'}
        />
        <Stat
          label="Realized P&L"
          value={`${realized > 0 ? '+' : ''}${usd(realized)}`}
          hint={`${closedTrades.length} closed ${closedTrades.length === 1 ? 'trade' : 'trades'}`}
          signal={realizedSignal}
          colorValue={realized !== 0}
        />
        <Stat
          label="Win rate"
          value={closedTrades.length ? `${((wins / closedTrades.length) * 100).toFixed(0)}%` : '—'}
          hint={closedTrades.length ? `${wins} of ${closedTrades.length}` : 'No closed trades yet'}
        />
      </div>

      <div className="grid gap-x-16 lg:grid-cols-3">
        {/* Main column */}
        <div className="min-w-0 lg:col-span-2">
          <Section title={`Open positions · ${openTrades.length}`} actions={<ViewAll href="/positions" />}>
            {tradesLoading ? (
              <p className="py-3 text-sm text-muted-foreground">Loading…</p>
            ) : openTrades.length === 0 ? (
              <EmptyState
                className="py-8"
                title="No open positions"
                description="Plan a trade to size it against your bankroll."
                action={<ViewAll href="/plan">Open the trade planner →</ViewAll>}
              />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 font-medium">Symbol</th>
                      <th className="pb-2 text-right font-medium">Shares</th>
                      <th className="pb-2 text-right font-medium">Entry</th>
                      <th className="pb-2 text-right font-medium">Stop</th>
                      <th className="pb-2 text-right font-medium">Target</th>
                      <th className="pb-2 text-right font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono tabular-nums">
                    {openTrades.slice(0, 6).map((t) => (
                      <tr key={t.id}>
                        <td className="py-3 font-sans font-medium text-foreground">{t.symbol}</td>
                        <td className="py-3 text-right">{t.shares}</td>
                        <td className="py-3 text-right">{price(t.entryPrice)}</td>
                        <td className="py-3 text-right text-signal-down">{price(t.stopLoss)}</td>
                        <td className="py-3 text-right">{price(t.profitTarget)}</td>
                        <td className="py-3 text-right">{usd(Number(t.riskAmount) || 0, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {openTrades.length > 6 && (
                  <p className="pt-3 text-xs text-muted-foreground">+{openTrades.length - 6} more</p>
                )}
              </div>
            )}
          </Section>

          <Section title={`Active alerts · ${activeAlerts.length}`} actions={<ViewAll href="/alerts" />}>
            {activeAlerts.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No active price alerts.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {activeAlerts.slice(0, 5).map((a) => (
                  <div key={a.id} className={rowClass}>
                    <span className="inline-flex items-center gap-3">
                      <AccentBar signal="warn" orientation="vertical" />
                      <span className="font-medium text-foreground">{a.symbol}</span>
                      <span className="capitalize text-muted-foreground">{a.alertType}</span>
                    </span>
                    <span className="font-mono tabular-nums text-foreground">{price(a.targetPrice)}</span>
                  </div>
                ))}
                {activeAlerts.length > 5 && (
                  <p className="pt-3 text-xs text-muted-foreground">+{activeAlerts.length - 5} more</p>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* Side column */}
        <div className="min-w-0">
          <Section title="Market">
            {marketLoading ? (
              <p className="py-3 text-sm text-muted-foreground">Loading…</p>
            ) : marketError || !market ? (
              <p className="py-3 text-sm text-muted-foreground">Market data unavailable right now.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {[
                  { label: 'SPY', sub: 'S&P 500', q: market.spy },
                  { label: 'QQQ', sub: 'Nasdaq-100', q: market.nasdaq },
                ].map(({ label, sub, q }) => (
                  <div key={label} className={rowClass}>
                    <span>
                      <span className="font-medium text-foreground">{label}</span>
                      <span className="ml-2 text-muted-foreground">{sub}</span>
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      <span className="text-foreground">{price(q?.price)}</span>
                      {q?.change && (
                        <span
                          className={`ml-2 text-xs ${q.change.startsWith('-') ? 'text-signal-down' : 'text-signal-up'}`}
                        >
                          {q.change}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                <p className="pt-3 text-xs text-muted-foreground">Last daily close</p>
              </div>
            )}
          </Section>

          <Section title="Watchlists" actions={<ViewAll href="/watchlists" />}>
            <div className="divide-y divide-border/60">
              <div className="py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Focus</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{focus?.symbols.length ?? 0}</span>
                </div>
                {focus && focus.symbols.length > 0 && (
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {focus.symbols.slice(0, 8).join('  ')}
                    {focus.symbols.length > 8 ? '  …' : ''}
                  </p>
                )}
              </div>
              <div className={rowClass}>
                <span className="text-foreground">Flagged</span>
                <span className="font-mono tabular-nums text-muted-foreground">{flagged?.symbols.length ?? 0}</span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
