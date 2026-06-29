import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveVaultAutoLockSetting, serializeVaultAutoLockSetting } from './vault-auto-lock';

test('resolveVaultAutoLockSetting accepts supported minute values', () => {
  assert.equal(resolveVaultAutoLockSetting('5'), 5);
  assert.equal(resolveVaultAutoLockSetting('15'), 15);
  assert.equal(resolveVaultAutoLockSetting('30'), 30);
});

test('resolveVaultAutoLockSetting falls back to never', () => {
  assert.equal(resolveVaultAutoLockSetting('10'), 'never');
  assert.equal(resolveVaultAutoLockSetting(null), 'never');
});

test('serializeVaultAutoLockSetting stores stable values', () => {
  assert.equal(serializeVaultAutoLockSetting('never'), 'never');
  assert.equal(serializeVaultAutoLockSetting(15), '15');
});
