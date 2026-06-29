import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAmount,
  parseAmount,
  resolveAmountDisplayFormat,
  DEFAULT_AMOUNT_DISPLAY_FORMAT,
} from './amount';

test('parseAmount supports US format', () => {
  assert.equal(parseAmount('1,234.56'), 1234.56);
});

test('parseAmount supports EU format', () => {
  assert.equal(parseAmount('1.234,56'), 1234.56);
});

test('parseAmount supports accounting negatives', () => {
  assert.equal(parseAmount('(1,234.56)'), -1234.56);
  assert.equal(parseAmount('1234,56-'), -1234.56);
});

test('formatAmount uses selected locale format', () => {
  assert.equal(formatAmount(1234.56, 'us'), '1,234.56');
  assert.equal(formatAmount(1234.56, 'eu'), '1.234,56');
});

test('resolveAmountDisplayFormat applies stored configuration', () => {
  const selected = resolveAmountDisplayFormat('space');
  assert.equal(selected, 'space');
  const formatted = formatAmount(1234.56, selected);
  assert.match(formatted, /^1[\s\u00A0\u202F]234,56$/);
});

test('resolveAmountDisplayFormat falls back to default for invalid values', () => {
  assert.equal(resolveAmountDisplayFormat('unknown'), DEFAULT_AMOUNT_DISPLAY_FORMAT);
  assert.equal(resolveAmountDisplayFormat(null), DEFAULT_AMOUNT_DISPLAY_FORMAT);
});
