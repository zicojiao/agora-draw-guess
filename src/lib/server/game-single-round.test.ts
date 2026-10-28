import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { gameStartGate } from '../game/model'
import { advanceGameRoom, createRoomWithHost, readGameRoom, reconcileGameRoom } from './game-server'
import { settleAiGuess } from './ai-settlement'
import type { DrawGuessEnv } from './worker-env'

describe('single-round solo game', () => {
  it('lets one artist play with the default AI and finishes after their first result', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      db.exec(readFileSync(new URL('../../../migrations/0001_draw_and_guess.sql', import.meta.url), 'utf8'))
      class Statement {
        constructor(readonly sql: string, readonly values: unknown[] = []) {}
        bind(...values: unknown[]) { return new Statement(this.sql, values) }
        async all() { return { results: db.prepare(this.sql).all(...this.values as never[]) } }
        async first<T>() { return (db.prepare(this.sql).get(...this.values as never[]) ?? null) as T | null }
        async run() { return { meta: { changes: Number(db.prepare(this.sql).run(...this.values as never[]).changes) } } }
      }
      const env = { DB: { prepare: (sql: string) => new Statement(sql), batch: (statements: Statement[]) => Promise.all(statements.map(statement => statement.run())) } } as unknown as DrawGuessEnv
      const { roomId, playerId } = await createRoomWithHost(env, 'Solo artist')
      const players = db.prepare('SELECT id, role, connected FROM game_players WHERE room_id = ?').all(roomId) as Array<{ id: string; role: 'host' | 'ai'; connected: number }>
      expect(players.filter(player => player.role !== 'ai')).toHaveLength(1)
      expect(gameStartGate(players.map(player => ({ ...player, connected: Boolean(player.connected) })), playerId, true)).toBe('ready')

      const now = Date.now()
      db.prepare("UPDATE game_rooms SET rounds_total = 1, current_round = 1, phase = 'drawing', active_round_id = 'solo-round' WHERE id = ?").run(roomId)
      db.prepare("INSERT INTO game_rounds (id,room_id,number,artist_id,phase,secret_word,choices_json,started_at,ends_at,created_at) VALUES ('solo-round',?,1,?,'drawing','太阳','[\"太阳\"]',?,?,?)").run(roomId, playerId, now, now + 60_000, now)
      const drawing = (await reconcileGameRoom(env, (await readGameRoom(env, roomId))!, now))!
      expect(drawing.phase).toBe('drawing')
      expect(drawing.waiting_for_players_since).toBeNull()
      expect(await settleAiGuess(env, { roomId, roundId: 'solo-round', artistId: playerId, answer: '太阳', startedAt: now, endsAt: now + 60_000 }, '太阳', now + 1000)).toBe(true)
      const result = (await readGameRoom(env, roomId))!
      expect(result.phase).toBe('result')
      const finished = await advanceGameRoom(env, result, now + 2000)
      expect(finished.phase).toBe('finished')
      expect(finished.current_round).toBe(1)
      expect(finished.active_round_id).toBeNull()
      expect(db.prepare('SELECT COUNT(*) AS count FROM game_rounds WHERE room_id = ?').get(roomId)).toMatchObject({ count: 1 })
      expect(db.prepare('SELECT score FROM game_players WHERE room_id = ?').all(roomId).every(player => Number(player.score) > 0)).toBe(true)
    } finally { db.close() }
  })
})
