import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStockSchema, insertWatchlistSchema, insertTradeSchema, insertPriceAlertSchema, insertScanResultSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Stock routes
  app.get("/api/stocks", async (req, res) => {
    try {
      const stocks = await storage.getStocks();
      res.json(stocks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stocks" });
    }
  });

  app.get("/api/stocks/:symbol", async (req, res) => {
    try {
      const stock = await storage.getStock(req.params.symbol);
      if (!stock) {
        return res.status(404).json({ message: "Stock not found" });
      }
      res.json(stock);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stock" });
    }
  });

  app.post("/api/stocks", async (req, res) => {
    try {
      const stockData = insertStockSchema.parse(req.body);
      const stock = await storage.createStock(stockData);
      res.status(201).json(stock);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid stock data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create stock" });
    }
  });

  // Watchlist routes
  app.get("/api/watchlists", async (req, res) => {
    try {
      const watchlists = await storage.getWatchlists();
      res.json(watchlists);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch watchlists" });
    }
  });

  app.post("/api/watchlists", async (req, res) => {
    try {
      const watchlistData = insertWatchlistSchema.parse(req.body);
      const watchlist = await storage.createWatchlist(watchlistData);
      res.status(201).json(watchlist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid watchlist data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create watchlist" });
    }
  });

  app.patch("/api/watchlists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const watchlist = await storage.updateWatchlist(id, updates);
      if (!watchlist) {
        return res.status(404).json({ message: "Watchlist not found" });
      }
      res.json(watchlist);
    } catch (error) {
      res.status(500).json({ message: "Failed to update watchlist" });
    }
  });

  // Trade routes
  app.get("/api/trades", async (req, res) => {
    try {
      const active = req.query.active === 'true';
      const trades = active ? await storage.getActiveTrades() : await storage.getTrades();
      res.json(trades);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  app.post("/api/trades", async (req, res) => {
    try {
      const tradeData = insertTradeSchema.parse(req.body);
      const trade = await storage.createTrade(tradeData);
      res.status(201).json(trade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid trade data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create trade" });
    }
  });

  app.patch("/api/trades/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const trade = await storage.updateTrade(id, updates);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      res.json(trade);
    } catch (error) {
      res.status(500).json({ message: "Failed to update trade" });
    }
  });

  // Price Alert routes
  app.get("/api/price-alerts", async (req, res) => {
    try {
      const active = req.query.active === 'true';
      const alerts = active ? await storage.getActivePriceAlerts() : await storage.getPriceAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch price alerts" });
    }
  });

  app.post("/api/price-alerts", async (req, res) => {
    try {
      const alertData = insertPriceAlertSchema.parse(req.body);
      const alert = await storage.createPriceAlert(alertData);
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid price alert data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create price alert" });
    }
  });

  // Scan Result routes
  app.get("/api/scan-results", async (req, res) => {
    try {
      const scanType = req.query.type as string;
      const results = scanType 
        ? await storage.getScanResultsByType(scanType)
        : await storage.getScanResults();
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scan results" });
    }
  });

  app.post("/api/scan-results", async (req, res) => {
    try {
      const resultData = insertScanResultSchema.parse(req.body);
      const result = await storage.createScanResult(resultData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid scan result data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create scan result" });
    }
  });

  // Run stock scans endpoint
  app.post("/api/run-scans", async (req, res) => {
    try {
      // Clear old scan results first
      await storage.clearOldScanResults();
      
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Alpha Vantage API key not configured" });
      }

      // Fetch top gainers from Alpha Vantage API
      const response = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}`);
      
      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.top_gainers) {
        // Process and filter results based on your trading criteria
        for (const stock of data.top_gainers.slice(0, 20)) { // Limit to 20 stocks
          const ticker = stock.ticker;
          const price = parseFloat(stock.price) || 0;
          const change = parseFloat(stock.change_amount) || 0;
          const changePercent = parseFloat(stock.change_percentage.replace('%', '')) || 0;
          const volume = parseInt(stock.volume) || 0;
          
          // Apply your filters: Price > $1, Volume > 1M shares (rough proxy for $30M dollar volume)
          if (price > 1 && volume > 1000000 && changePercent > 2) {
            await storage.createScanResult({
              symbol: ticker,
              scanType: '1day', // Using 1day as proxy for strong movers
              price: price.toString(),
              change: change.toString(),
              changePercent: changePercent.toString(),
              volume: volume,
              sector: 'Technology', // Alpha Vantage doesn't provide sector in this endpoint
              adr: null,
              dollarVolume: (price * volume).toString()
            });
          }
        }
      }
      
      res.json({ message: "Scans executed successfully with Alpha Vantage data" });
    } catch (error) {
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
        
        // Suggest breakout level: 3% above current price, but consider day's range
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
        res.status(404).json({ message: 'Stock not found' });
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
      const polygonApiKey = process.env.POLYGON_API_KEY;
      
      if (!polygonApiKey) {
        return res.status(500).json({ message: 'API key not configured' });
      }

      console.log(`Running technical analysis for ${symbol}`);
      
      // Get 6 months of daily data
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&limit=200&apikey=${polygonApiKey}`
      );
      
      const data = await response.json();
      
      if (data.status !== 'OK' || !data.results || data.results.length < 50) {
        return res.status(404).json({ 
          message: 'Unable to fetch sufficient data for analysis'
        });
      }

      const bars = data.results;
      const latest = bars[bars.length - 1];
      
      // Calculate moving averages
      const calculateSMA = (periods) => {
        if (bars.length < periods) return null;
        const prices = bars.slice(-periods).map(bar => bar.c);
        return prices.reduce((sum, price) => sum + price, 0) / periods;
      };
      
      const sma10 = calculateSMA(10);
      const sma20 = calculateSMA(20);
      const sma50 = calculateSMA(50);
      const sma200 = bars.length >= 200 ? calculateSMA(200) : null;
      
      // Current metrics
      const currentPrice = latest.c;
      const currentVolume = latest.v;
      
      // Volume analysis (20-day average)
      const recentVolumes = bars.slice(-20).map(bar => bar.v);
      const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
      
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
      // In a real implementation, this would fetch from Alpha Vantage or similar
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
      
      // Calculate SMAs
      const sma10 = prices.slice(0, 10).reduce((sum, p) => sum + p.close, 0) / 10;
      const sma20 = prices.slice(0, 20).reduce((sum, p) => sum + p.close, 0) / 20;
      const sma50 = prices.slice(0, 50).reduce((sum, p) => sum + p.close, 0) / 50;
      const sma200 = prices.slice(0, 200).reduce((sum, p) => sum + p.close, 0) / 200;

      // Calculate recent performance
      const priceChange30Days = ((currentPrice - prices[29].close) / prices[29].close) * 100;
      const avgVolume20Days = prices.slice(0, 20).reduce((sum, p) => sum + p.volume, 0) / 20;
      const currentVolume = prices[0].volume;

      // Analyze recent lows for higher lows pattern
      const recentLows = prices.slice(0, 20).map(p => p.low);
      const isHigherLows = recentLows[0] > Math.min(...recentLows.slice(5, 15));

      // Technical criteria evaluation
      const analysis = {
        symbol: symbol.toUpperCase(),
        currentPrice: currentPrice.toFixed(2),
        technicalScore: 0,
        maxScore: 10,
        criteria: {
          initialMove: {
            value: priceChange30Days >= 30,
            description: `30-day move: ${priceChange30Days.toFixed(1)}%`,
            weight: 2
          },
          pullbackConsolidation: {
            value: currentPrice < prices[5].close && currentPrice > sma20,
            description: "Orderly pullback from recent highs",
            weight: 1
          },
          higherLows: {
            value: isHigherLows,
            description: "Higher lows pattern detected",
            weight: 1
          },
          holdingSMA: {
            value: currentPrice > sma10 && currentPrice > sma20,
            description: "Holding above 10/20 SMA during pullback",
            weight: 1
          },
          volumeDrying: {
            value: currentVolume < avgVolume20Days * 0.8,
            description: `Volume: ${(currentVolume/1000000).toFixed(1)}M vs avg ${(avgVolume20Days/1000000).toFixed(1)}M`,
            weight: 1
          },
          sma10Above20: {
            value: sma10 > sma20,
            description: `10 SMA (${sma10.toFixed(2)}) > 20 SMA (${sma20.toFixed(2)})`,
            weight: 1
          },
          sma20Above50: {
            value: sma20 > sma50,
            description: `20 SMA (${sma20.toFixed(2)}) > 50 SMA (${sma50.toFixed(2)})`,
            weight: 1
          },
          sma50Above200: {
            value: sma50 > sma200,
            description: `50 SMA (${sma50.toFixed(2)}) > 200 SMA (${sma200.toFixed(2)})`,
            weight: 1
          },
          priceAbove200: {
            value: currentPrice > sma200,
            description: `Price (${currentPrice.toFixed(2)}) > 200 SMA (${sma200.toFixed(2)})`,
            weight: 1
          }
        },
        marketData: {
          sma10: sma10.toFixed(2),
          sma20: sma20.toFixed(2),
          sma50: sma50.toFixed(2),
          sma200: sma200.toFixed(2),
          volume: currentVolume,
          avgVolume: Math.round(avgVolume20Days),
          priceChange30d: priceChange30Days.toFixed(1)
        }
      };

      // Calculate total score
      let totalScore = 0;
      let maxPossibleScore = 0;
      
      Object.values(analysis.criteria).forEach(criterion => {
        maxPossibleScore += criterion.weight;
        if (criterion.value) {
          totalScore += criterion.weight;
        }
      });

      analysis.technicalScore = totalScore;
      analysis.maxScore = maxPossibleScore;
      
      const scorePercentage = Math.round((totalScore / maxPossibleScore) * 100);
      const finalAnalysis = { ...analysis, scorePercentage };

      res.json(finalAnalysis);
    } catch (error) {
      console.error('Technical analysis error:', error);
      res.status(500).json({ message: 'Failed to perform technical analysis' });
    }
  });

  // Market data endpoint (simulated)
  app.get("/api/market-data", async (req, res) => {
    try {
      // In a real implementation, this would fetch from Alpha Vantage or similar
      const marketData = {
        spy: { price: "428.45", change: "+0.85%" },
        nasdaq: { price: "15,234", change: "+1.24%" },
        vix: { price: "18.45", change: "-2.15%" },
        trend: "bullish"
      };
      res.json(marketData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
