import {
  type PatternAmountOperator,
  type PatternCondition,
  type PatternConditionMode,
  type PatternItem,
  type PatternMatchField,
  type PatternTextField,
  type PatternTextOperator,
} from '../types';

function textFieldToConditions(
  matchField: Exclude<PatternMatchField, 'amount'>,
  operator: PatternTextOperator,
  value: string,
): { conditionMode: PatternConditionMode; conditions: PatternCondition[] } {
  if (matchField === 'descriptionOrName') {
    return {
      conditionMode: 'any',
      conditions: [
        { type: 'text', field: 'description', operator, value },
        { type: 'text', field: 'name', operator, value },
      ],
    };
  }

  return {
    conditionMode: 'all',
    conditions: [{ type: 'text', field: matchField as PatternTextField, operator, value }],
  };
}

export function createPatternFromConditions(input: {
  id: string;
  categoryId: string;
  priority?: number;
  conditionMode: PatternConditionMode;
  conditions: PatternCondition[];
}): PatternItem {
  return {
    id: input.id,
    categoryId: input.categoryId,
    priority: input.priority ?? 0,
    conditionMode: input.conditionMode,
    conditions: input.conditions,
  };
}

export function createSingleConditionPattern(input: {
  id: string;
  categoryId: string;
  priority?: number;
} & (
  | {
      field: Exclude<PatternMatchField, 'amount'>;
      operator: PatternTextOperator;
      value: string;
    }
  | {
      field: 'amount';
      operator: PatternAmountOperator;
      value: string;
      secondaryValue?: string;
    }
)): PatternItem {
  if (input.field === 'amount') {
    return {
      id: input.id,
      categoryId: input.categoryId,
      priority: input.priority ?? 0,
      conditionMode: 'all',
      conditions: [
        {
          type: 'amount',
          field: 'amount',
          operator: input.operator,
          value: input.value.trim(),
          secondaryValue: input.secondaryValue?.trim() || undefined,
        },
      ],
    };
  }

  const normalized = textFieldToConditions(input.field, input.operator, input.value.trim());
  return {
    id: input.id,
    categoryId: input.categoryId,
    priority: input.priority ?? 0,
    conditionMode: normalized.conditionMode,
    conditions: normalized.conditions,
  };
}

export function getPrimaryCondition(pattern: PatternItem): PatternCondition | undefined {
  return pattern.conditions[0];
}

export function describePatternCondition(condition: PatternCondition | undefined): {
  fieldLabel: string;
  operatorLabel: string;
  valueLabel: string;
} {
  if (!condition) {
    return { fieldLabel: 'Unknown', operatorLabel: 'unknown', valueLabel: '' };
  }

  if (condition.type === 'amount') {
    const operatorLabelMap: Record<PatternAmountOperator, string> = {
      lt: '<',
      gt: '>',
      eq: '=',
      between: 'between',
    };

    return {
      fieldLabel: 'Amount',
      operatorLabel: operatorLabelMap[condition.operator],
      valueLabel:
        condition.operator === 'between'
          ? `${condition.value} to ${condition.secondaryValue || ''}`.trim()
          : condition.value,
    };
  }

  return {
    fieldLabel:
      condition.field === 'description'
        ? 'Description'
        : condition.field === 'name'
          ? 'Name'
          : condition.field === 'sender'
            ? 'Sender'
            : condition.field === 'recipient'
              ? 'Recipient'
              : 'Counterparty',
    operatorLabel: condition.operator,
    valueLabel: condition.value,
  };
}
