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

  // Technical analysis endpoint using yfinance
  app.get('/api/technical-analysis/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      
      console.log(`Running technical analysis for ${symbol} with Alpha Vantage`);
        const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (!alphaVantageKey) {
          return res.status(500).json({ message: 'API key not configured' });
        }

        // Get current price and basic data
        const quoteResponse = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${alphaVantageKey}`
        );
        const quoteData = await quoteResponse.json();
        const quote = quoteData['Global Quote'];
        
        if (!quote || !quote['05. price']) {
          return res.status(404).json({ message: 'Unable to fetch stock data' });
        }

        const currentPrice = parseFloat(quote['05. price']);
        const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
        
        // Simple scoring system based on available data
        let score = 0;
        let maxScore = 8;
        const criteria: any = {};

        // Price momentum (positive change)
        criteria.positive_change = {
          value: changePercent > 0,
          description: `Daily change: ${changePercent.toFixed(2)}%`,
          weight: 2
        };
        if (changePercent > 0) score += 2;

        // Strong positive momentum
        criteria.strong_momentum = {
          value: changePercent > 2,
          description: `Strong momentum (>2%)`,
          weight: 2
        };
        if (changePercent > 2) score += 2;

        // Price above $5 (good liquidity)
        criteria.price_level = {
          value: currentPrice > 5,
          description: `Price above $5 ($${currentPrice.toFixed(2)})`,
          weight: 1
        };
        if (currentPrice > 5) score += 1;

        // High volume indicator (using change % as proxy)
        const volumeStrong = Math.abs(changePercent) > 1;
        criteria.volume_indication = {
          value: volumeStrong,
          description: `Volume activity indicated by price movement`,
          weight: 1
        };
        if (volumeStrong) score += 1;

        // Recent strength (positive change > 1%)
        criteria.recent_strength = {
          value: changePercent > 1,
          description: `Recent strength (>1% daily gain)`,
          weight: 1
        };
        if (changePercent > 1) score += 1;

        // Market cap consideration (price > $10)
        criteria.market_presence = {
          value: currentPrice > 10,
          description: `Established market presence (>$10)`,
          weight: 1
        };
        if (currentPrice > 10) score += 1;

        const scorePercentage = Math.round((score / maxScore) * 100);

        const result = {
          symbol: symbol.toUpperCase(),
          currentPrice: parseFloat(currentPrice.toFixed(2)),
          technicalScore: score,
          maxScore: maxScore,
          scorePercentage: scorePercentage,
          criteria: criteria,
          marketData: {
            dailyChange: changePercent,
            previousClose: parseFloat(quote['08. previous close']),
            volume: quote['06. volume'],
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low'])
          }
        };

        console.log(`Technical analysis completed for ${symbol}: ${scorePercentage}% score`);
        res.json(result);
        
    } catch (error) {
      console.error('Technical analysis error:', error);
      res.status(500).json({ message: 'Failed to perform technical analysis' });
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