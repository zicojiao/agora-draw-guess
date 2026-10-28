import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { expect, it, vi } from 'vitest'
import { createRoomWithHost } from './game-server'
import type { DrawGuessEnv } from './worker-env'

it('retries room-number collisions without changing existing rooms or adding stray players', async () => {
  const db = new DatabaseSync(':memory:')
  const originalRandom = crypto.getRandomValues.bind(crypto)
  let candidates = 0
  const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint8Array<ArrayBuffer>) => {
    if (array.length !== 6) return originalRandom(array)
    array.fill(0)
    if (candidates++ === 2) array[0] = 1
    return array
  }) as typeof crypto.getRandomValues)
  try {
    db.exec(readFileSync(new URL('../../../migrations/0001_draw_and_guess.sql', import.meta.url), 'utf8'))
    class Statement {
      constructor(readonly sql: string, readonly values: unknown[] = []) {}
      bind(...values: unknown[]) { return new Statement(this.sql, values) }
    }
    const env = { DB: {
      prepare: (sql: string) => new Statement(sql),
      batch: async (statements: Statement[]) => {
        db.exec('BEGIN')
        try {
          const results = statements.map(s => ({ meta: { changes: Number(db.prepare(s.sql).run(...s.values as never[]).changes) } }))
          db.exec('COMMIT')
          return results
        } catch (error) { db.exec('ROLLBACK'); throw error }
      },
    } } as unknown as DrawGuessEnv
    const first = await createRoomWithHost(env, 'First host')
    const second = await createRoomWithHost(env, 'Second host')
    expect(first.roomId).toBe('100000')
    expect(second.roomId).toBe('200000')
    expect(db.prepare('SELECT host_player_id FROM game_rooms WHERE id = ?').get(first.roomId)).toMatchObject({ host_player_id: first.playerId })
    expect(db.prepare("SELECT nickname FROM game_players WHERE room_id = ? AND role = 'host'").get(first.roomId)).toMatchObject({ nickname: 'First host' })
    expect(db.prepare('SELECT COUNT(*) AS count FROM game_players').get()).toMatchObject({ count: 4 })
    await expect(createRoomWithHost(env, 'No free number')).rejects.toThrow('unused room number')
    expect(db.prepare('SELECT COUNT(*) AS count FROM game_rooms').get()).toMatchObject({ count: 2 })
    expect(db.prepare('SELECT COUNT(*) AS count FROM game_players').get()).toMatchObject({ count: 4 })
  } finally { random.mockRestore(); db.close() }
})
