export async function getStockPrice(symbol: string, apiKey: string) {
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol.toUpperCase()}?apiKey=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch data from Massive (Polygon)");
  }

  const data = await response.json();
  if (data.status !== 'OK' || !data.ticker) {
    throw new Error("Invalid response from Massive (Polygon)");
  }

  const ticker = data.ticker;
  const day = ticker.day || {};

  return {
    currentPrice: ticker.min?.c || ticker.day?.c || 0,
    dayHigh: day.h || 0,
    dayLow: day.l || 0,
  };
}

export async function getHistoricalAggregates(symbol: string, apiKey: string, start: string, end: string) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/1/day/${start}/${end}?adjusted=true&sort=asc&apiKey=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch historical data for ${symbol}: ${response.statusText}`);
  }
  const data = await response.json();
  if ((data.status !== "OK" && data.status !== "DELAYED") || !data.results) {
    throw new Error(`Invalid historical response for ${symbol}`);
  }
  // Normalize to scan results expectations
  return data.results.map((r: any) => ({
    date: new Date(r.t).toISOString(),
    close: r.c,
    high: r.h,
    low: r.l,
    open: r.o,
    volume: r.v,
  }));
}

export async function getMarketQuote(symbol: string, apiKey: string) {
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol.toUpperCase()}?apiKey=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol} market data`);
  }

  const data = await response.json();

  if ((data.status !== "OK" && data.status !== "DELAYED") || !data.ticker) {
    throw new Error(`Invalid market data for ${symbol}`);
  }

  const ticker = data.ticker;
  const price =
    ticker.min?.c ||
    ticker.lastTrade?.p ||
    ticker.day?.c ||
    ticker.prevDay?.c ||
    0;

  const change = Number(ticker.todaysChangePerc || 0);

  if (!price) {
    throw new Error(`No price available for ${symbol}`);
  }

  return {
    price: Number(price).toFixed(2),
    change: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
    changePercent: change,
  };
}
