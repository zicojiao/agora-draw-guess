import { describe, expect, it } from 'vitest'
import { actionTransitionReducer as reduce } from './action-transition'

describe('game action loading transitions', () => {
  it('keeps start pending after acceptance and stale lobby refreshes', () => {
    let state = reduce(null, { type: 'start' })
    state = reduce(state, { type: 'accepted' })
    state = reduce(state, { type: 'room', phase: 'lobby', roundId: null, ready: false })
    expect(state?.kind).toBe('start')
    state = reduce(state, { type: 'room', phase: 'choosing', roundId: 'one', ready: false })
    expect(state?.kind).toBe('start')
    expect(reduce(state, { type: 'room', phase: 'choosing', roundId: 'one', ready: true })).toBeNull()
  })
  it('keeps a selected topic pending until the drawing screen is ready', () => {
    let state = reduce(null, { type: 'choose', word: '灯泡', roundId: 'one' })
    state = reduce(state, { type: 'accepted' })
    state = reduce(state, { type: 'room', phase: 'choosing', roundId: 'one', ready: true })
    expect(state?.word).toBe('灯泡')
    expect(reduce(state, { type: 'choose', word: '桃子', roundId: 'one' })).toEqual(state)
    state = reduce(state, { type: 'room', phase: 'drawing', roundId: 'one', ready: false })
    expect(state?.kind).toBe('choose')
    expect(reduce(state, { type: 'room', phase: 'drawing', roundId: 'one', ready: true })).toBeNull()
  })
  it('allows retry after failure and clears expired round transitions', () => {
    const state = reduce(null, { type: 'choose', word: '桥', roundId: 'one' })
    expect(reduce(state, { type: 'failed' })).toBeNull()
    expect(reduce(state, { type: 'room', phase: 'choosing', roundId: 'two', ready: true })).toBeNull()
    expect(reduce(state, { type: 'room', phase: 'result', roundId: 'one', ready: false })).toBeNull()
  })
})
