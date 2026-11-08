import { Express, Request, Response } from "express";
import passport from "passport";
import crypto from "crypto";
import { hashPassword } from "./auth";
import { createServer } from "http";
import { exec } from "child_process";
import { storage } from "./storage";
import { updateUserProfileSchema, registerUserSchema } from "@shared/schema";
import { sendTestAlert, sendVerificationCode, sendEmailChangeVerificationCode } from "./emailService";
import { getHistoricalAggregates } from "./massiveService";
import { runScansV2 } from "./scanner_pipeline";

// Simple in-memory rate limiter with expiration
const rateLimits = new Map<string, { count: number; expiresAt: number }>();

function checkRateLimit(key: string, limit: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (entry && now > entry.expiresAt) {
    rateLimits.delete(key);
  }

  const current = rateLimits.get(key) || { count: 0, expiresAt: now + windowMs };
  if (current.count >= limit) return false;
  
  current.count++;
  rateLimits.set(key, current);
  return true;
}

export async function registerRoutes(app: Express) {

  // Test email alert
  app.post("/api/test-email-alert", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const email = typeof user.email === "string" ? user.email.trim() : "";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "A valid account email address is required" });
      }

      const success = await sendTestAlert(email);

      if (success) {
        return res.json({ message: "Test alert sent successfully" });
      }

      return res.status(500).json({ message: "Failed to send test alert" });
    } catch (error: any) {
      console.error("Test email alert error:", error);
      return res.status(500).json({ message: "Failed to send test alert" });
    }
  });


  // User registration
  app.post("/api/register", async (req, res) => {
    try {
      const userData = registerUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) return res.status(409).json({ message: "Username already exists" });
      const passwordHash = await hashPassword(userData.password);
      const newUser = await storage.createUser({
        username: userData.username,
        password: passwordHash,
        email: userData.email,
        emailAlerts: userData.emailAlerts,
        tradingBankroll: userData.tradingBankroll,
      });
      const { password, ...userProfile } = newUser;
      return res.status(201).json({ message: "Account created successfully", user: userProfile });
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid registration information" });
      res.status(500).json({ message: "Unable to create account" });
    }
  });

  // Login
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (error: any, user: any, info: any) => {
      if (error) return next(error);
      if (!user) return res.status(401).json({ message: "Invalid username or password" });
      req.logIn(user, (loginError) => {
        if (loginError) return next(loginError);
        const { password, ...userProfile } = user;
        return res.json({ message: "Logged in successfully", user: userProfile });
      });
    })(req, res, next);
  });

  app.post("/api/request-login-code", async (req, res) => {
    if (!process.env.AUTH_CODE_SECRET) return res.status(500).json({ message: "Auth configuration error" });
    const ip = req.ip || "unknown";
    const { email } = req.body;
    if (!checkRateLimit(`req_ip:${ip}`, 3) || !checkRateLimit(`req_email:${email}`, 3)) return res.status(429).json({ message: "Too many requests" });
    
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(200).json({ message: "If an account exists, a code has been sent." });
    
    await storage.deleteAuthCode(email); // Invalidate old codes
    const rawCode = crypto.randomInt(100000, 999999).toString();
    const digest = crypto.createHmac('sha256', process.env.AUTH_CODE_SECRET).update(rawCode).digest('hex');
    
    await storage.saveAuthCode(user.email!, digest);
    await sendVerificationCode(user.email!, rawCode);
    res.status(200).json({ message: "If an account exists, a code has been sent." });
  });

  app.post("/api/verify-login-code", async (req, res, next) => {
    if (!process.env.AUTH_CODE_SECRET) return res.status(500).json({ message: "Auth configuration error" });
    const ip = req.ip || "unknown";
    const { email, code } = req.body;
    if (!checkRateLimit(`ver_ip:${ip}`, 5) || !checkRateLimit(`ver_email:${email}`, 5)) return res.status(429).json({ message: "Too many attempts" });
    
    const digest = crypto.createHmac('sha256', process.env.AUTH_CODE_SECRET).update(code).digest('hex');
    const isValid = await storage.verifyAuthCode(email, digest);
    if (!isValid) return res.status(401).json({ message: "Invalid or expired code" });
    
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });
    
    await storage.deleteAuthCode(email);
    req.logIn(user, (err) => {
      if (err) return next(err);
      const { password, ...userProfile } = user;
      res.json({ message: "Logged in successfully", user: userProfile });
    });
  });

  // ... (Other routes remain the same)
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    const { password, ...userProfile } = req.user as any;
    return res.json(userProfile);
  });


  // Authenticated profile retrieval
  app.get("/api/profile", async (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { password, ...profile } = user;
      return res.json(profile);
    } catch (err) {
      next(err);
    }
  });

  // Update permitted profile fields only
  app.patch("/api/profile", async (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const parsed = updateUserProfileSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid profile information" });
      }

      const updates = parsed.data;

      if (updates.username !== undefined) {
        const existing = await storage.getUserByUsername(updates.username);
        if (existing && existing.id !== req.user.id) {
          return res.status(409).json({ message: "Username already exists" });
        }
      }

      if (
        updates.tradingBankroll !== undefined &&
        !/^\d{1,10}(\.\d{1,2})?$/.test(updates.tradingBankroll)
      ) {
        return res.status(400).json({ message: "Invalid account balance" });
      }

      const updated = await storage.updateUserProfile(req.user.id, updates);
      if (!updated) return res.status(404).json({ message: "User not found" });

      const { password, ...profile } = updated;
      return res.json(profile);
    } catch (err) {
      next(err);
    }
  });

  // Request a verification code for a proposed new email address
  app.post("/api/profile/email/request", async (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = req.user.id;
    const ip = req.ip || "unknown";

    if (
      !checkRateLimit(`email_change_request_ip:${ip}`, 3, 10 * 60 * 1000) ||
      !checkRateLimit(`email_change_request_user:${userId}`, 3, 10 * 60 * 1000)
    ) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    try {
      const secret = process.env.AUTH_CODE_SECRET;
      if (!secret) {
        return res.status(500).json({ message: "Email verification is not configured" });
      }

      const email = typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Please provide a valid email address" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.email?.toLowerCase() === email) {
        return res.status(400).json({ message: "This is already your current email address" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "That email address is already in use" });
      }

      const code = crypto.randomInt(100000, 1000000).toString();
      const digest = crypto.createHmac("sha256", secret).update(code).digest("hex");

      await storage.savePendingEmailChange(userId, email, digest);

      const sent = await sendEmailChangeVerificationCode(email, code);
      if (!sent) {
        await storage.deletePendingEmailChange(userId);
        return res.status(502).json({ message: "Could not send verification email" });
      }

      return res.json({ message: "Verification code sent" });
    } catch (err) {
      next(err);
    }
  });

  // Verify the code and complete the email change
  app.post("/api/profile/email/verify", async (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = req.user.id;
    const ip = req.ip || "unknown";

    if (
      !checkRateLimit(`email_change_verify_ip:${ip}`, 5) ||
      !checkRateLimit(`email_change_verify_user:${userId}`, 5)
    ) {
      return res.status(429).json({ message: "Too many verification attempts" });
    }

    try {
      const secret = process.env.AUTH_CODE_SECRET;
      if (!secret) {
        return res.status(500).json({ message: "Email verification is not configured" });
      }

      const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: "Enter the six-digit verification code" });
      }

      const digest = crypto.createHmac("sha256", secret).update(code).digest("hex");
      const updatedEmail = await storage.completePendingEmailChange(userId, digest);

      if (!updatedEmail) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }

      return res.json({ message: "Email address updated", email: updatedEmail });
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ message: "That email address is already in use" });
      }
      next(err);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
        if(err) return next(err);
        req.session.destroy(() => {
            res.clearCookie("connect.sid");
            res.json({ message: "Logged out" });
        });
    });
  });

  app.get("/api/watchlists", (req, res, next) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); storage.getWatchlists(req.user.id).then(d => res.json(d)).catch(next); });
  app.post("/api/watchlists", async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const w = await storage.createWatchlist({ ...req.body, userId: req.user.id }); res.status(201).json(w); });
  app.patch("/api/watchlists/:id", async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const w = await storage.updateWatchlist(parseInt(req.params.id), req.user.id, req.body); if (!w) return res.status(404).json({ message: "Not found" }); res.json(w); });
  app.delete("/api/watchlists/:id", async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const deleted = await storage.deleteWatchlist(parseInt(req.params.id), req.user.id); if (!deleted) return res.status(404).json({ message: "Not found" }); res.status(204).send(); });
  app.get("/api/trades", (req, res, next) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); storage.getTrades(req.user.id).then(d => res.json(d)).catch(next); });
  app.post("/api/trades", async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const t = await storage.createTrade({ ...req.body, userId: req.user.id }); res.status(201).json(t); });
  app.patch("/api/trades/:id", async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const t = await storage.updateTrade(parseInt(req.params.id), req.user.id, req.body); if (!t) return res.status(404).json({ message: "Not found" }); res.json(t); });
  app.get("/api/price-alerts", (req, res, next) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); storage.getPriceAlerts(req.user.id).then(d => res.json(d)).catch(next); });
  app.post("/api/price-alerts", async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const a = await storage.createPriceAlert({ ...req.body, userId: req.user.id }); res.status(201).json(a); });
  app.patch("/api/price-alerts/:id", async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const a = await storage.updatePriceAlert(parseInt(req.params.id), req.user.id, req.body); if (!a) return res.status(404).json({ message: "Not found" }); res.json(a); });
  app.delete("/api/price-alerts/:id", async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const d = await storage.deletePriceAlert(Number(req.params.id), req.user.id); if (!d) return res.status(404).json({ message: "Not found" }); res.status(204).send(); });
  app.get("/api/stock-price/:symbol", async (req, res) => { const s = req.params.symbol.toUpperCase(); if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(s)) return res.status(400).json({ message: "Invalid symbol" }); const apiKey = process.env.MASSIVE_API_KEY; if (!apiKey) return res.status(500).json({ message: "API key not configured" }); const yesterday = new Date(Date.now() - 172800000).toISOString().split('T')[0]; const today = new Date().toISOString().split('T')[0]; const stockData = await getHistoricalAggregates(s, apiKey, yesterday, today); if (!stockData || stockData.length === 0) return res.status(404).json({ message: "Not found" }); const latest = stockData[stockData.length - 1]; const suggested = Math.max(latest.high * 1.02, latest.close * 1.03); res.json({ symbol: s, currentPrice: latest.close.toFixed(2), suggestedBreakout: suggested.toFixed(2) }); });
  app.get("/api/market-data", async (req, res) => { const apiKey = process.env.MASSIVE_API_KEY; if (!apiKey) return res.status(500).json({ message: "API key not configured" }); const spy = await getHistoricalAggregates("SPY", apiKey, new Date(Date.now() - 172800000).toISOString().split('T')[0], new Date().toISOString().split('T')[0]).catch(() => null); const nasdaq = await getHistoricalAggregates("QQQ", apiKey, new Date(Date.now() - 172800000).toISOString().split('T')[0], new Date().toISOString().split('T')[0]).catch(() => null); if (!spy || !nasdaq) return res.status(503).json({ message: "Data unavailable" }); res.json({ spy: { price: spy[spy.length-1].close.toFixed(2) }, nasdaq: { price: nasdaq[nasdaq.length-1].close.toFixed(2) } }); });
  app.post("/api/run-scans", (req, res, next) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); next(); }, async (req, res) => { await storage.clearOldScanResults(); exec('.venv/bin/python api/simple_scan.py', (err, stdout) => { try { const data = JSON.parse(stdout); data.forEach(async (s: any) => await storage.createScanResult({ symbol: s.symbol, scanType: '1day', price: s.price.toFixed(2), change: "0", changePercent: s.change_percent.toFixed(2), volume: s.volume, sector: s.sector, dollarVolume: (s.price * s.volume).toString() })); res.json({ count: data.length }); } catch { res.status(500).json({ message: "Scan failed" }); } }); });
  app.post("/api/run-scans-v2", (req, res, next) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); next(); }, runScansV2);
  app.get("/api/scan-results", async (req, res) => { const r = await storage.getScanResults(); res.json(r); });
  app.delete("/api/scan-results", async (req, res) => { await storage.clearOldScanResults(); res.json({ message: "Cleared" }); });

  const httpServer = createServer(app);
  return httpServer;
}
