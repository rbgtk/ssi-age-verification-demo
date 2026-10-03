import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretVerification } from './server.mjs'

test('waits for a terminal verifier result', () => assert.equal(interpretVerification({ status: 'WAITING' }).status, 'pending'))
test('accepts exactly one boolean true claim after verification', () => assert.equal(interpretVerification({ status: 'VERIFIED', result: { age_over_18: true } }).status, 'success'))
test('denies a verified false claim', () => assert.equal(interpretVerification({ status: 'SUCCESS', credential: { age_over_18: false } }).status, 'underage'))
test('rejects missing, string, or duplicate claims', () => {
  assert.equal(interpretVerification({ status: 'SUCCESS' }).status, 'rejected')
  assert.equal(interpretVerification({ status: 'SUCCESS', age_over_18: 'true' }).status, 'rejected')
  assert.equal(interpretVerification({ status: 'SUCCESS', a: { age_over_18: true }, b: { age_over_18: true } }).status, 'rejected')
})
test('rejects failed presentations regardless of a claim', () => assert.equal(interpretVerification({ status: 'FAILED', age_over_18: true }).status, 'rejected'))
