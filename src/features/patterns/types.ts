export type PatternItem = {
  id: string; // UUID
  matchString: string;
  categoryId: string;
  matchType: 'contains' | 'exact' | 'regex';
  priority: number;
};

export type PatternExecutionResult = {
  transactionId: string;
  matchedPatternId: string;
  matchString: string;
  suggestedCategoryId: string;
};
