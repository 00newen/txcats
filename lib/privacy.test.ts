import assert from 'node:assert/strict';
import test from 'node:test';

import { maskAmountText, maskSensitiveText, resolvePrivacyMode } from './privacy';

test('resolvePrivacyMode only enables true string', () => {
  assert.equal(resolvePrivacyMode('true'), true);
  assert.equal(resolvePrivacyMode('false'), false);
  assert.equal(resolvePrivacyMode(null), false);
});

test('maskAmountText preserves sign and common currency symbol', () => {
  assert.equal(maskAmountText('+$1,234.56'), '+$•••••');
  assert.equal(maskAmountText('-€1.234,56'), '-€•••••');
  assert.equal(maskAmountText('1 234,56'), '•••••');
});

test('maskSensitiveText returns placeholder for present values', () => {
  assert.equal(maskSensitiveText('Checking account'), '•••••');
  assert.equal(maskSensitiveText(''), '');
});
