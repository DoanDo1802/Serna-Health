export interface MarketQuote {
  symbol: string;
  exchange: string;
  name: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  updatedAt: string;
}

export interface CultureStat {
  id: string;
  percentage: number;
  description: string;
}
