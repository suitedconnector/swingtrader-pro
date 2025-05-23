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
      
      const apiKey = process.env.POLYGON_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Polygon API key not configured" });
      }

      // Fetch top gainers from Polygon API
      const response = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apikey=${apiKey}`);
      
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.results) {
        // Process and filter results based on your trading criteria
        for (const stock of data.results.slice(0, 20)) { // Limit to 20 stocks
          const ticker = stock.ticker;
          const price = stock.value || 0;
          const change = stock.change || 0;
          const changePercent = stock.changePercent || 0;
          const volume = stock.session?.volume || 0;
          
          // Apply your filters: Price > $1, Volume > 1M shares (rough proxy for $30M dollar volume)
          if (price > 1 && volume > 1000000 && Math.abs(changePercent) > 2) {
            await storage.createScanResult({
              symbol: ticker,
              scanType: '1day', // Using 1day as proxy for strong movers
              price: price.toString(),
              change: change.toString(),
              changePercent: changePercent.toString(),
              volume: volume,
              sector: 'Technology', // Polygon doesn't provide sector in this endpoint
              adr: null,
              dollarVolume: (price * volume).toString()
            });
          }
        }
      }
      
      res.json({ message: "Scans executed successfully with real market data" });
    } catch (error) {
      console.error('Scan error:', error);
      res.status(500).json({ message: "Failed to run scans: " + error.message });
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
