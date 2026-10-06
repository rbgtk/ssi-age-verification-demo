import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretVerification } from './server.mjs'

test('waits for a terminal verifier result', () => assert.equal(interpretVerification({ status: 'WAITING' }).status, 'pending'))
const result = (value) => ({
  status: 'SUCCESSFUL',
  policy_results: { overallSuccess: true },
  presented_credentials: { age_credential: [{ credentialData: { age_over_18: value } }] },
})

test('accepts one verified boolean true claim', () => assert.equal(interpretVerification(result(true)).status, 'success'))
test('denies a verified false claim', () => assert.equal(interpretVerification(result(false)).status, 'underage'))
test('accepts repeated representations elsewhere in the verifier result', () => {
  const info = result(true)
  info.policy_results.copy = { age_over_18: true, errors: [] }
  info.presentation_validation_results = {
    age_credential: {
      signature: { success: true, errors: [] },
      nonce: { success: true, errors: [] },
    },
  }
  info.presented_presentations = { age_credential: { credential: { credentialData: { age_over_18: true } } } }
  assert.equal(interpretVerification(info).status, 'success')
})
test('rejects a non-empty verifier policy error', () => {
  const info = result(true)
  info.policy_results.errors = [{ message: 'Signature verification failed' }]
  assert.equal(interpretVerification(info).status, 'rejected')
})
test('rejects missing, string, or multiple presented credentials', () => {
  assert.equal(interpretVerification({ status: 'SUCCESS' }).status, 'rejected')
  assert.equal(interpretVerification(result('true')).status, 'rejected')
  const duplicate = result(true)
  duplicate.presented_credentials.age_credential.push({ credentialData: { age_over_18: true } })
  assert.equal(interpretVerification(duplicate).status, 'rejected')
})
test('rejects failed presentations regardless of a claim', () => assert.equal(interpretVerification({ ...result(true), status: 'FAILED' }).status, 'rejected'))
