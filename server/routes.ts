import { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express) {
  // Get all watchlists
  app.get("/api/watchlists", async (req, res) => {
    try {
      const watchlists = await storage.getWatchlists();
      res.json(watchlists);
    } catch (error) {
      console.error('Error fetching watchlists:', error);
      res.status(500).json({ message: "Failed to fetch watchlists" });
    }
  });

  // Create a new watchlist
  app.post("/api/watchlists", async (req, res) => {
    try {
      const watchlist = await storage.createWatchlist(req.body);
      res.status(201).json(watchlist);
    } catch (error) {
      console.error('Error creating watchlist:', error);
      res.status(500).json({ message: "Failed to create watchlist" });
    }
  });

  // Update a watchlist
  app.patch("/api/watchlists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const watchlist = await storage.updateWatchlist(id, req.body);
      if (!watchlist) {
        return res.status(404).json({ message: "Watchlist not found" });
      }
      res.json(watchlist);
    } catch (error) {
      console.error('Error updating watchlist:', error);
      res.status(500).json({ message: "Failed to update watchlist" });
    }
  });

  // Delete a watchlist
  app.delete("/api/watchlists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteWatchlist(id);
      if (!deleted) {
        return res.status(404).json({ message: "Watchlist not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting watchlist:', error);
      res.status(500).json({ message: "Failed to delete watchlist" });
    }
  });

  // Get all trades
  app.get("/api/trades", async (req, res) => {
    try {
      const trades = await storage.getTrades();
      res.json(trades);
    } catch (error) {
      console.error('Error fetching trades:', error);
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  // Create a new trade
  app.post("/api/trades", async (req, res) => {
    try {
      const trade = await storage.createTrade(req.body);
      res.status(201).json(trade);
    } catch (error) {
      console.error('Error creating trade:', error);
      res.status(500).json({ message: "Failed to create trade" });
    }
  });

  // Update a trade
  app.patch("/api/trades/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const trade = await storage.updateTrade(id, req.body);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      res.json(trade);
    } catch (error) {
      console.error('Error updating trade:', error);
      res.status(500).json({ message: "Failed to update trade" });
    }
  });

  // Get all price alerts
  app.get("/api/price-alerts", async (req, res) => {
    try {
      const alerts = await storage.getPriceAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching price alerts:', error);
      res.status(500).json({ message: "Failed to fetch price alerts" });
    }
  });

  // Create a new price alert
  app.post("/api/price-alerts", async (req, res) => {
    try {
      const alert = await storage.createPriceAlert(req.body);
      res.status(201).json(alert);
    } catch (error) {
      console.error('Error creating price alert:', error);
      res.status(500).json({ message: "Failed to create price alert" });
    }
  });

  // Update a price alert
  app.patch("/api/price-alerts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const alert = await storage.updatePriceAlert(id, req.body);
      if (!alert) {
        return res.status(404).json({ message: "Price alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error('Error updating price alert:', error);
      res.status(500).json({ message: "Failed to update price alert" });
    }
  });

  // Get all scan results
  app.get("/api/scan-results", async (req, res) => {
    try {
      const results = await storage.getScanResults();
      res.json(results);
    } catch (error) {
      console.error('Error fetching scan results:', error);
      res.status(500).json({ message: "Failed to fetch scan results" });
    }
  });

  // Run scans with real Alpha Vantage data
  app.post("/api/run-scans", async (req, res) => {
    try {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ message: 'Alpha Vantage API key not configured' });
      }

      console.log('Running scans with Alpha Vantage API...');
      
      // Clear old scan results first
      await storage.clearOldScanResults();
      
      // Get top gainers from Alpha Vantage
      const response = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}`);
      const data = await response.json();
      
      if (data.top_gainers) {
        console.log(`Found ${data.top_gainers.length} gainers from Alpha Vantage`);
        
        for (const gainer of data.top_gainers.slice(0, 10)) {
          const ticker = gainer.ticker;
          const price = parseFloat(gainer.price);
          const change = parseFloat(gainer.change_amount);
          const changePercent = parseFloat(gainer.change_percentage.replace('%', ''));
          const volume = parseInt(gainer.volume);
          
          // Filter criteria: price > $1, change > 5%, volume > 100k
          if (price > 1 && changePercent > 5 && volume > 100000) {
            await storage.createScanResult({
              symbol: ticker,
              scanType: '1day',
              price: price.toString(),
              change: change.toString(),
              changePercent: changePercent.toString(),
              volume: volume,
              sector: 'Technology',
              adr: null,
              dollarVolume: (price * volume).toString()
            });
          }
        }
      }
      
      res.json({ message: "Scans executed successfully with Alpha Vantage data" });
    } catch (error: any) {
      console.error('Scan error:', error);
      res.status(500).json({ message: "Failed to run scans: " + error.message });
    }
  });

  // Get stock price and breakout suggestion
  app.get('/api/stock-price/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ message: 'API key not configured' });
      }

      const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol.toUpperCase()}&apikey=${apiKey}`);
      const data = await response.json();
      
      if (data['Global Quote'] && data['Global Quote']['05. price']) {
        const currentPrice = parseFloat(data['Global Quote']['05. price']);
        const dayHigh = parseFloat(data['Global Quote']['03. high']) || currentPrice;
        const dayLow = parseFloat(data['Global Quote']['04. low']) || currentPrice;
        
        const rangeBreakout = dayHigh * 1.02;
        const percentBreakout = currentPrice * 1.03;
        const suggestedBreakout = Math.max(rangeBreakout, percentBreakout);
        
        res.json({
          symbol: symbol.toUpperCase(),
          currentPrice: currentPrice.toFixed(2),
          suggestedBreakout: suggestedBreakout.toFixed(2),
          dayHigh: dayHigh.toFixed(2),
          dayLow: dayLow.toFixed(2)
        });
      } else {
        res.status(404).json({ message: 'Stock data not found' });
      }
    } catch (error) {
      console.error('Stock price error:', error);
      res.status(500).json({ message: 'Failed to fetch stock price' });
    }
  });

  // Technical analysis endpoint with Polygon.io
  app.get('/api/technical-analysis/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const polygonApiKey = "mP1MdHoHaIK3tIz0KrP0J9fez7E69oDv"; // Using your fresh API key
      
      if (!polygonApiKey) {
        return res.status(500).json({ message: 'Polygon API key not configured' });
      }

      console.log(`Running technical analysis for ${symbol} with Polygon REST API`);
      
      // Try the REST API first with your account's API key
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 3 months
      
      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&apikey=${polygonApiKey}`
      );
      
      const data = await response.json();
      
      console.log(`Polygon API response for ${symbol}:`, {
        status: data.status,
        resultsCount: data.resultsCount || 0,
        queryCount: data.queryCount || 0,
        adjusted: data.adjusted,
        nextUrl: !!data.next_url
      });
      
      if (data.status !== 'OK') {
        console.log('API Error details:', data);
        return res.status(400).json({ 
          message: `Polygon API error: ${data.status || 'Unknown error'}`
        });
      }
      
      if (!data.results || data.results.length < 10) {
        console.log('Insufficient data - results length:', data.results?.length || 0);
        return res.status(404).json({ 
          message: `Insufficient data for ${symbol}. Got ${data.results?.length || 0} data points, need at least 10.`
        });
      }

      const bars = data.results;
      const latest = bars[bars.length - 1];
      
      // Calculate moving averages
      const calculateSMA = (periods: number) => {
        if (bars.length < periods) return null;
        const prices = bars.slice(-periods).map((bar: any) => bar.c);
        return prices.reduce((sum: number, price: number) => sum + price, 0) / periods;
      };
      
      const sma10 = calculateSMA(10);
      const sma20 = calculateSMA(20);
      const sma50 = calculateSMA(50);
      const sma200 = bars.length >= 200 ? calculateSMA(200) : null;
      
      // Current metrics
      const currentPrice = latest.c;
      const currentVolume = latest.v;
      
      // Volume analysis (20-day average)
      const recentVolumes = bars.slice(-20).map((bar: any) => bar.v);
      const avgVolume = recentVolumes.reduce((sum: number, vol: number) => sum + vol, 0) / recentVolumes.length;
      
      // Price change over 30 days
      const price30Days = bars.length >= 30 ? bars[bars.length - 30].c : currentPrice;
      const priceChange30d = ((currentPrice - price30Days) / price30Days) * 100;
      
      // Build analysis criteria
      const criteria = {
        priceAbove10SMA: {
          value: sma10 ? currentPrice > sma10 : false,
          description: sma10 ? `Price $${currentPrice.toFixed(2)} > 10-SMA $${sma10.toFixed(2)}` : 'Need 10+ days data',
          weight: 1
        },
        priceAbove20SMA: {
          value: sma20 ? currentPrice > sma20 : false,
          description: sma20 ? `Price $${currentPrice.toFixed(2)} > 20-SMA $${sma20.toFixed(2)}` : 'Need 20+ days data',
          weight: 2
        },
        smaAlignment: {
          value: sma10 && sma20 && sma50 ? (sma10 > sma20 && sma20 > sma50) : false,
          description: 'Short-term moving averages in bullish alignment',
          weight: 2
        },
        aboveLongTrend: {
          value: sma200 ? currentPrice > sma200 : true,
          description: sma200 ? `Price above 200-SMA ($${sma200.toFixed(2)})` : 'Long-term trend positive',
          weight: 1
        },
        volumeStrength: {
          value: currentVolume > avgVolume * 1.2,
          description: `Volume ${(currentVolume/1000).toFixed(0)}K vs avg ${(avgVolume/1000).toFixed(0)}K`,
          weight: 1
        },
        recentStrength: {
          value: priceChange30d > 5,
          description: `30-day performance: ${priceChange30d.toFixed(1)}%`,
          weight: 1
        }
      };

      // Calculate score
      let score = 0;
      let maxScore = 0;
      
      Object.values(criteria).forEach(criterion => {
        maxScore += criterion.weight;
        if (criterion.value) score += criterion.weight;
      });

      const scorePercentage = Math.round((score / maxScore) * 100);

      const analysis = {
        symbol: symbol.toUpperCase(),
        currentPrice: currentPrice.toFixed(2),
        technicalScore: score,
        maxScore,
        scorePercentage,
        criteria,
        marketData: {
          sma10: sma10?.toFixed(2) || 'N/A',
          sma20: sma20?.toFixed(2) || 'N/A',
          sma50: sma50?.toFixed(2) || 'N/A',
          sma200: sma200?.toFixed(2) || 'N/A',
          volume: currentVolume,
          avgVolume: Math.round(avgVolume),
          priceChange30d: priceChange30d.toFixed(1)
        }
      };

      console.log(`Analysis complete: ${symbol} scored ${scorePercentage}%`);
      res.json(analysis);
      
    } catch (error) {
      console.error('Technical analysis error:', error);
      res.status(500).json({ message: 'Failed to analyze stock data' });
    }
  });

  // Market data endpoint (simulated)
  app.get("/api/market-data", async (req, res) => {
    try {
      const marketData = {
        spy: { price: "428.45", change: "+0.85%" },
        nasdaq: { price: "15,234", change: "+1.24%" },
        vix: { price: "18.45", change: "-2.15%" },
        trend: "bullish"
      };
      res.json(marketData);
    } catch (error) {
      console.error('Market data error:', error);
      res.status(500).json({ message: 'Failed to fetch market data' });
    }
  });

  const server = createServer(app);
  return server;
}