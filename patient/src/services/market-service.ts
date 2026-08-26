import { MarketQuote } from '@/types/market';
import { MarketQuoteSchema } from '@/schemas/market-schema';

export const marketService = {
  async getLatestQuote(symbol = 'WWW'): Promise<MarketQuote> {
    // In production this connects to real financial endpoint or fallback mock
    const mockQuote: MarketQuote = {
      symbol,
      exchange: 'NYSE',
      name: 'Wolverine World Wide, Inc.',
      price: 20.98,
      currency: 'USD',
      change: 0.42,
      changePercent: 2.04,
      updatedAt: new Date().toISOString(),
    };

    const validated = MarketQuoteSchema.parse(mockQuote);
    return validated;
  },
};
