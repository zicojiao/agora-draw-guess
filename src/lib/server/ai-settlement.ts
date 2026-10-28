import { artistAssistScore, guesserScore, isCorrectGuess, progressiveHintIndexes } from '../game/model'
import type { DrawGuessEnv } from './worker-env'
type AiRound = { roomId:string; roundId:string; artistId:string; answer:string; startedAt:number; endsAt:number }
export async function settleAiGuess(env:DrawGuessEnv, round:AiRound, guess:string, now=Date.now(), evidence: D1PreparedStatement[] = []) {
 if (!isCorrectGuess(guess,round.answer) || now>round.endsAt) return false
 const claimed=await env.DB.prepare(`UPDATE game_rounds SET winner_type='ai',winner_id='ai',phase='result',end_reason='ai_correct_guess',result_at=?
 WHERE id=? AND room_id=? AND phase='drawing' AND winner_id IS NULL AND ends_at>=?
 AND EXISTS(SELECT 1 FROM game_rooms WHERE id=? AND active_round_id=? AND phase='drawing')`)
 .bind(now,round.roundId,round.roomId,now,round.roomId,round.roundId).run()
 if (claimed.meta.changes!==1) return false
 const score=guesserScore(now,round.startedAt,round.endsAt,progressiveHintIndexes(round.answer,round.startedAt,round.endsAt,now).size)
 await env.DB.batch([
  ...evidence,
  env.DB.prepare("UPDATE game_players SET score=score+? WHERE room_id=? AND role='ai'").bind(score,round.roomId),
  env.DB.prepare('UPDATE game_players SET score=score+? WHERE id=? AND room_id=?').bind(artistAssistScore(score),round.artistId,round.roomId),
  env.DB.prepare("UPDATE game_rooms SET phase='result',ai_phase='correct' WHERE id=? AND active_round_id=?").bind(round.roomId,round.roundId),
 ])
 return true
}
