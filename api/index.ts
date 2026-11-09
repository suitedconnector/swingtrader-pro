import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startTradeMonitoring } from "./tradeMonitor";
import { DatabaseStorage } from "./storage";
import { setupAuth } from "./authSetup";
import { pool } from "./db";

const PgSession = connectPgSimple(session);
const storage = new DatabaseStorage();

const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev_secret_key',
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
        pool,
        tableName: 'session'
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  setupAuth();

// Simple request logging
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

(async () => {
  const server = await registerRoutes(app);



  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Start trade monitoring system
  if (process.env.DISABLE_TRADE_MONITORING !== 'true') {
    startTradeMonitoring();
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
