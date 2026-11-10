import { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import crypto from "crypto";
import { hashPassword } from "./auth";
import { createServer } from "http";
import { exec } from "child_process";
import { storage } from "./storage";
import { updateUserProfileSchema, registerUserSchema } from "@shared/schema";
import { sendTestAlert, sendVerificationCode, sendEmailChangeVerificationCode } from "./emailService";
import { getDailyBars } from "./priceCache";
import { runScansV2 } from "./scanner_pipeline";
import { z } from "zod";

// Fields a client may change on its own trade. Anything else (userId, id,
// symbol, entry price, entry date) is rejected. Decimal columns are stored as
// strings; exitDate arrives as an ISO string and must become a Date for the
// timestamp column.
const decimalField = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => v !== "" && Number.isFinite(Number(v)), { message: "Must be a number" })
  .transform((v) => Number(v).toFixed(2));
const positiveDecimal = decimalField.refine((v) => Number(v) > 0, { message: "Must be greater than 0" });
const tradePatchSchema = z
  .object({
    status: z.enum(["active", "closed"]).optional(),
    shares: z.number().int().positive().optional(),
    riskAmount: decimalField.refine((v) => Number(v) >= 0, { message: "Must not be negative" }).optional(),
    stopLoss: positiveDecimal.optional(),
    profitTarget: positiveDecimal.nullable().optional(),
    exitPrice: positiveDecimal.nullable().optional(),
    pnl: decimalField.nullable().optional(),
    exitReason: z.string().trim().max(50).nullable().optional(),
    exitDate: z
      .union([z.null(), z.coerce.date()])
      .refine((d) => d === null || !Number.isNaN(d.getTime()), { message: "Invalid date" })
      .optional(),
  })
  .strict()
  .refine((u) => Object.keys(u).length > 0, { message: "No fields to update" });

const tradeTrimSchema = z
  .object({
    shares: z.number().int().positive(),
    exitPrice: positiveDecimal,
  })
  .strict();

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

// Express 4 does not catch a rejected promise from an async handler, and an
// unhandled rejection stops the Node process. Send those errors to next()
// so Express answers 500 and the server keeps running.
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
const safe = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res, next).catch(next);
};

// Daily bars for the last week and a half, from the shared cache that keeps
// all lookups under the provider's rate limit. Returns null when the price
// provider fails or has no bars.
function recentDailyBars(symbol: string, _apiKey: string) {
  return getDailyBars(symbol);
}

