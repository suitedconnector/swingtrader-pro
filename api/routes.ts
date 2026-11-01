import { Express } from "express";
import passport from "passport";
import { hashPassword } from "./auth";
import { createServer } from "http";
import { exec, spawn } from "child_process";
import { storage } from "./storage";
import { updateUserProfileSchema, registerUserSchema } from "@shared/schema";
import { sendTestAlert } from "./emailService";
import { getZohoAuthUrl, sendZohoTest } from "./zohoService";
import { getStockPrice } from "./massiveService";
import { authenticateWithCloudflare } from "./authMiddleware";

export async function registerRoutes(app: Express) {
  // User registration: always hash passwords before storing them.
  app.post("/api/register", async (req, res) => {
    try {
      const userData = registerUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);

      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const passwordHash = await hashPassword(userData.password);
      const newUser = await storage.createUser({
        username: userData.username,
        password: passwordHash,
        email: userData.email,
        emailAlerts: userData.emailAlerts,
        tradingBankroll: userData.tradingBankroll,
      });

      const { password, ...userProfile } = newUser;
      return res.status(201).json({
        message: "Account created successfully",
        user: userProfile,
      });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Invalid registration information" });
      }
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Unable to create account" });
    }
  });

  // Login using the bcrypt-only Passport strategy.
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (error: any, user: any, info: any) => {
      if (error) return next(error);

      if (!user) {
        const message = info?.message === "Password reset required"
          ? "Password reset required for this account"
          : "Invalid username or password";
        return res.status(401).json({ message });
      }

      req.logIn(user, (loginError) => {
        if (loginError) return next(loginError);

        const { password, ...userProfile } = user;
        return res.json({ message: "Logged in successfully", user: userProfile });
      });
    })(req, res, next);
  });

  // Return the currently authenticated user's profile.
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { password, ...userProfile } = req.user as any;
    return res.json(userProfile);
  });

  // Destroy the login session.
  app.post("/api/logout", (req, res, next) => {
    req.logout((logoutError) => {
      if (logoutError) return next(logoutError);

      req.session.destroy((sessionError) => {
        if (sessionError) return next(sessionError);

        res.clearCookie("connect.sid");
        return res.json({ message: "Logged out successfully" });
      });
    });
  });

  // Get/Update profile omitted for brevity in audit, but kept in functional code
  // Get all watchlists
  app.get("/api/watchlists", (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    storage.getWatchlists(req.user.id).then(data => res.json(data)).catch(next);
  });

  // Create a new watchlist
  app.post("/api/watchlists", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const watchlist = await storage.createWatchlist({ ...req.body, userId: req.user.id });
      res.status(201).json(watchlist);
    } catch (error) {
      console.error('Error creating watchlist:', error);
      res.status(500).json({ message: "Failed to create watchlist" });
    }
  });

  // Update a watchlist
  app.patch("/api/watchlists/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const id = parseInt(req.params.id);
      const watchlist = await storage.updateWatchlist(id, req.user.id, req.body);
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
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteWatchlist(id, req.user.id);
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
  app.get("/api/trades", (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    storage.getTrades(req.user.id).then(data => res.json(data)).catch(next);
  });

  // Create a new trade
  app.post("/api/trades", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const trade = await storage.createTrade({ ...req.body, userId: req.user.id });
      res.status(201).json(trade);
    } catch (error) {
      console.error('Error creating trade:', error);
      res.status(500).json({ message: "Failed to create trade" });
    }
  });

  // Update a trade
  app.patch("/api/trades/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const id = parseInt(req.params.id);
      const trade = await storage.updateTrade(id, req.user.id, req.body);
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
  app.get("/api/price-alerts", (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    storage.getPriceAlerts(req.user.id).then(data => res.json(data)).catch(next);
  });

  // Create a new price alert
  app.post("/api/price-alerts", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const alert = await storage.createPriceAlert({ ...req.body, userId: req.user.id });
      res.status(201).json(alert);
    } catch (error) {
      console.error('Error creating price alert:', error);
      res.status(500).json({ message: "Failed to create price alert" });
    }
  });

  // Update a price alert
  app.patch("/api/price-alerts/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const id = parseInt(req.params.id);
      const alert = await storage.updatePriceAlert(id, req.user.id, req.body);
      if (!alert) {
        return res.status(404).json({ message: "Price alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error('Error updating price alert:', error);
      res.status(500).json({ message: "Failed to update price alert" });
    }
  });

  // Get stock price and suggested breakout target
  app.get("/api/stock-price/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();

      if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) {
        return res.status(400).json({ message: "Invalid stock symbol" });
      }

      const apiKey = process.env.MASSIVE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "API key not configured" });
      }

      const { currentPrice, dayHigh, dayLow } = await getStockPrice(symbol, apiKey);
      if (!currentPrice) {
        return res.status(404).json({ message: "Stock price data not found" });
      }

      const suggestedBreakout = Math.max(dayHigh * 1.02, currentPrice * 1.03);

      return res.json({
        symbol,
        currentPrice: currentPrice.toFixed(2),
        suggestedBreakout: suggestedBreakout.toFixed(2),
        dayHigh: dayHigh.toFixed(2),
        dayLow: dayLow.toFixed(2)
      });
    } catch (error) {
      console.error("Stock price error:", error);
      return res.status(502).json({ message: "Failed to fetch stock price data" });
    }
  });

  // Scans
  app.post("/api/run-scans", authenticateWithCloudflare, async (req, res) => {
    try {
      await storage.clearOldScanResults();
      const { stdout } = await new Promise<{stdout: string, stderr: string}>((resolve, reject) => {
        exec('python3 server/simple_scan.py', { timeout: 60000 }, (error, stdout, stderr) => {
          if (error && !stdout) reject(error);
          else resolve({ stdout, stderr });
        });
      });

      let qualifyingStocks = [];
      try { qualifyingStocks = JSON.parse(stdout.trim()); } catch (e) { qualifyingStocks = []; }

      for (const stock of qualifyingStocks) {
        await storage.createScanResult({
          symbol: stock.symbol,
          scanType: '1day',
          price: stock.price.toFixed(2),
          change: (stock.price * stock.change_percent / 100).toFixed(2),
          changePercent: stock.change_percent.toFixed(1),
          volume: stock.volume,
          sector: stock.sector,
          adr: stock.change_percent > 7 ? stock.change_percent.toFixed(1) : null,
          dollarVolume: (stock.price * stock.volume).toString()
        });
      }
      res.json({ count: qualifyingStocks.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
