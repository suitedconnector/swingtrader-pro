import { pgTable, text, serial, integer, boolean, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  change: decimal("change", { precision: 10, scale: 2 }).notNull(),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }).notNull(),
  volume: integer("volume").notNull(),
  sector: text("sector").notNull(),
  adr: decimal("adr", { precision: 10, scale: 4 }),
  dollarVolume: decimal("dollar_volume", { precision: 15, scale: 2 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const watchlists = pgTable("watchlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'focus' or 'flagged'
  symbols: text("symbols").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  entryPrice: decimal("entry_price", { precision: 10, scale: 2 }).notNull(),
  stopLoss: decimal("stop_loss", { precision: 10, scale: 2 }).notNull(),
  shares: integer("shares").notNull(),
  riskAmount: decimal("risk_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("active"), // 'active', 'closed'
  entryDate: timestamp("entry_date").defaultNow(),
  exitDate: timestamp("exit_date"),
  exitPrice: decimal("exit_price", { precision: 10, scale: 2 }),
  pnl: decimal("pnl", { precision: 10, scale: 2 }),
});

export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  targetPrice: decimal("target_price", { precision: 10, scale: 2 }).notNull(),
  alertType: text("alert_type").notNull(), // 'breakout', 'breakdown'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scanResults = pgTable("scan_results", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  scanType: text("scan_type").notNull(), // '1month', '3month', '6month', '1week'
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  change: decimal("change", { precision: 10, scale: 2 }).notNull(),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }).notNull(),
  volume: integer("volume").notNull(),
  sector: text("sector").notNull(),
  adr: decimal("adr", { precision: 10, scale: 4 }),
  dollarVolume: decimal("dollar_volume", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertStockSchema = createInsertSchema(stocks).omit({
  id: true,
  lastUpdated: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlists).omit({
  id: true,
  createdAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  entryDate: true,
  exitDate: true,
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  createdAt: true,
});

export const insertScanResultSchema = createInsertSchema(scanResults).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

export type Watchlist = typeof watchlists.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type PriceAlert = typeof priceAlerts.$inferSelect;
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;

export type ScanResult = typeof scanResults.$inferSelect;
export type InsertScanResult = z.infer<typeof insertScanResultSchema>;