function quoteFromBars(bars: { close: number }[]) {
  const last = bars[bars.length - 1];
  const prev = bars.length > 1 ? bars[bars.length - 2] : null;
  const pct = prev && prev.close ? ((last.close - prev.close) / prev.close) * 100 : null;
  return {
    price: last.close.toFixed(2),
    ...(pct === null ? {} : { change: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` }),
  };
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

  app.post("/api/request-login-code", safe(async (req, res) => {
    if (!process.env.AUTH_CODE_SECRET) return res.status(500).json({ message: "Auth configuration error" });
    const ip = req.ip || "unknown";
    const { email } = req.body ?? {};
    if (typeof email !== "string" || !email.trim()) return res.status(400).json({ message: "Email is required" });
    if (!checkRateLimit(`req_ip:${ip}`, 3) || !checkRateLimit(`req_email:${email}`, 3)) return res.status(429).json({ message: "Too many requests" });
    
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(200).json({ message: "If an account exists, a code has been sent." });
    
    await storage.deleteAuthCode(email); // Invalidate old codes
    const rawCode = crypto.randomInt(100000, 999999).toString();
    const digest = crypto.createHmac('sha256', process.env.AUTH_CODE_SECRET).update(rawCode).digest('hex');
    
    await storage.saveAuthCode(user.email!, digest);
    await sendVerificationCode(user.email!, rawCode);
    res.status(200).json({ message: "If an account exists, a code has been sent." });
  }));

  app.post("/api/verify-login-code", safe(async (req, res, next) => {
    if (!process.env.AUTH_CODE_SECRET) return res.status(500).json({ message: "Auth configuration error" });
    const ip = req.ip || "unknown";
    const { email, code } = req.body ?? {};
    if (!checkRateLimit(`ver_ip:${ip}`, 5) || !checkRateLimit(`ver_email:${email}`, 5)) return res.status(429).json({ message: "Too many attempts" });
    if (typeof email !== "string" || typeof code !== "string" || !email.trim() || !code.trim()) {
      return res.status(400).json({ message: "Email and code are required" });
    }

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
  }));

  // ... (Other routes remain the same)
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    const { password, ...userProfile } = req.user as any;
    return res.json(userProfile);
  });


  // Record that the signed-in user accepted the not-financial-advice disclaimer.
  app.post("/api/disclaimer/accept", safe(async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const acceptedAt = await storage.acceptDisclaimer((req.user as { id: number }).id);
    if (!acceptedAt) return res.status(404).json({ message: "User not found" });
    res.json({ disclaimerAcceptedAt: acceptedAt });
  }));

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
  app.post("/api/watchlists", safe(async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const w = await storage.createWatchlist({ ...req.body, userId: req.user.id }); res.status(201).json(w); }));
  app.patch("/api/watchlists/:id", safe(async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const w = await storage.updateWatchlist(parseInt(req.params.id), req.user.id, req.body); if (!w) return res.status(404).json({ message: "Not found" }); res.json(w); }));
  app.delete("/api/watchlists/:id", safe(async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const deleted = await storage.deleteWatchlist(parseInt(req.params.id), req.user.id); if (!deleted) return res.status(404).json({ message: "Not found" }); res.status(204).send(); }));
  app.get("/api/trades", (req, res, next) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); storage.getTrades(req.user.id).then(d => res.json(d)).catch(next); });
  app.post("/api/trades", safe(async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const t = await storage.createTrade({ ...req.body, userId: req.user.id }); res.status(201).json(t); }));
  // Sell part of an open trade: saves the sold shares as a closed "trim" trade
  // with its P&L and lowers the open trade's shares and risk.
  app.post("/api/trades/:id/trim", safe(async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid trade id" });
    const parsed = tradeTrimSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid trim", errors: parsed.error.flatten().fieldErrors });
    }
    const userId = (req.user as { id: number }).id;
    const result = await storage.trimTrade(id, userId, parsed.data.shares, parsed.data.exitPrice);
    if (!result.ok) {
      return result.reason === "not_found"
        ? res.status(404).json({ message: "Open trade not found" })
        : res.status(400).json({ message: "A trim must leave at least one share. Use Exit to sell them all." });
    }
    res.status(201).json({ trim: result.trim, remaining: result.remaining });
  }));
  app.patch("/api/trades/:id", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid trade id" });
    const parsed = tradePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid trade update", errors: parsed.error.flatten().fieldErrors });
    }
    try {
      const t = await storage.updateTrade(id, req.user.id, parsed.data);
      if (!t) return res.status(404).json({ message: "Not found" });
      res.json(t);
    } catch (err) {
      next(err);
    }
  });
  app.get("/api/price-alerts", (req, res, next) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); storage.getPriceAlerts(req.user.id).then(d => res.json(d)).catch(next); });
  app.post("/api/price-alerts", safe(async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const a = await storage.createPriceAlert({ ...req.body, userId: req.user.id }); res.status(201).json(a); }));
  app.patch("/api/price-alerts/:id", safe(async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const a = await storage.updatePriceAlert(parseInt(req.params.id), req.user.id, req.body); if (!a) return res.status(404).json({ message: "Not found" }); res.json(a); }));
  app.delete("/api/price-alerts/:id", safe(async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const d = await storage.deletePriceAlert(Number(req.params.id), req.user.id); if (!d) return res.status(404).json({ message: "Not found" }); res.status(204).send(); }));

  app.get("/api/stock-price/:symbol", safe(async (req, res) => {
    const s = req.params.symbol.toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(s)) return res.status(400).json({ message: "Invalid symbol" });
    const apiKey = process.env.MASSIVE_API_KEY;
    if (!apiKey) return res.status(500).json({ message: "API key not configured" });
    const bars = await recentDailyBars(s, apiKey);
    if (!bars) return res.status(404).json({ message: "No recent price for this symbol" });
    // Breakout level for the next day: the higher of 2% above the day's high or 3% above its close.
    const breakoutFrom = (bar: { high: number; close: number }) => Math.max(bar.high * 1.02, bar.close * 1.03);
    const latest = bars[bars.length - 1];
    const previous = bars.length > 1 ? bars[bars.length - 2] : null;
    res.json({
      symbol: s,
      currentPrice: latest.close.toFixed(2),
      suggestedBreakout: breakoutFrom(latest).toFixed(2),
      // The level the latest day had to beat, and that day's date, for "did it break out?".
      previousBreakout: previous ? breakoutFrom(previous).toFixed(2) : null,
      barDate: latest.barDate,
    });
  }));

  app.get("/api/market-data", safe(async (req, res) => {
    const apiKey = process.env.MASSIVE_API_KEY;
    if (!apiKey) return res.status(500).json({ message: "API key not configured" });
    const [spy, nasdaq] = await Promise.all([recentDailyBars("SPY", apiKey), recentDailyBars("QQQ", apiKey)]);
    if (!spy || !nasdaq) return res.status(503).json({ message: "Data unavailable" });
    res.json({ spy: quoteFromBars(spy), nasdaq: quoteFromBars(nasdaq) });
  }));

  app.post("/api/run-scans", (req, res, next) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); next(); }, safe(async (req, res) => { await storage.clearOldScanResults(); exec('.venv/bin/python api/simple_scan.py', (err, stdout) => { let data: any[]; try { data = JSON.parse(stdout); } catch { return res.status(500).json({ message: "Scan failed" }); } Promise.all(data.map((s: any) => storage.createScanResult({ symbol: s.symbol, scanType: '1day', price: s.price.toFixed(2), change: "0", changePercent: s.change_percent.toFixed(2), volume: s.volume, sector: s.sector, dollarVolume: (s.price * s.volume).toString() }))).then(() => res.json({ count: data.length })).catch((e) => { console.error("Saving scan results failed:", e instanceof Error ? e.message : e); res.status(500).json({ message: "Scan failed" }); }); }); }));
  app.post("/api/run-scans-v2", (req, res, next) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); next(); }, runScansV2);
  app.get("/api/scan-results", safe(async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); const r = await storage.getScanResults(); res.json(r); }));
  app.delete("/api/scan-results", safe(async (req, res) => { if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" }); await storage.clearOldScanResults(); res.json({ message: "Cleared" }); }));

  const httpServer = createServer(app);
  return httpServer;
}
