import { create } from 'zustand';
import { MarketQuote } from '@/types/market';
import { marketService } from '@/services/market-service';

interface MarketState {
  quote: MarketQuote | null;
  isLoading: boolean;
  error: string | null;
  fetchQuote: () => Promise<void>;
}

export const useMarketStore = create<MarketState>((set) => ({
  quote: {
    symbol: 'WWW',
    exchange: 'NYSE',
    name: 'Wolverine World Wide, Inc.',
    price: 20.98,
    currency: 'USD',
    change: 0.42,
    changePercent: 2.04,
    updatedAt: new Date().toISOString(),
  },
  isLoading: false,
  error: null,
  fetchQuote: async () => {
    set({ isLoading: true, error: null });
    try {
      const quote = await marketService.getLatestQuote('WWW');
      set({ quote, isLoading: false });
    } catch (err: unknown) {
      set({ error: (err as Error).message || 'Failed to fetch quote', isLoading: false });
    }
  },
}));
