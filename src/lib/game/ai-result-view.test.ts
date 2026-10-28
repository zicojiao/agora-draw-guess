import { describe, expect, it } from 'vitest'
import { aiResultView } from './ai-result-view'
import type { PublicGameRoom } from './model'
const unknown = { attemptId: 'old', guess: '未知', reason: '只有一条线', phase: 'wrong' as const, confidence: 0, visionMs: 1, startedAt: 1, updatedAt: 2 }
const drawing = { phase: 'drawing', aiPhase: 'watching', aiActivity: unknown, messages: [], round: { winnerType: null, secretWord: '西瓜' } } as unknown as PublicGameRoom

describe('coherent AI result presentation', () => {
  it('hides an earlier unknown answer while a winning response waits for room refresh', () => {
    expect(aiResultView(drawing, 'correct')).toMatchObject({ correct: false, settling: true, activity: undefined })
  })
  it('never pairs an authoritative win with an old unknown attempt', () => {
    const room = { ...drawing, phase: 'result', aiPhase: 'correct', round: { ...drawing.round!, winnerType: 'ai' } } as PublicGameRoom
    expect(aiResultView(room, 'idle')).toMatchObject({ correct: true, settling: false, activity: { guess: '西瓜', reason: '' } })
  })
  it('preserves the actual winning explanation when the matching attempt arrives', () => {
    const room = { ...drawing, phase: 'result', aiActivity: { ...unknown, guess: '西瓜', reason: '红色果肉和黑色瓜籽', phase: 'correct' }, round: { ...drawing.round!, winnerType: 'ai' } } as PublicGameRoom
    expect(aiResultView(room, 'idle').activity?.reason).toBe('红色果肉和黑色瓜籽')
  })
  it('does not reuse a previous round success while choosing a new topic', () => {
    expect(aiResultView({ ...drawing, phase: 'choosing', aiPhase: 'correct' }, 'correct')).toMatchObject({ correct: false, settling: false, activity: undefined })
  })
  it('does not claim an AI win when a human won', () => {
    expect(aiResultView({ ...drawing, phase: 'result', round: { ...drawing.round!, winnerType: 'human' } }, 'correct').correct).toBe(false)
  })
})
