import { authCodes, pendingEmailChanges, users, stocks, watchlists, trades, priceAlerts, scanResults,
  type User, type InsertUser, type Stock, type InsertStock,
  type Watchlist, type InsertWatchlist, type Trade, type InsertTrade,
  type PriceAlert, type InsertPriceAlert, type ScanResult, type InsertScanResult
} from "../shared/schema";
import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";

// InsertTrade omits exitDate; closing a trade must be able to set it.
export type TradeUpdate = Partial<InsertTrade> & { exitDate?: Date | null };

// Result of selling part of an open trade: the new closed row for the sold
// shares and the open trade with its smaller share count and risk.
export type TrimResult =
  | { ok: true; trim: Trade; remaining: Trade }
  | { ok: false; reason: "not_found" | "too_many_shares" };

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: number, updates: { username?: string; emailAlerts?: boolean; tradingBankroll?: string }): Promise<User | undefined>;
  updateUserPassword(id: number, passwordHash: string): Promise<void>;
  acceptDisclaimer(id: number): Promise<Date | null>;
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
  getAllActiveTrades(): Promise<Trade[]>;
  getTrade(id: number, userId: number): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, userId: number, updates: TradeUpdate): Promise<Trade | undefined>;
  trimTrade(id: number, userId: number, shares: number, exitPrice: string): Promise<TrimResult>;
  getPriceAlerts(userId: number): Promise<PriceAlert[]>;
  getActivePriceAlerts(userId: number): Promise<PriceAlert[]>;
  getAllActivePriceAlerts(): Promise<PriceAlert[]>;
  markPriceAlertFired(id: number, firedPrice: string, firedAt: Date): Promise<PriceAlert | undefined>;
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  updatePriceAlert(id: number, userId: number, updates: Partial<InsertPriceAlert>): Promise<PriceAlert | undefined>;
  deletePriceAlert(id: number, userId: number): Promise<boolean>;
  getScanResults(): Promise<ScanResult[]>;
  getScanResultsByType(scanType: string): Promise<ScanResult[]>;
  createScanResult(result: InsertScanResult): Promise<ScanResult>;
  saveAuthCode(email: string, code: string): Promise<void>;
  verifyAuthCode(email: string, code: string): Promise<boolean>;
  deleteAuthCode(email: string): Promise<void>;
  savePendingEmailChange(userId: number, email: string, codeDigest: string): Promise<void>;
  completePendingEmailChange(userId: number, codeDigest: string): Promise<string | null>;
  deletePendingEmailChange(userId: number): Promise<void>;
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
  async updateUserProfile(id: number, updates: { username?: string; emailAlerts?: boolean; tradingBankroll?: string }): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }
  async updateUserPassword(id: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ password: passwordHash }).where(eq(users.id, id));
  }
  // Records when the user accepted the disclaimer; keeps the first acceptance time.
  async acceptDisclaimer(id: number): Promise<Date | null> {
    const [row] = await db.update(users)
      .set({ disclaimerAcceptedAt: sql`coalesce(${users.disclaimerAcceptedAt}, now())` })
      .where(eq(users.id, id))
      .returning({ disclaimerAcceptedAt: users.disclaimerAcceptedAt });
    return row?.disclaimerAcceptedAt ?? null;
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
  // All users' active trades (each includes userId), for the background trade monitor only.
  async getAllActiveTrades(): Promise<Trade[]> {
    return await db.select().from(trades).where(eq(trades.status, 'active'));
  }
  async getTrade(id: number, userId: number): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(and(eq(trades.id, id), eq(trades.userId, userId)));
    return trade || undefined;
  }
  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const [trade] = await db.insert(trades).values({ ...insertTrade, userId: insertTrade.userId }).returning();
    return trade;
  }
  async updateTrade(id: number, userId: number, updates: TradeUpdate): Promise<Trade | undefined> {
    const [trade] = await db.update(trades).set(updates).where(and(eq(trades.id, id), eq(trades.userId, userId))).returning();
    return trade || undefined;
  }
  // Sells part of an open trade. In one transaction it saves the sold shares
  // as their own closed trade (exit reason "trim", with price and P&L) and
  // lowers the open trade's shares and risk. Risk is split by shares in whole
  // cents, so the two parts add up to the original risk.
  async trimTrade(id: number, userId: number, shares: number, exitPrice: string): Promise<TrimResult> {
    return await db.transaction(async (tx) => {
      const [trade] = await tx.select().from(trades)
        .where(and(eq(trades.id, id), eq(trades.userId, userId), eq(trades.status, 'active')))
        .for('update');
      if (!trade) return { ok: false as const, reason: "not_found" as const };
      if (shares >= trade.shares) return { ok: false as const, reason: "too_many_shares" as const };

      const riskCents = Math.round(Number(trade.riskAmount) * 100);
      const remainingShares = trade.shares - shares;
      const remainingRiskCents = Math.round((riskCents * remainingShares) / trade.shares);
      const trimRiskCents = riskCents - remainingRiskCents;
      const pnl = (Number(exitPrice) - Number(trade.entryPrice)) * shares;

      const [trim] = await tx.insert(trades).values({
        userId: trade.userId,
        symbol: trade.symbol,
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        profitTarget: trade.profitTarget,
        shares,
        riskAmount: (trimRiskCents / 100).toFixed(2),
        status: 'closed',
        exitReason: 'trim',
        entryDate: trade.entryDate,
        exitDate: new Date(),
        exitPrice,
        pnl: pnl.toFixed(2),
      }).returning();

      const [remaining] = await tx.update(trades)
        .set({ shares: remainingShares, riskAmount: (remainingRiskCents / 100).toFixed(2) })
        .where(eq(trades.id, trade.id))
        .returning();

      return { ok: true as const, trim, remaining };
    });
  }
  async getPriceAlerts(userId: number): Promise<PriceAlert[]> {
    return await db.select().from(priceAlerts).where(eq(priceAlerts.userId, userId));
  }
  async getActivePriceAlerts(userId: number): Promise<PriceAlert[]> {
    return await db.select().from(priceAlerts).where(and(eq(priceAlerts.isActive, true), eq(priceAlerts.userId, userId)));
  }
  // All users' active alerts (each includes userId), for the background alert checker only.
  async getAllActivePriceAlerts(): Promise<PriceAlert[]> {
    return await db.select().from(priceAlerts).where(eq(priceAlerts.isActive, true));
  }
  // Turns an active alert off and records when and at what price it fired.
  // Returns undefined if it was already off or deleted, so it never fires twice.
  async markPriceAlertFired(id: number, firedPrice: string, firedAt: Date): Promise<PriceAlert | undefined> {
    const [alert] = await db.update(priceAlerts)
      .set({ isActive: false, firedPrice, firedAt })
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.isActive, true)))
      .returning();
    return alert || undefined;
  }
  async createPriceAlert(insertAlert: InsertPriceAlert): Promise<PriceAlert> {
    const [alert] = await db.insert(priceAlerts).values({ ...insertAlert, userId: insertAlert.userId }).returning();
    return alert;
  }
  async updatePriceAlert(id: number, userId: number, updates: Partial<InsertPriceAlert>): Promise<PriceAlert | undefined> {
    const [alert] = await db.update(priceAlerts).set(updates).where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId))).returning();
    return alert || undefined;
  }
  async deletePriceAlert(id: number, userId: number): Promise<boolean> {
    const deleted = await db.delete(priceAlerts)
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)))
      .returning({ id: priceAlerts.id });
    return deleted.length > 0;
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
  async saveAuthCode(email: string, code: string): Promise<void> {
    await db.insert(authCodes).values({
      email,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
  }

  async verifyAuthCode(email: string, code: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [result] = await tx.delete(authCodes)
        .where(and(eq(authCodes.email, email), eq(authCodes.code, code)))
        .returning();
      
      if (!result || result.expiresAt < new Date()) return false;
      return true;
    });
  }

  async deleteAuthCode(email: string): Promise<void> {
    await db.delete(authCodes).where(eq(authCodes.email, email));
  }

  async savePendingEmailChange(userId: number, email: string, codeDigest: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.insert(pendingEmailChanges).values({
      userId,
      email,
      codeDigest,
      expiresAt,
    }).onConflictDoUpdate({
      target: pendingEmailChanges.userId,
      set: {
        email,
        codeDigest,
        expiresAt,
        createdAt: new Date(),
      },
    });
  }

  async completePendingEmailChange(userId: number, codeDigest: string): Promise<string | null> {
    return await db.transaction(async (tx) => {
      const [pending] = await tx.select()
        .from(pendingEmailChanges)
        .where(eq(pendingEmailChanges.userId, userId))
        .for("update");

      if (!pending || pending.expiresAt < new Date() || pending.codeDigest !== codeDigest) {
        return null;
      }

      const [updatedUser] = await tx.update(users)
        .set({ email: pending.email })
        .where(eq(users.id, userId))
        .returning({ email: users.email });

      if (!updatedUser) return null;

      await tx.delete(pendingEmailChanges)
        .where(eq(pendingEmailChanges.userId, userId));

      return updatedUser.email;
    });
  }

  async deletePendingEmailChange(userId: number): Promise<void> {
    await db.delete(pendingEmailChanges)
      .where(eq(pendingEmailChanges.userId, userId));
  }

  async clearOldScanResults(): Promise<void> {
    await db.delete(scanResults);
  }
}

export const storage = new DatabaseStorage();
