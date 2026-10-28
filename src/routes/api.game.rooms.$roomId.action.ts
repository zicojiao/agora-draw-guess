import { matchesRequestedRound } from '#/lib/game/round-request'
import { chooseTopic } from '#/lib/server/choose-topic'
import { createFileRoute } from '@tanstack/react-router'
import { artistAssistScore, guesserScore, isCloseGuess, isCorrectGuess, MIN_GAME_HUMANS, normalizeGuess, progressiveHintIndexes } from '#/lib/game/model'
import { GAME_CHOICE_SECONDS, GAME_DISCONNECT_GRACE_MS } from '#/lib/game/lifecycle'
import { advanceGameRoom, ensureAiPlayer, pickRoomWords, readGamePlayer, readGameRoom, reconcileGameRoom } from '#/lib/server/game-server'
import { cleanText, json } from '#/lib/server/http'
import { withPrimaryD1Session, workerEnv as baseWorkerEnv } from '#/lib/server/worker-env'

export const Route = createFileRoute('/api/game/rooms/$roomId/action')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const workerEnv = withPrimaryD1Session(baseWorkerEnv)
        try {
          const body = await request.json() as { seatToken?: unknown; action?: unknown; value?: unknown; roundId?: unknown }
          let [room, player] = await Promise.all([
            readGameRoom(workerEnv, params.roomId),
            readGamePlayer(workerEnv, params.roomId, body.seatToken),
          ])
          if (!room || !player) return json({ error: '你的席位已失效，请重新加入。' }, { status: 401 })
          if (player.left_at != null) return json({ error: '你已离开房间，请重新加入。' }, { status: 409 })
          const now = Date.now()
          await workerEnv.DB.prepare('UPDATE game_players SET connected = 1, last_seen_at = ? WHERE id = ? AND left_at IS NULL')
            .bind(now, player.id).run()
          player = { ...player, connected: 1, last_seen_at: now }
          room = await reconcileGameRoom(workerEnv, room, now)
          const isHost = room.host_player_id === player.id
          const action = typeof body.action === 'string' ? body.action : ''
          let restartNeedsPlayer: boolean | undefined

          if (action === 'toggle-ready') {
            await workerEnv.DB.prepare('UPDATE game_players SET ready = CASE ready WHEN 1 THEN 0 ELSE 1 END WHERE id = ? AND role != ?')
              .bind(player.id, 'ai').run()
          } else if (action === 'invite-ai' || action === 'remove-ai') {
            if (!isHost || room.phase !== 'lobby') return json({ error: '只有房主可以在开始前邀请 AI。' }, { status: 403 })
            if (action === 'invite-ai') {
              await ensureAiPlayer(workerEnv, room, now)
            } else if (action === 'remove-ai') {
              await workerEnv.DB.batch([
                workerEnv.DB.prepare(`DELETE FROM game_players WHERE room_id = ? AND role = 'ai'`).bind(room.id),
                workerEnv.DB.prepare(`UPDATE game_rooms SET ai_enabled = 0, ai_phase = 'idle' WHERE id = ?`).bind(room.id),
              ])
            }
          } else if (action === 'settings') {
            if (!isHost || room.phase !== 'lobby') return json({ error: '只有房主可以在开始前修改设置。' }, { status: 403 })
            let settings: { rounds?: unknown; seconds?: unknown }
            try { settings = JSON.parse(typeof body.value === 'string' ? body.value : '{}') as typeof settings } catch { return json({ error: '房间设置无效。' }, { status: 400 }) }
            const rounds = Number(settings.rounds)
            const seconds = Number(settings.seconds)
            if (![1, 3, 5].includes(rounds) || ![45, 60, 90].includes(seconds)) return json({ error: '请选择支持的轮数和时间。' }, { status: 400 })
            await workerEnv.DB.prepare('UPDATE game_rooms SET rounds_total = ?, turn_seconds = ? WHERE id = ?').bind(rounds, seconds, room.id).run()
          } else if (action === 'restart') {
            if (!isHost || room.phase !== 'finished') return json({ error: '只有房主可以重新开局。' }, { status: 403 })
            const onlineHumans = await workerEnv.DB.prepare(`SELECT COUNT(*) AS count FROM game_players WHERE room_id = ? AND role != 'ai' AND left_at IS NULL AND (last_seen_at >= ? OR id = ?)`)
              .bind(room.id, now - GAME_DISCONNECT_GRACE_MS, player.id).first<{ count: number }>()
            restartNeedsPlayer = (onlineHumans?.count ?? 0) < (room.ai_enabled ? 1 : MIN_GAME_HUMANS)
            await workerEnv.DB.batch([
              workerEnv.DB.prepare('DELETE FROM game_rounds WHERE room_id = ?').bind(room.id),
              workerEnv.DB.prepare(`DELETE FROM game_players WHERE room_id = ? AND role != 'ai' AND left_at IS NOT NULL`).bind(room.id),
              workerEnv.DB.prepare(`UPDATE game_players SET score = 0, ready = CASE role WHEN 'ai' THEN 1 ELSE 0 END WHERE room_id = ?`).bind(room.id),
              workerEnv.DB.prepare(`UPDATE game_rooms SET phase = 'lobby', current_round = 0, active_round_id = NULL, waiting_for_players_since = NULL, ai_phase = CASE ai_enabled WHEN 1 THEN 'watching' ELSE 'idle' END WHERE id = ?`).bind(room.id),
            ])
          } else if (action === 'start') {
            if (!isHost || room.phase !== 'lobby') return json({ error: '只有房主可以开始游戏。' }, { status: 403 })
            const humans = await workerEnv.DB.prepare(`SELECT id FROM game_players WHERE room_id = ? AND role != 'ai' AND left_at IS NULL AND last_seen_at >= ? ORDER BY joined_at`)
              .bind(room.id, now - GAME_DISCONNECT_GRACE_MS).all<{ id: string }>()
            const humanIds = (humans.results ?? []).map(({ id }) => id)
            if (humanIds.length < (room.ai_enabled ? 1 : MIN_GAME_HUMANS)) return json({ error: '请再邀请一位在线玩家后开始。' }, { status: 409 })
            const choices = await pickRoomWords(workerEnv, room.id)
            const roundId = crypto.randomUUID().replaceAll('-', '')
            await workerEnv.DB.batch([
              workerEnv.DB.prepare(`INSERT INTO game_rounds
                (id, room_id, number, artist_id, phase, secret_word, choices_json, choose_ends_at, created_at)
                VALUES (?, ?, 1, ?, 'choosing', ?, ?, ?, ?)`)
                .bind(roundId, room.id, humanIds[0], choices[0], JSON.stringify(choices), now + GAME_CHOICE_SECONDS * 1000, now),
              workerEnv.DB.prepare(`UPDATE game_rooms SET phase = 'choosing', current_round = 1, active_round_id = ?, ai_phase = CASE ai_enabled WHEN 1 THEN 'watching' ELSE 'idle' END WHERE id = ?`)
                .bind(roundId, room.id),
            ])
          } else if (action === 'choose-word') {
            if (!room.active_round_id || !matchesRequestedRound(body.roundId, room.active_round_id) || room.phase !== 'choosing') return json({ code: 'TOPIC_CHOICES_CHANGED' }, { status: 409 })
            const round = await workerEnv.DB.prepare('SELECT * FROM game_rounds WHERE id = ?').bind(room.active_round_id)
              .first<{ artist_id: string; phase: string; choices_json: string }>()
            if (!round || round.phase !== 'choosing') return json({ code: 'TOPIC_CHOICES_CHANGED' }, { status: 409 })
            if (round.artist_id !== player.id) return json({ error: '只有当前画家可以选题。' }, { status: 403 })
            const choices = JSON.parse(round.choices_json) as string[]
            const choice = cleanText(body.value, 40)
            if (!choices.includes(choice)) return json({ code: 'TOPIC_CHOICES_CHANGED' }, { status: 409 })
            const chosen = await chooseTopic(workerEnv, { roomId: room.id, roundId: room.active_round_id, artistId: player.id, choicesJson: round.choices_json, word: choice, seconds: room.turn_seconds }, now)
            if (!chosen) return json({ code: 'TOPIC_CHOICES_CHANGED' }, { status: 409 })
          } else if (action === 'guess') {
            if (!room.active_round_id || room.phase !== 'drawing') return json({ error: '请等待本轮开始作画。' }, { status: 409 })
            const round = await workerEnv.DB.prepare('SELECT * FROM game_rounds WHERE id = ?').bind(room.active_round_id)
              .first<{ artist_id: string; secret_word: string; started_at: number; ends_at: number; winner_id: string | null; revealed_json: string }>()
            if (!round || round.artist_id === player.id) return json({ error: '画家不能猜自己的题目。' }, { status: 403 })
            const guess = cleanText(body.value, 80)
            if (!guess) return json({ error: '请输入你的答案。' }, { status: 400 })
            const correctness = isCorrectGuess(guess, round.secret_word) ? 'correct' : isCloseGuess(guess, round.secret_word) ? 'close' : 'wrong'
            const guessId = crypto.randomUUID().replaceAll('-', '')
            await workerEnv.DB.prepare(`INSERT INTO game_guesses
              (id, room_id, round_id, player_id, source, content, normalized, correctness, created_at)
              VALUES (?, ?, ?, ?, 'human', ?, ?, ?, ?)`)
              .bind(guessId, room.id, room.active_round_id, player.id, guess, normalizeGuess(guess), correctness, now).run()
            if (correctness === 'correct' && now <= round.ends_at && !round.winner_id) {
              const hintsShown = progressiveHintIndexes(round.secret_word, round.started_at, round.ends_at, now).size
              const score = guesserScore(now, round.started_at, round.ends_at, hintsShown)
              const settled = await workerEnv.DB.prepare(`UPDATE game_rounds SET winner_type = 'human', winner_id = ?, phase = 'result', end_reason = 'correct_guess', result_at = ?
                WHERE id = ? AND winner_id IS NULL AND ends_at >= ?`).bind(player.id, now, room.active_round_id, now).run()
              if (settled.meta.changes === 1) {
                await workerEnv.DB.batch([
                  workerEnv.DB.prepare('UPDATE game_players SET score = score + ? WHERE id = ? AND room_id = ?').bind(score, player.id, room.id),
                  workerEnv.DB.prepare('UPDATE game_players SET score = score + ? WHERE id = ? AND room_id = ?').bind(artistAssistScore(score), round.artist_id, room.id),
                  workerEnv.DB.prepare(`UPDATE game_rooms SET phase = 'result' WHERE id = ?`).bind(room.id),
                ])
              }
            }
          } else if (action === 'next-turn') {
            if (!isHost) return json({ error: '只有房主可以切换下一轮。' }, { status: 403 })
            if (room.phase !== 'result' || !matchesRequestedRound(body.roundId, room.active_round_id)) return json({ ok: true })
            const advanced = await advanceGameRoom(workerEnv, room, now)
            if (advanced.phase === 'result') return json({ error: '正在等待伙伴重新连接。' }, { status: 409 })
          } else {
            return json({ error: '不支持此操作。' }, { status: 400 })
          }

          return json({ ok: true, ...(restartNeedsPlayer === undefined ? {} : { needsPlayer: restartNeedsPlayer }) })
        } catch (error) {
          console.error('Draw & Guess action failed', error)
          return json({ error: '操作未完成，请稍后重试。' }, { status: 503 })
        }
      },
    },
  },
})
