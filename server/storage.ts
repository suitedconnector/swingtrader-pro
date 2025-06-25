import { 
  users, stocks, watchlists, trades, priceAlerts, scanResults,
  type User, type InsertUser, type Stock, type InsertStock,
  type Watchlist, type InsertWatchlist, type Trade, type InsertTrade,
  type PriceAlert, type InsertPriceAlert, type ScanResult, type InsertScanResult
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: number, updates: { email?: string; emailAlerts?: boolean; tradingBankroll?: string }): Promise<User | undefined>;

  // Stock methods
  getStocks(): Promise<Stock[]>;
  getStock(symbol: string): Promise<Stock | undefined>;
  createStock(stock: InsertStock): Promise<Stock>;
  updateStock(symbol: string, updates: Partial<InsertStock>): Promise<Stock | undefined>;

  // Watchlist methods
  getWatchlists(): Promise<Watchlist[]>;
  getWatchlist(id: number): Promise<Watchlist | undefined>;
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  updateWatchlist(id: number, updates: Partial<InsertWatchlist>): Promise<Watchlist | undefined>;
  deleteWatchlist(id: number): Promise<boolean>;

  // Trade methods
  getTrades(): Promise<Trade[]>;
  getActiveTrades(): Promise<Trade[]>;
  getTrade(id: number): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, updates: Partial<InsertTrade>): Promise<Trade | undefined>;

  // Price Alert methods
  getPriceAlerts(): Promise<PriceAlert[]>;
  getActivePriceAlerts(): Promise<PriceAlert[]>;
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  updatePriceAlert(id: number, updates: Partial<InsertPriceAlert>): Promise<PriceAlert | undefined>;

  // Scan Result methods
  getScanResults(): Promise<ScanResult[]>;
  getScanResultsByType(scanType: string): Promise<ScanResult[]>;
  createScanResult(result: InsertScanResult): Promise<ScanResult>;
  clearOldScanResults(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private stocks: Map<string, Stock> = new Map();
  private watchlists: Map<number, Watchlist> = new Map();
  private trades: Map<number, Trade> = new Map();
  private priceAlerts: Map<number, PriceAlert> = new Map();
  private scanResults: Map<number, ScanResult> = new Map();
  
  private currentUserId = 1;
  private currentStockId = 1;
  private currentWatchlistId = 1;
  private currentTradeId = 1;
  private currentAlertId = 1;
  private currentScanId = 1;

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default user with your settings
    const defaultUser: User = {
      id: 1,
      username: 'testuser', 
      password: 'hashedpassword',
      email: 'tfrei320@gmail.com',
      emailAlerts: true,
      tradingBankroll: '125486.32'
    };
    this.users.set(1, defaultUser);

    // Initialize watchlists with your stocks
    this.watchlists.set(1, {
      id: 1,
      name: "Focus List",
      type: "focus",
      symbols: ["TSLA", "GOOGL", "CVS", "MSFT", "AVGO", "AMD"],
      createdAt: new Date()
    });
    
    this.watchlists.set(2, {
      id: 2,
      name: "Flagged List", 
      type: "flagged",
      symbols: ["NVDA", "BAC"],
      createdAt: new Date()
    });
    
    this.currentWatchlistId = 3;

    // Restore your previous price alerts
    const nvdaAlert: PriceAlert = {
      id: 1,
      symbol: 'NVDA',
      targetPrice: '152.34',
      alertType: 'breakout',
      isActive: true,
      createdAt: new Date()
    };
    this.priceAlerts.set(1, nvdaAlert);

    const amdAlert: PriceAlert = {
      id: 2, 
      symbol: 'AMD',
      targetPrice: '142.58',
      alertType: 'breakout',
      isActive: true,
      createdAt: new Date()
    };
    this.priceAlerts.set(2, amdAlert);

    const cvsAlert: PriceAlert = {
      id: 3,
      symbol: 'CVS', 
      targetPrice: '69.61',
      alertType: 'breakout',
      isActive: true,
      createdAt: new Date()
    };
    this.priceAlerts.set(3, cvsAlert);

    this.currentAlertId = 4;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, email: null, emailAlerts: true, tradingBankroll: "0.00" };
    this.users.set(id, user);
    return user;
  }

  async updateUserProfile(id: number, updates: { email?: string; phone?: string; emailAlerts?: boolean; smsAlerts?: boolean }): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated: User = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  // Stock methods
  async getStocks(): Promise<Stock[]> {
    return Array.from(this.stocks.values());
  }

  async getStock(symbol: string): Promise<Stock | undefined> {
    return this.stocks.get(symbol);
  }

  async createStock(insertStock: InsertStock): Promise<Stock> {
    const stock: Stock = { 
      ...insertStock, 
      id: this.currentStockId++,
      adr: insertStock.adr || null,
      dollarVolume: insertStock.dollarVolume || null,
      lastUpdated: new Date()
    };
    this.stocks.set(insertStock.symbol, stock);
    return stock;
  }

  async updateStock(symbol: string, updates: Partial<InsertStock>): Promise<Stock | undefined> {
    const existing = this.stocks.get(symbol);
    if (!existing) return undefined;
    
    const updated: Stock = { 
      ...existing, 
      ...updates,
      lastUpdated: new Date()
    };
    this.stocks.set(symbol, updated);
    return updated;
  }

  // Watchlist methods
  async getWatchlists(): Promise<Watchlist[]> {
    return Array.from(this.watchlists.values());
  }

  async getWatchlist(id: number): Promise<Watchlist | undefined> {
    return this.watchlists.get(id);
  }

  async createWatchlist(insertWatchlist: InsertWatchlist): Promise<Watchlist> {
    const id = this.currentWatchlistId++;
    const watchlist: Watchlist = {
      ...insertWatchlist,
      id,
      symbols: insertWatchlist.symbols || [],
      createdAt: new Date()
    };
    this.watchlists.set(id, watchlist);
    return watchlist;
  }

  async updateWatchlist(id: number, updates: Partial<InsertWatchlist>): Promise<Watchlist | undefined> {
    const existing = this.watchlists.get(id);
    if (!existing) return undefined;
    
    const updated: Watchlist = { ...existing, ...updates };
    this.watchlists.set(id, updated);
    return updated;
  }

  async deleteWatchlist(id: number): Promise<boolean> {
    return this.watchlists.delete(id);
  }

  // Trade methods
  async getTrades(): Promise<Trade[]> {
    return Array.from(this.trades.values());
  }

  async getActiveTrades(): Promise<Trade[]> {
    return Array.from(this.trades.values()).filter(trade => trade.status === 'active');
  }

  async getTrade(id: number): Promise<Trade | undefined> {
    return this.trades.get(id);
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const id = this.currentTradeId++;
    const trade: Trade = {
      ...insertTrade,
      id,
      status: insertTrade.status || 'active',
      entryDate: new Date(),
      exitDate: null,
      exitPrice: null,
      pnl: null
    };
    this.trades.set(id, trade);
    return trade;
  }

  async updateTrade(id: number, updates: Partial<InsertTrade>): Promise<Trade | undefined> {
    const existing = this.trades.get(id);
    if (!existing) return undefined;
    
    const updated: Trade = { ...existing, ...updates };
    this.trades.set(id, updated);
    return updated;
  }

  // Price Alert methods
  async getPriceAlerts(): Promise<PriceAlert[]> {
    return Array.from(this.priceAlerts.values());
  }

  async getActivePriceAlerts(): Promise<PriceAlert[]> {
    return Array.from(this.priceAlerts.values()).filter(alert => alert.isActive);
  }

  async createPriceAlert(insertAlert: InsertPriceAlert): Promise<PriceAlert> {
    const id = this.currentAlertId++;
    const alert: PriceAlert = {
      ...insertAlert,
      id,
      isActive: insertAlert.isActive !== undefined ? insertAlert.isActive : true,
      createdAt: new Date()
    };
    this.priceAlerts.set(id, alert);
    return alert;
  }

  async updatePriceAlert(id: number, updates: Partial<InsertPriceAlert>): Promise<PriceAlert | undefined> {
    const existing = this.priceAlerts.get(id);
    if (!existing) return undefined;
    
    const updated: PriceAlert = { ...existing, ...updates };
    this.priceAlerts.set(id, updated);
    return updated;
  }

  // Scan Result methods
  async getScanResults(): Promise<ScanResult[]> {
    return Array.from(this.scanResults.values());
  }

  async getScanResultsByType(scanType: string): Promise<ScanResult[]> {
    return Array.from(this.scanResults.values()).filter(result => result.scanType === scanType);
  }

  async createScanResult(insertResult: InsertScanResult): Promise<ScanResult> {
    const id = this.currentScanId++;
    const result: ScanResult = {
      ...insertResult,
      id,
      adr: insertResult.adr || null,
      dollarVolume: insertResult.dollarVolume || null,
      createdAt: new Date()
    };
    this.scanResults.set(id, result);
    return result;
  }

  async clearOldScanResults(): Promise<void> {
    // Force rebuild the entire scan results map to eliminate any corruption
    this.scanResults = new Map<number, ScanResult>();
    this.currentScanId = 1; // Reset ID counter
    console.log('Scan results completely cleared and rebuilt');
  }
}

