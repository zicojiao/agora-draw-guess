import type { DrawGuessEnv } from './worker-env'

type TopicChoice = { roomId: string; roundId: string; artistId: string; choicesJson: string; word: string; seconds: number }

// Validate the same choice list and artist again at write time, inside the D1 batch.
export async function chooseTopic(env: DrawGuessEnv, choice: TopicChoice, now = Date.now()) {
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE game_rounds SET secret_word = ?, phase = 'drawing', started_at = ?, ends_at = ?, choose_ends_at = NULL
      WHERE id = ? AND artist_id = ? AND choices_json = ? AND phase = 'choosing'
      AND EXISTS (SELECT 1 FROM game_rooms WHERE id = ? AND active_round_id = ? AND phase = 'choosing')`)
      .bind(choice.word, now, now + choice.seconds * 1000, choice.roundId, choice.artistId, choice.choicesJson, choice.roomId, choice.roundId),
    env.DB.prepare(`UPDATE game_rooms SET phase = 'drawing', ai_phase = CASE ai_enabled WHEN 1 THEN 'watching' ELSE 'idle' END
      WHERE id = ? AND active_round_id = ? AND phase = 'choosing'
      AND EXISTS (SELECT 1 FROM game_rounds WHERE id = ? AND phase = 'drawing')`)
      .bind(choice.roomId, choice.roundId, choice.roundId),
  ])
  return results[0].meta.changes === 1
}
