import { z } from 'zod';

// Base schemas without refinements
const TradeBaseSchema = z.object({
  symbol: z.string().min(1).max(20).regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase alphanumeric'),
  direction: z.enum(['LONG', 'SHORT', 'CALL', 'PUT']),
  asset_type: z.enum(['stock', 'option', 'future', 'crypto']).default('stock'),
  quantity: z.number().int().positive().max(100000, 'Quantity cannot exceed 100,000'),
  entry_price: z.number().positive('Entry price must be positive'),
  exit_price: z.number().positive('Exit price must be positive').optional(),
  entry_date: z.string().datetime('Invalid entry date format'),
  exit_date: z.string().datetime('Invalid exit date format').optional(),
  strike: z.number().positive('Strike must be positive').optional(),
  expiry: z.string().optional(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  chart_url: z.string().url('Invalid chart URL').optional(),
  account_id: z.number().int().positive().optional(),
  status: z.enum(['open', 'closed', 'stopped']).default('closed'),
});

const AccountBaseSchema = z.object({
  platform: z.string().min(1).max(50, 'Platform name cannot exceed 50 characters'),
  account_name: z.string().min(1).max(100, 'Account name cannot exceed 100 characters'),
  account_id: z.string().max(100).optional(),
  balance: z.number().nonnegative('Balance cannot be negative'),
  currency: z.string().length(3, 'Currency must be 3-letter code (e.g., USD)').default('USD'),
});

// Full schemas with refinements
export const TradeSchema = TradeBaseSchema.refine(
  (data) => {
    // Validate exit_date is after entry_date if both present
    if (data.exit_date && data.entry_date) {
      return new Date(data.exit_date) >= new Date(data.entry_date);
    }
    return true;
  },
  {
    message: 'Exit date must be after entry date',
    path: ['exit_date'],
  }
);

export const AccountSchema = AccountBaseSchema;

// Update schemas (partial, no refinements for flexibility)
export const TradeUpdateSchema = TradeBaseSchema.partial();
export const AccountUpdateSchema = AccountBaseSchema.partial();

export type TradeInput = z.infer<typeof TradeSchema>;
export type AccountInput = z.infer<typeof AccountSchema>;
export type TradeUpdateInput = z.infer<typeof TradeUpdateSchema>;
export type AccountUpdateInput = z.infer<typeof AccountUpdateSchema>;
