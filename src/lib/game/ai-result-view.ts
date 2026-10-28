import type { AiGuessState } from './ai-guess-queue'
import type { PublicGameRoom } from './model'

/** Success text and its answer always come from the same confirmed round. */
export function aiResultView(room: PublicGameRoom | null, state: AiGuessState) {
  if (!room) return { correct: false, settling: false, activity: undefined }
  const ended = room.phase === 'result' || room.phase === 'finished'
  const correct = ended && room.round?.winnerType === 'ai'
  const settling = room.phase === 'drawing' && state === 'correct'
  if (correct) {
    const winner = room.messages.find(message => message.source === 'ai' && message.correctness === 'correct')
    const attempt = room.aiActivity?.phase === 'correct' ? room.aiActivity : undefined
    const guess = winner?.content || attempt?.guess || room.round?.secretWord
    return { correct, settling: false, activity: guess ? { guess, reason: attempt?.guess === guess ? attempt.reason : '' } : undefined }
  }
  return { correct: false, settling, activity: settling || room.phase === 'choosing' || room.phase === 'lobby' ? undefined : room.aiActivity }
}
