import { z } from 'zod';

export type ResourceType = 'transaction' | 'category' | 'pattern' | 'account';

// Transaction Payload
export const transactionPayloadSchema = z.object({
  date: z.string(), // ISO date
  amount: z.number(),
  description: z.string(),
  merchantName: z.string().optional(),
  categoryId: z.string().optional(), // References another vaultItem id
  accountId: z.string().optional(), // References another vaultItem id
  isTransfer: z.boolean().optional(),
  notes: z.string().optional(),
});

export type TransactionPayload = z.infer<typeof transactionPayloadSchema>;

// Category Payload
export const categoryPayloadSchema = z.object({
  name: z.string(),
  color: z.string(), // Hex color
  icon: z.string().optional(), // Icon name
  parentId: z.string().optional(), // References another vaultItem id
});

export type CategoryPayload = z.infer<typeof categoryPayloadSchema>;

// Pattern Payload
export const patternPayloadSchema = z.object({
  type: z.enum(['merchant_exact', 'merchant_partial', 'description_keyword']),
  pattern: z.string(),
  categoryId: z.string(), // References vaultItem id
  priority: z.number(), // 1-100
  confidence: z.number(), // 0-1
  usageCount: z.number(),
  isManual: z.boolean(),
});

export type PatternPayload = z.infer<typeof patternPayloadSchema>;

// Account Payload
export const accountPayloadSchema = z.object({
  name: z.string(),
  identifier: z.string(), // Account number/identifier from CSV
  type: z.enum(['checking', 'savings', 'credit', 'investment', 'other']),
  currency: z.string(), // 'USD', 'EUR', etc.
});

export type AccountPayload = z.infer<typeof accountPayloadSchema>;
