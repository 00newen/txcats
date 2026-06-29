import test from 'node:test';
import assert from 'node:assert/strict';
import { createSingleConditionPattern, getPrimaryCondition } from './model';

test('createSingleConditionPattern emits any-mode for descriptionOrName and all-mode otherwise', () => {
  const descriptionOrName = createSingleConditionPattern({
    id: 'a',
    categoryId: 'x',
    field: 'descriptionOrName',
    operator: 'contains',
    value: 'rent',
  });
  const senderOnly = createSingleConditionPattern({
    id: 'b',
    categoryId: 'x',
    field: 'sender',
    operator: 'exact',
    value: 'Acme',
  });

  assert.equal(descriptionOrName.conditionMode, 'any');
  assert.deepEqual(
    descriptionOrName.conditions.map((condition) => condition.field),
    ['description', 'name'],
  );
  assert.equal(descriptionOrName.conditions.length, 2);
  assert.equal(senderOnly.conditionMode, 'all');
  assert.equal(senderOnly.conditions[0]?.field, 'sender');
});

test('getPrimaryCondition returns the first normalized condition', () => {
  const pattern = createSingleConditionPattern({
    id: 'a',
    categoryId: 'x',
    field: 'sender',
    operator: 'contains',
    value: 'Acme',
  });

  assert.deepEqual(getPrimaryCondition(pattern), pattern.conditions[0]);
});

test('createSingleConditionPattern supports amount conditions', () => {
  const pattern = createSingleConditionPattern({
    id: 'amount',
    categoryId: 'salary',
    field: 'amount',
    operator: 'between',
    value: '2000',
    secondaryValue: '3000',
  });

  assert.equal(pattern.conditionMode, 'all');
  assert.deepEqual(pattern.conditions[0], {
    type: 'amount',
    field: 'amount',
    operator: 'between',
    value: '2000',
    secondaryValue: '3000',
  });
});
