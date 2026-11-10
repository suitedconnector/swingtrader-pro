import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import type { Trade } from '@shared/schema';
import { EmptyState, PageHeader, Section, Stat, type Signal } from '@/components/layout/primitives';
import { cn } from '@/lib/utils';

const th = 'pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground';

const EXIT_REASONS: Record<string, string> = {
  stop_loss: 'Stop hit',
  profit_target: 'Target hit',
  manual_exit: 'Manual',
  trim: 'Trim',
};

const usd = (n: number, digits = 2) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${usd(Math.abs(n))}`;

const price = (v: string | number | null | undefined) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? '—' : n.toFixed(2);
};

const time = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

const REVIEW_POINTS = [
  'Review the charts of winners and losers',
  'Look for patterns in the setups that worked',
  'Check whether entries and exits followed your rules',
  'Check position sizing and risk per trade',
  'Write down one lesson for next time',
];

export default function Journal() {
  const { data: trades = [], isLoading } = useQuery<Trade[]>({ queryKey: ['/api/trades'] });

  const openCount = trades.filter((t) => t.status === 'active').length;
  const closed = trades
    .filter((t) => t.status === 'closed')
    .sort((a, b) => time(b.exitDate ?? b.entryDate) - time(a.exitDate ?? a.entryDate));
  const pnlOf = (t: Trade) => Number(t.pnl) || 0;
  // Trims (part of a position sold early) count toward P&L totals, but win
  // rate, trade count and average win/loss use full closes only.
  const fullCloses = closed.filter((t) => t.exitReason !== 'trim');
  const wins = fullCloses.filter((t) => pnlOf(t) > 0);
  const losses = fullCloses.filter((t) => pnlOf(t) < 0);

  const totalPnl = closed.reduce((s, t) => s + pnlOf(t), 0);
  const grossWin = closed.filter((t) => pnlOf(t) > 0).reduce((s, t) => s + pnlOf(t), 0);
  const grossLoss = Math.abs(closed.filter((t) => pnlOf(t) < 0).reduce((s, t) => s + pnlOf(t), 0));
  const winRate = fullCloses.length ? (wins.length / fullCloses.length) * 100 : null;
  const avgWin = wins.length ? wins.reduce((s, t) => s + pnlOf(t), 0) / wins.length : null;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + pnlOf(t), 0)) / losses.length : null;
  const trimCount = closed.length - fullCloses.length;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;
  const payoff = avgWin !== null && avgLoss !== null ? avgWin / avgLoss : null;

  const pnlSignal: Signal = totalPnl > 0 ? 'up' : totalPnl < 0 ? 'down' : 'neutral';

  return (
    <>
      <PageHeader title="Journal" description="Closed trades and how your trading is performing." />

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 pb-6 lg:grid-cols-4">
        <Stat
          label="Total P&L"
          value={signed(totalPnl)}
          signal={pnlSignal}
          colorValue={totalPnl !== 0}
          hint="Closed trades"
        />
        <Stat
          label="Win rate"
          value={winRate !== null ? `${winRate.toFixed(0)}%` : '—'}
          hint={fullCloses.length ? `${wins.length} won · ${losses.length} lost` : 'No closed trades yet'}
        />
        <Stat
          label="Profit factor"
          value={profitFactor !== null ? profitFactor.toFixed(2) : '—'}
          hint="Gross wins ÷ gross losses"
        />
        <Stat
          label="Trades"
          value={fullCloses.length}
          hint={`${openCount} still open${trimCount ? ` · ${trimCount} ${trimCount === 1 ? 'trim' : 'trims'}` : ''}`}
        />
      </div>

      <div className="grid gap-x-16 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Section title="Closed trades">
            {isLoading ? (
              <p className="py-8 text-sm text-muted-foreground">Loading trades…</p>
            ) : closed.length === 0 ? (
              <EmptyState
                title="No closed trades yet"
                description="Trades appear here when they hit their stop or target, or when you exit them."
                action={
                  openCount > 0 ? (
                    <Link href="/positions" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                      View open positions →
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className={th}>Closed</th>
                      <th className={th}>Symbol</th>
                      <th className={cn(th, 'text-right')}>Shares</th>
                      <th className={cn(th, 'text-right')}>Entry</th>
                      <th className={cn(th, 'text-right')}>Exit</th>
                      <th className={cn(th, 'text-right')}>P&amp;L</th>
                      <th className={cn(th, 'text-right')}>R</th>
                      <th className={cn(th, 'pl-6')}>Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {closed.map((t) => {
                      const pnl = pnlOf(t);
                      const risk = Number(t.riskAmount);
                      const r = t.pnl !== null && risk > 0 ? pnl / risk : null;
                      return (
                        <tr key={t.id}>
                          <td className="py-2.5 text-muted-foreground">
                            {t.exitDate ? new Date(t.exitDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-2.5 font-medium text-foreground">{t.symbol}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">{t.shares}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">{price(t.entryPrice)}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">{price(t.exitPrice)}</td>
                          <td
                            className={cn(
                              'py-2.5 text-right font-mono tabular-nums',
                              t.pnl === null ? 'text-muted-foreground' : pnl < 0 ? 'text-signal-down' : pnl > 0 ? 'text-signal-up' : ''
                            )}
                          >
                            {t.pnl === null ? '—' : signed(pnl)}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                            {r === null ? '—' : `${r > 0 ? '+' : ''}${r.toFixed(1)}R`}
                          </td>
                          <td className="py-2.5 pl-6 text-muted-foreground">
                            {t.exitReason ? EXIT_REASONS[t.exitReason] ?? t.exitReason : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="min-w-0">
          <Section title="Performance">
            <dl className="divide-y divide-border/60 text-sm">
              {[
                ['Average win', avgWin !== null ? usd(avgWin) : '—', 'text-signal-up'],
                ['Average loss', avgLoss !== null ? `−${usd(avgLoss)}` : '—', 'text-signal-down'],
                ['Win / loss size', payoff !== null ? `${payoff.toFixed(2)} : 1` : '—', ''],
                ['Gross wins', usd(grossWin), ''],
                ['Gross losses', grossLoss ? `−${usd(grossLoss)}` : usd(0), ''],
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={cn('font-mono tabular-nums', value !== '—' && color ? color : 'text-foreground')}>{value}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Review">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {REVIEW_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
