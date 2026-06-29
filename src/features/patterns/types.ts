export const PATTERN_TEXT_FIELDS = ['description', 'name', 'sender', 'recipient', 'counterparty'] as const;

export type PatternTextField = (typeof PATTERN_TEXT_FIELDS)[number];

export const PATTERN_MATCH_FIELDS = ['descriptionOrName', ...PATTERN_TEXT_FIELDS, 'amount'] as const;

export type PatternMatchField = (typeof PATTERN_MATCH_FIELDS)[number];

export const PATTERN_MATCH_FIELD_LABELS: Record<PatternMatchField, string> = {
  descriptionOrName: 'Description or Name',
  description: 'Description',
  name: 'Name',
  sender: 'Sender',
  recipient: 'Recipient',
  counterparty: 'Counterparty',
  amount: 'Amount',
};

export const PATTERN_TEXT_OPERATORS = ['contains', 'exact', 'regex'] as const;
export const PATTERN_AMOUNT_OPERATORS = ['lt', 'gt', 'eq', 'between'] as const;

export type PatternTextOperator = (typeof PATTERN_TEXT_OPERATORS)[number];
export type PatternAmountOperator = (typeof PATTERN_AMOUNT_OPERATORS)[number];
export type PatternConditionMode = 'all' | 'any';

export type PatternTextCondition = {
  type: 'text';
  field: PatternTextField;
  operator: PatternTextOperator;
  value: string;
};

export type PatternAmountCondition = {
  type: 'amount';
  field: 'amount';
  operator: PatternAmountOperator;
  value: string;
  secondaryValue?: string;
};

export type PatternCondition = PatternTextCondition | PatternAmountCondition;

export type PatternItem = {
  id: string; // UUID
  categoryId: string;
  priority: number;
  conditionMode: PatternConditionMode;
  conditions: PatternCondition[];
};

export type PatternExecutionResult = {
  transactionId: string;
  matchedPatternId: string;
  matchString: string;
  suggestedCategoryId: string;
};
