import { expect, it } from 'vitest'
import { matchesRequestedRound } from './round-request'
it('rejects requests from another round and malformed IDs', () => {
  expect(matchesRequestedRound('old', 'new')).toBe(false)
  expect(matchesRequestedRound(null, 'new')).toBe(false)
  expect(matchesRequestedRound({}, 'new')).toBe(false)
  expect(matchesRequestedRound('new', 'new')).toBe(true)
  expect(matchesRequestedRound(undefined, 'new')).toBe(true)
})
