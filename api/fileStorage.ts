import fs from 'fs/promises';
import path from 'path';
import { 
  type User, type InsertUser, type Stock, type InsertStock,
  type Watchlist, type InsertWatchlist, type Trade, type InsertTrade,
  type PriceAlert, type InsertPriceAlert, type ScanResult, type InsertScanResult
} from "@shared/schema";
import { IStorage } from "./storage";

const DATA_DIR = path.join(process.cwd(), 'data');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const WATCHLISTS_FILE = path.join(DATA_DIR, 'watchlists.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');

export class FileStorage implements IStorage {
  private trades: Map<number, Trade> = new Map();
  private users: Map<number, User> = new Map();
  private watchlists: Map<number, Watchlist> = new Map();
  private priceAlerts: Map<number, PriceAlert> = new Map();
  private stocks: Map<string, Stock> = new Map();
  private scanResults: Map<number, ScanResult> = new Map();

  private currentTradeId = 1;
  private currentUserId = 1;
  private currentWatchlistId = 1;
  private currentAlertId = 1;
  private currentStockId = 1;
  private currentScanId = 1;

  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await this.loadData();
    } catch (error) {
      console.error('Failed to initialize file storage:', error);
      await this.initializeDefaultData();
    }
  }

  private async loadData() {
    try {
      // Load trades
      const tradesData = await fs.readFile(TRADES_FILE, 'utf-8');
      const trades = JSON.parse(tradesData);
      this.trades = new Map(trades.map((t: Trade) => [t.id, {
        ...t,
        entryDate: t.entryDate ? new Date(t.entryDate) : null,
        exitDate: t.exitDate ? new Date(t.exitDate) : null
      }]));
      this.currentTradeId = Math.max(...Array.from(this.trades.keys()), 0) + 1;
    } catch (error) {
      console.log('No existing trades file found, initializing...');
    }

    try {
      // Load users
      const usersData = await fs.readFile(USERS_FILE, 'utf-8');
      const users = JSON.parse(usersData);
      this.users = new Map(users.map((u: User) => [u.id, u]));
      this.currentUserId = Math.max(...Array.from(this.users.keys()), 0) + 1;
    } catch (error) {
      console.log('No existing users file found, initializing...');
    }

    try {
      // Load watchlists
      const watchlistsData = await fs.readFile(WATCHLISTS_FILE, 'utf-8');
      const watchlists = JSON.parse(watchlistsData);
      this.watchlists = new Map(watchlists.map((w: Watchlist) => [w.id, {
        ...w,
        createdAt: new Date(w.createdAt)
      }]));
      this.currentWatchlistId = Math.max(...Array.from(this.watchlists.keys()), 0) + 1;
    } catch (error) {
      console.log('No existing watchlists file found, initializing...');
    }

    try {
      // Load alerts
      const alertsData = await fs.readFile(ALERTS_FILE, 'utf-8');
      const alerts = JSON.parse(alertsData);
      this.priceAlerts = new Map(alerts.map((a: PriceAlert) => [a.id, {
        ...a,
        createdAt: new Date(a.createdAt)
      }]));
      this.currentAlertId = Math.max(...Array.from(this.priceAlerts.keys()), 0) + 1;
    } catch (error) {
      console.log('No existing alerts file found, initializing...');
    }

    // Initialize default data if maps are empty
    if (this.users.size === 0 || this.watchlists.size === 0 || this.priceAlerts.size === 0) {
      await this.initializeDefaultData();
    }
  }

  private async saveData() {
    try {
      // Save trades
      const tradesArray = Array.from(this.trades.values());
      await fs.writeFile(TRADES_FILE, JSON.stringify(tradesArray, null, 2));

      // Save users
      const usersArray = Array.from(this.users.values());
      await fs.writeFile(USERS_FILE, JSON.stringify(usersArray, null, 2));

      // Save watchlists
      const watchlistsArray = Array.from(this.watchlists.values());
      await fs.writeFile(WATCHLISTS_FILE, JSON.stringify(watchlistsArray, null, 2));

      // Save alerts
      const alertsArray = Array.from(this.priceAlerts.values());
      await fs.writeFile(ALERTS_FILE, JSON.stringify(alertsArray, null, 2));
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  private async initializeDefaultData() {
    // Create default user
    const defaultUser: User = {
      id: 1,
      username: 'testuser',
      password: 'hashedpassword',
      email: 'tfrei320@gmail.com',
      emailAlerts: true,
      tradingBankroll: '125486.32'
    };
    this.users.set(1, defaultUser);

    // Initialize watchlists
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

    // Initialize price alerts
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

    // Restore your active trades
    const trade1: Trade = {
      id: 1,
      symbol: 'NVDA',
      status: 'active',
      entryPrice: '148.50',
      stopLoss: '142.00',
      profitTarget: '165.00',
      shares: 67,
      riskAmount: '435.50',
      exitReason: null,
      entryDate: new Date('2025-06-26'),
      exitDate: null,
      exitPrice: null,
      pnl: null
    };
    this.trades.set(1, trade1);

    const trade2: Trade = {
      id: 2,
      symbol: 'AMD',
      status: 'active',
      entryPrice: '136.25',
      stopLoss: '130.50',
      profitTarget: '152.00',
      shares: 75,
      riskAmount: '431.25',
      exitReason: null,
      entryDate: new Date('2025-06-26'),
      exitDate: null,
      exitPrice: null,
      pnl: null
    };
    this.trades.set(2, trade2);

    this.currentTradeId = 3;
    this.currentUserId = 2;
    this.currentWatchlistId = 3;
    this.currentAlertId = 4;

    await this.saveData();
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
    await this.saveData();
    return user;
  }

  async updateUserProfile(id: number, updates: { email?: string; emailAlerts?: boolean; tradingBankroll?: string }): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updated: User = { ...user, ...updates };
    this.users.set(id, updated);
    await this.saveData();
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
      createdAt: new Date()
    };
    this.watchlists.set(id, watchlist);
    await this.saveData();
    return watchlist;
  }

  async updateWatchlist(id: number, updates: Partial<InsertWatchlist>): Promise<Watchlist | undefined> {
    const existing = this.watchlists.get(id);
    if (!existing) return undefined;

    const updated: Watchlist = { ...existing, ...updates };
    this.watchlists.set(id, updated);
    await this.saveData();
    return updated;
  }

  async deleteWatchlist(id: number): Promise<boolean> {
    const deleted = this.watchlists.delete(id);
    if (deleted) {
      await this.saveData();
    }
    return deleted;
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
      exitReason: insertTrade.exitReason || null,
      entryDate: insertTrade.entryDate || new Date(),
      exitDate: insertTrade.exitDate || null,
      exitPrice: insertTrade.exitPrice || null,
      pnl: insertTrade.pnl || null
    };
    this.trades.set(id, trade);
    await this.saveData();
    return trade;
  }

  async updateTrade(id: number, updates: Partial<InsertTrade>): Promise<Trade | undefined> {
    const existing = this.trades.get(id);
    if (!existing) return undefined;

    const updated: Trade = { ...existing, ...updates };
    this.trades.set(id, updated);
    await this.saveData();
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
      createdAt: new Date()
    };
    this.priceAlerts.set(id, alert);
    await this.saveData();
    return alert;
  }

  async updatePriceAlert(id: number, updates: Partial<InsertPriceAlert>): Promise<PriceAlert | undefined> {
    const existing = this.priceAlerts.get(id);
    if (!existing) return undefined;

    const updated: PriceAlert = { ...existing, ...updates };
    this.priceAlerts.set(id, updated);
    await this.saveData();
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
    this.scanResults.clear();
    this.currentScanId = 1;
  }
}