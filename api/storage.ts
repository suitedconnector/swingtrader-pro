import { 
  users, stocks, watchlists, trades, priceAlerts, scanResults,
  type User, type InsertUser, type Stock, type InsertStock,
  type Watchlist, type InsertWatchlist, type Trade, type InsertTrade,
  type PriceAlert, type InsertPriceAlert, type ScanResult, type InsertScanResult
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: number, updates: { email?: string; emailAlerts?: boolean; tradingBankroll?: string }): Promise<User | undefined>;
  updateUserPassword(id: number, passwordHash: string): Promise<void>;
  getStocks(): Promise<Stock[]>;
  getStock(symbol: string): Promise<Stock | undefined>;
  createStock(stock: InsertStock): Promise<Stock>;
  updateStock(symbol: string, updates: Partial<InsertStock>): Promise<Stock | undefined>;
  getWatchlists(userId: number): Promise<Watchlist[]>;
  getWatchlist(id: number, userId: number): Promise<Watchlist | undefined>;
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  updateWatchlist(id: number, userId: number, updates: Partial<InsertWatchlist>): Promise<Watchlist | undefined>;
  deleteWatchlist(id: number, userId: number): Promise<boolean>;
  getTrades(userId: number): Promise<Trade[]>;
  getActiveTrades(userId: number): Promise<Trade[]>;
  getTrade(id: number, userId: number): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, userId: number, updates: Partial<InsertTrade>): Promise<Trade | undefined>;
  getPriceAlerts(userId: number): Promise<PriceAlert[]>;
  getActivePriceAlerts(userId: number): Promise<PriceAlert[]>;
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  updatePriceAlert(id: number, userId: number, updates: Partial<InsertPriceAlert>): Promise<PriceAlert | undefined>;
  getScanResults(): Promise<ScanResult[]>;
  getScanResultsByType(scanType: string): Promise<ScanResult[]>;
  createScanResult(result: InsertScanResult): Promise<ScanResult>;
  clearOldScanResults(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, normalized));
    return user || undefined;
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUserProfile(id: number, updates: { email?: string; emailAlerts?: boolean; tradingBankroll?: string }): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }
  async updateUserPassword(id: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ password: passwordHash }).where(eq(users.id, id));
  }
  async getStocks(): Promise<Stock[]> {
    return await db.select().from(stocks);
  }
  async getStock(symbol: string): Promise<Stock | undefined> {
    const [stock] = await db.select().from(stocks).where(eq(stocks.symbol, symbol));
    return stock || undefined;
  }
  async createStock(insertStock: InsertStock): Promise<Stock> {
    const [stock] = await db.insert(stocks).values(insertStock).returning();
    return stock;
  }
  async updateStock(symbol: string, updates: Partial<InsertStock>): Promise<Stock | undefined> {
    const [stock] = await db.update(stocks).set(updates).where(eq(stocks.symbol, symbol)).returning();
    return stock || undefined;
  }
  async getWatchlists(userId: number): Promise<Watchlist[]> {
    return await db.select().from(watchlists).where(eq(watchlists.userId, userId));
  }
  async getWatchlist(id: number, userId: number): Promise<Watchlist | undefined> {
    const [watchlist] = await db.select().from(watchlists).where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
    return watchlist || undefined;
  }
  async createWatchlist(insertWatchlist: InsertWatchlist): Promise<Watchlist> {
    const [watchlist] = await db.insert(watchlists).values({ ...insertWatchlist, userId: insertWatchlist.userId }).returning();
    return watchlist;
  }
  async updateWatchlist(id: number, userId: number, updates: Partial<InsertWatchlist>): Promise<Watchlist | undefined> {
    const [watchlist] = await db.update(watchlists).set(updates).where(and(eq(watchlists.id, id), eq(watchlists.userId, userId))).returning();
    return watchlist || undefined;
  }
  async deleteWatchlist(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(watchlists).where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
    return result.rowCount > 0;
  }
  async getTrades(userId: number): Promise<Trade[]> {
    return await db.select().from(trades).where(eq(trades.userId, userId));
  }
  async getActiveTrades(userId: number): Promise<Trade[]> {
    return await db.select().from(trades).where(and(eq(trades.status, 'active'), eq(trades.userId, userId)));
  }
  async getTrade(id: number, userId: number): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(and(eq(trades.id, id), eq(trades.userId, userId)));
    return trade || undefined;
  }
  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const [trade] = await db.insert(trades).values({ ...insertTrade, userId: insertTrade.userId }).returning();
    return trade;
  }
  async updateTrade(id: number, userId: number, updates: Partial<InsertTrade>): Promise<Trade | undefined> {
    const [trade] = await db.update(trades).set(updates).where(and(eq(trades.id, id), eq(trades.userId, userId))).returning();
    return trade || undefined;
  }
  async getPriceAlerts(userId: number): Promise<PriceAlert[]> {
    return await db.select().from(priceAlerts).where(eq(priceAlerts.userId, userId));
  }
  async getActivePriceAlerts(userId: number): Promise<PriceAlert[]> {
    return await db.select().from(priceAlerts).where(and(eq(priceAlerts.isActive, true), eq(priceAlerts.userId, userId)));
  }
  async createPriceAlert(insertAlert: InsertPriceAlert): Promise<PriceAlert> {
    const [alert] = await db.insert(priceAlerts).values({ ...insertAlert, userId: insertAlert.userId }).returning();
    return alert;
  }
  async updatePriceAlert(id: number, userId: number, updates: Partial<InsertPriceAlert>): Promise<PriceAlert | undefined> {
    const [alert] = await db.update(priceAlerts).set(updates).where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId))).returning();
    return alert || undefined;
  }
  async getScanResults(): Promise<ScanResult[]> {
    return await db.select().from(scanResults);
  }
  async getScanResultsByType(scanType: string): Promise<ScanResult[]> {
    return await db.select().from(scanResults).where(eq(scanResults.scanType, scanType));
  }
  async createScanResult(insertResult: InsertScanResult): Promise<ScanResult> {
    const [result] = await db.insert(scanResults).values(insertResult).returning();
    return result;
  }
  async clearOldScanResults(): Promise<void> {
    await db.delete(scanResults);
  }
}

export const storage = new DatabaseStorage();
