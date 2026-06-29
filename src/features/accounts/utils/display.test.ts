import assert from 'node:assert/strict';
import test from 'node:test';

import { getAccountDisplay, maskAccountIdentifier } from './display';

test('maskAccountIdentifier keeps only the last four characters visible', () => {
  assert.equal(maskAccountIdentifier('NL91 ABNA 0417 1643 00'), '••••4300');
});

test('getAccountDisplay prefers a saved account label', () => {
  const display = getAccountDisplay(
    [
      {
        id: 'acc_1',
        uniqueId: 'iban-1',
        identifier: 'NL91ABNA0417164300',
        name: 'Shared Bills',
        type: 'checking',
        currency: 'EUR',
      },
    ],
    'NL91ABNA0417164300',
  );

  assert.deepEqual(display, {
    label: 'Shared Bills',
    secondary: '••••4300',
    hasCustomLabel: true,
  });
});
