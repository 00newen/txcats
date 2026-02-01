export type TransactionRow = {
  date: string;
  amount: string;
  description: string;
  // Account identifier if present in CSV
  account?: string;
  // Original raw data for reference
  raw: Record<string, string>;
};

export type ParseResult = {
  data: TransactionRow[];
  errors: string[];
  meta: {
    fields: string[];
  };
};
