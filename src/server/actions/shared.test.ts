import test from 'node:test'
import assert from 'node:assert/strict'
import { fail, ok, unwrap } from '@/lib/actions/result'

test('unwrap returns data for success results', () => {
  assert.deepEqual(unwrap(ok({ count: 1 })), { count: 1 })
})

test('unwrap throws for failure results', () => {
  assert.throws(() => unwrap(fail('NO_VAULT', 'No vault found')), /No vault found/)
})
