import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { reconcileGameRoom, type GameRoomRow } from './game-server'
import type { DrawGuessEnv } from './worker-env'

it('keeps solo topic choices stable when the selection deadline passes', async () => {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync('migrations/0001_draw_and_guess.sql', 'utf8'))
  db.exec(`INSERT INTO game_rooms(id,host_player_id,phase,ai_enabled,ai_phase,active_round_id,created_at,expires_at) VALUES('room','artist','choosing',1,'watching','turn',0,999999);
    INSERT INTO game_players(id,room_id,nickname,role,rtc_uid,seat_token_hash,joined_at,last_seen_at) VALUES('artist','room','Artist','host','1','hash',0,100000);
    INSERT INTO game_rounds(id,room_id,number,artist_id,phase,secret_word,choices_json,created_at,choose_ends_at) VALUES('turn','room',1,'artist','choosing','桃子','["桃子","桥","太阳"]',0,1000);`)
  class Statement {
    params: unknown[] = []
    constructor(readonly sql: string) {}
    bind(...params: unknown[]) { this.params=params; return this }
    async run() { return {meta:{changes:Number(db.prepare(this.sql).run(...this.params as never[]).changes)}} }
    async all() { return {results:db.prepare(this.sql).all(...this.params as never[])} }
    async first() { return db.prepare(this.sql).get(...this.params as never[]) ?? null }
  }
  const DB={prepare:(sql:string)=>new Statement(sql),batch:async(statements:Statement[])=>Promise.all(statements.map(s=>s.run()))}
  const room=db.prepare('SELECT * FROM game_rooms').get() as unknown as GameRoomRow
  await reconcileGameRoom({DB} as unknown as DrawGuessEnv,room,100000)
  expect(db.prepare('SELECT artist_id,choices_json,secret_word FROM game_rounds').get()).toEqual({artist_id:'artist',choices_json:'["桃子","桥","太阳"]',secret_word:'桃子'})
  db.close()
})
