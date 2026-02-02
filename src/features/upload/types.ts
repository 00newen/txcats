export type TransactionRow = {
  // Required Canonical Fields
  bookingDate: string; // ISO Date "YYYY-MM-DD"
  amount: string;      // Normalized decimal string
  description: string;

  // Recommended/Optional
  accountId?: string;
  valueDate?: string;
  counterparty?: string;
  currency?: string;     // ISO 3-letter code, default config if missing
  bankTxId?: string;

  // Categorization
  categoryId?: string; 

  // Dynamic Display
  merchantOrName?: string;
  extraColumns?: Record<string, string>;

  // Internal / Original
  rawRow: Record<string, string>;
};

export type CsvMapping = {
  bookingDate: string;
  amount: string;
  description: string;
  accountId?: string; // Optional columns can be unmapped (undefined)
  valueDate?: string;
  counterparty?: string;
  merchantOrName?: string;
  currency?: string;
  bankTxId?: string;
  extraColumns?: string[];
};

export type ParseResult = {
  data: TransactionRow[]; // Heuristically mapped data
  mapping: CsvMapping;    // The mapping used to generate 'data'
  rawHeaders: string[];   // All headers found in CSV
  rawData: Record<string, string>[]; // Raw parsed rows
  errors: string[];
  meta: {
    fields: string[];
  };
};

export type MappingProfile = {
  id: string; // The fingerprint
  mapping: CsvMapping;
  updatedAt: string;
};
