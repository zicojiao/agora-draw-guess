import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { expect, it, vi } from 'vitest'
import { advanceGameRoom, createRoomWithHost, pickRoomWords, pickWords, readGameRoom } from './game-server'
import type { DrawGuessEnv } from './worker-env'

it('offers all nine topics before repeating options and never offers drawn topics in five rounds', async () => {
  const db = new DatabaseSync(':memory:')
  const originalRandom = crypto.getRandomValues.bind(crypto)
  const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint8Array<ArrayBuffer> | Uint32Array<ArrayBuffer>) => {
    if (array instanceof Uint32Array) { array.fill(0); return array }
    return originalRandom(array)
  }) as typeof crypto.getRandomValues)
  try {
    db.exec(readFileSync(new URL('../../../migrations/0001_draw_and_guess.sql', import.meta.url), 'utf8'))
    class Statement {
      constructor(readonly sql: string, readonly values: unknown[] = []) {}
      bind(...values: unknown[]) { return new Statement(this.sql, values) }
      async all() { return { results: db.prepare(this.sql).all(...this.values as never[]) } }
      async first<T>() { return (db.prepare(this.sql).get(...this.values as never[]) ?? null) as T | null }
      async run() { return { meta: { changes: Number(db.prepare(this.sql).run(...this.values as never[]).changes) } } }
    }
    const env = { DB: { prepare: (sql: string) => new Statement(sql), batch: (statements: Statement[]) => Promise.all(statements.map(s => s.run())) } } as unknown as DrawGuessEnv
    const { roomId, playerId } = await createRoomWithHost(env, 'Artist')
    const now = Date.now()
    db.prepare("UPDATE game_rooms SET rounds_total=5,phase='choosing',current_round=1,active_round_id='first' WHERE id=?").run(roomId)
    db.prepare("INSERT INTO game_rounds(id,room_id,number,artist_id,phase,secret_word,choices_json,created_at) VALUES('first',?,1,?,'choosing',?,?,?)").run(roomId, playerId, pickWords()[0], JSON.stringify(pickWords()), now)
    const shown = new Map<string, number>()
    const drawn = new Set<string>()
    for (let number = 1; number <= 5; number++) {
      const round = db.prepare('SELECT * FROM game_rounds WHERE room_id=? AND number=?').get(roomId, number)!
      const choices = JSON.parse(round.choices_json as string) as string[]
      expect(choices).toHaveLength(3)
      expect(new Set(choices).size).toBe(3)
      for (const word of choices) {
        expect(drawn.has(word)).toBe(false)
        if (number <= 3) expect(shown.has(word)).toBe(false)
        shown.set(word, (shown.get(word) ?? 0) + 1)
      }
      if (number === 3) expect(shown.size).toBe(9)
      // These rounds time out: drawn topics must stay excluded even without a correct guess.
      drawn.add(choices[0])
      db.prepare("UPDATE game_rounds SET phase='result',secret_word=?,started_at=?,ends_at=?,end_reason='timeout' WHERE id=?").run(choices[0], now, now, round.id as string)
      db.prepare("UPDATE game_rooms SET phase='result' WHERE id=?").run(roomId)
      await advanceGameRoom(env, (await readGameRoom(env, roomId))!, now + number)
    }
    expect(drawn.size).toBe(5)
    expect((await readGameRoom(env, roomId))?.phase).toBe('finished')
    // The restart action clears round history, so a new game can use the full menu again.
    db.prepare('DELETE FROM game_rounds WHERE room_id=?').run(roomId)
    expect(await pickRoomWords(env, roomId)).toEqual(pickWords())
  } finally { random.mockRestore(); db.close() }
})

it('keeps unselected topics eligible and favors the least-seen options', () => {
  const topics = pickWords(9)
  const history = [
    { secret_word: topics[0], choices_json: JSON.stringify(topics), started_at: null },
    { secret_word: topics[0], choices_json: JSON.stringify(topics.slice(0, 3)), started_at: null },
  ]
  expect(pickWords(9, history)).toContain(topics[0])
  expect(pickWords(6, history).sort()).toEqual(topics.slice(3).sort())
})

it('never fills a short menu with previously drawn topics', () => {
  const topics = pickWords(9)
  const history = topics.slice(0, 7).map(word => ({ secret_word: word, choices_json: JSON.stringify([word]), started_at: 0 }))
  expect(pickWords(3, history).sort()).toEqual(topics.slice(7).sort())
})
