import { z } from 'zod';

export const MarketQuoteSchema = z.object({
  symbol: z.string(),
  exchange: z.string(),
  name: z.string(),
  price: z.number().positive(),
  currency: z.string().default('USD'),
  change: z.number(),
  changePercent: z.number(),
  updatedAt: z.string(),
});

export type MarketQuoteDTO = z.infer<typeof MarketQuoteSchema>;

export const ContactFormSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  topic: z.enum(['investors', 'careers', 'general', 'media']),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export type ContactFormData = z.infer<typeof ContactFormSchema>;
