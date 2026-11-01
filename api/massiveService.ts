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
