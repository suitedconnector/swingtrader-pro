import { useEffect, useRef, memo } from 'react';

export interface TradingViewChartProps {
  symbol: string;
  width?: string | number;
  height?: string | number;
  interval?: string;
  timezone?: string;
  theme?: 'light' | 'dark';
  style?: string;
  locale?: string;
  toolbar_bg?: string;
  enable_publishing?: boolean;
  allow_symbol_change?: boolean;
  container_id?: string;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

function TradingViewChart({
  symbol,
  width = "100%",
  height = 500,
  interval = "D",
  timezone = "Etc/UTC",
  theme = "light",
  style = "1",
  locale = "en",
  toolbar_bg = "#f1f3f6",
  enable_publishing = false,
  allow_symbol_change = true,
  container_id
}: TradingViewChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const chartId = container_id || `tradingview_${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: timezone,
      theme: theme,
      style: style,
      locale: locale,
      toolbar_bg: toolbar_bg,
      enable_publishing: enable_publishing,
      allow_symbol_change: allow_symbol_change,
      calendar: false,
      support_host: "https://www.tradingview.com"
    });

    if (container.current) {
      container.current.appendChild(script);
    }

    return () => {
      if (container.current) {
        container.current.innerHTML = "";
      }
    };
  }, [symbol, interval, timezone, theme, style, locale, toolbar_bg, enable_publishing, allow_symbol_change]);

  return (
    <div className="tradingview-widget-container" style={{ height, width }}>
      <div
        id={chartId}
        className="tradingview-widget-container__widget"
        ref={container}
        style={{ height: "calc(100% - 32px)", width: "100%" }}
      />
      <div className="tradingview-widget-copyright">
        <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
          <span className="blue-text">Track all markets on TradingView</span>
        </a>
      </div>
    </div>
  );
}

export default memo(TradingViewChart);