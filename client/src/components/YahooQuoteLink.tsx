import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

// Yahoo writes class shares with a dash (BRK-B); the app uses a dot (BRK.B).
export const yahooQuoteUrl = (symbol: string) =>
  `https://finance.yahoo.com/quote/${encodeURIComponent(symbol.toUpperCase().replace(/\./g, '-'))}/`;

/**
 * Opens Yahoo Finance's live quote for a symbol in a separate pop-up window.
 * Yahoo does not allow its pages inside other sites, so this cannot be an
 * in-app dialog. Every click reuses the same pop-up window. If the browser
 * blocks pop-ups, the link opens in a new tab instead.
 */
export function YahooQuoteLink({ symbol, className }: { symbol: string; className?: string }) {
  const url = yahooQuoteUrl(symbol);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${symbol} live quote on Yahoo Finance`}
      aria-label={`Open the ${symbol} live quote on Yahoo Finance in a pop-up window`}
      onClick={(e) => {
        const popup = window.open(url, 'yahoo-quote', 'popup,width=1040,height=780');
        if (popup) {
          e.preventDefault();
          popup.opener = null;
          popup.focus();
        }
      }}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className
      )}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}
