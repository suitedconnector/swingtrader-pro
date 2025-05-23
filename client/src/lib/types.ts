export interface TradingPhase {
  id: number;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

export interface MarketData {
  spy: { price: string; change: string };
  nasdaq: { price: string; change: string };
  vix: { price: string; change: string };
  trend: string;
}

export interface PositionCalculation {
  riskAmount: number;
  riskPerShare: number;
  numShares: number;
  positionValue: number;
  percentOfAccount: number;
}

export interface AccountSettings {
  balance: number;
  defaultRiskPercent: number;
}