import { users, stocks, watchlists, trades, priceAlerts, scanResults, type User, type Stock, type Watchlist, type Trade, type PriceAlert, type ScanResult, type InsertUser, type InsertStock, type InsertWatchlist, type InsertTrade, type InsertPriceAlert, type InsertScanResult } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserProfile(id: number, updates: { email?: string; phone?: string; emailAlerts?: boolean; smsAlerts?: boolean }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getStocks(): Promise<Stock[]> {
    return await db.select().from(stocks);
  }

  async getStock(symbol: string): Promise<Stock | undefined> {
    const [stock] = await db.select().from(stocks).where(eq(stocks.symbol, symbol));
    return stock || undefined;
  }

  async createStock(insertStock: InsertStock): Promise<Stock> {
    const [stock] = await db
      .insert(stocks)
      .values(insertStock)
      .returning();
    return stock;
  }

  async updateStock(symbol: string, updates: Partial<InsertStock>): Promise<Stock | undefined> {
    const [stock] = await db
      .update(stocks)
      .set(updates)
      .where(eq(stocks.symbol, symbol))
      .returning();
    return stock || undefined;
  }

  async getWatchlists(): Promise<Watchlist[]> {
    return await db.select().from(watchlists);
  }

  async getWatchlist(id: number): Promise<Watchlist | undefined> {
    const [watchlist] = await db.select().from(watchlists).where(eq(watchlists.id, id));
    return watchlist || undefined;
  }

  async createWatchlist(insertWatchlist: InsertWatchlist): Promise<Watchlist> {
    const [watchlist] = await db
      .insert(watchlists)
      .values(insertWatchlist)
      .returning();
    return watchlist;
  }

  async updateWatchlist(id: number, updates: Partial<InsertWatchlist>): Promise<Watchlist | undefined> {
    const [watchlist] = await db
      .update(watchlists)
      .set(updates)
      .where(eq(watchlists.id, id))
      .returning();
    return watchlist || undefined;
  }

  async deleteWatchlist(id: number): Promise<boolean> {
    const result = await db.delete(watchlists).where(eq(watchlists.id, id));
    return result.rowCount > 0;
  }

  async getTrades(): Promise<Trade[]> {
    return await db.select().from(trades);
  }

  async getActiveTrades(): Promise<Trade[]> {
    return await db.select().from(trades).where(eq(trades.status, 'active'));
  }

  async getTrade(id: number): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    return trade || undefined;
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const [trade] = await db
      .insert(trades)
      .values(insertTrade)
      .returning();
    return trade;
  }

  async updateTrade(id: number, updates: Partial<InsertTrade>): Promise<Trade | undefined> {
    const [trade] = await db
      .update(trades)
      .set(updates)
      .where(eq(trades.id, id))
      .returning();
    return trade || undefined;
  }

  async getPriceAlerts(): Promise<PriceAlert[]> {
    return await db.select().from(priceAlerts);
  }

  async getActivePriceAlerts(): Promise<PriceAlert[]> {
    return await db.select().from(priceAlerts).where(eq(priceAlerts.isActive, true));
  }

  async createPriceAlert(insertAlert: InsertPriceAlert): Promise<PriceAlert> {
    const [alert] = await db
      .insert(priceAlerts)
      .values(insertAlert)
      .returning();
    return alert;
  }

  async updatePriceAlert(id: number, updates: Partial<InsertPriceAlert>): Promise<PriceAlert | undefined> {
    const [alert] = await db
      .update(priceAlerts)
      .set(updates)
      .where(eq(priceAlerts.id, id))
      .returning();
    return alert || undefined;
  }

  async getScanResults(): Promise<ScanResult[]> {
    return await db.select().from(scanResults);
  }

  async getScanResultsByType(scanType: string): Promise<ScanResult[]> {
    return await db.select().from(scanResults).where(eq(scanResults.scanType, scanType));
  }

  async createScanResult(insertResult: InsertScanResult): Promise<ScanResult> {
    const [result] = await db
      .insert(scanResults)
      .values(insertResult)
      .returning();
    return result;
  }

  async clearOldScanResults(): Promise<void> {
    await db.delete(scanResults);
  }
}

export const storage = new MemStorage();
