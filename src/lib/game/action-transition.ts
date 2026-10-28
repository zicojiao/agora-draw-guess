import type { PublicGameRoom } from './model'

export type ActionTransition = { kind: 'start' | 'choose'; word?: string; roundId?: string } | null
export type TransitionEvent =
  | { type: 'start' }
  | { type: 'choose'; word: string; roundId: string }
  | { type: 'accepted' }
  | { type: 'failed' }
  | { type: 'room'; phase: PublicGameRoom['phase']; roundId: string | null; ready: boolean }

// A successful POST does not mean the updated room and canvas are visible yet.
export function actionTransitionReducer(state: ActionTransition, event: TransitionEvent): ActionTransition {
  if (event.type === 'failed') return null
  if (event.type === 'accepted') return state
  if (event.type === 'start') return state ?? { kind: 'start' }
  if (event.type === 'choose') return state ?? { kind: 'choose', word: event.word, roundId: event.roundId }
  if (!state) return null
  if (event.phase === 'result' || event.phase === 'finished') return null
  if (state.kind === 'start') return event.phase !== 'lobby' && event.ready ? null : state
  if (event.roundId !== state.roundId || event.phase === 'lobby') return null
  return event.phase === 'drawing' && event.ready ? null : state
}
