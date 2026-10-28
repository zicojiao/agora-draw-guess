import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { createRoomWithHost, readGameSnapshot } from './game-server'
import type { DrawGuessEnv } from './worker-env'

it('reads status, messages and visual evidence from one database snapshot', async () => {
 const db = new DatabaseSync(':memory:')
 try {
  db.exec(readFileSync(new URL('../../../migrations/0001_draw_and_guess.sql', import.meta.url), 'utf8'))
  class Statement {
   constructor(readonly sql:string, readonly values:unknown[]=[]) {}
   bind(...values:unknown[]) { return new Statement(this.sql, values) }
   async run() { return {meta:{changes:Number(db.prepare(this.sql).run(...this.values as never[]).changes)}} }
  }
  const batch=vi.fn(async (statements:Statement[])=>statements.map(s=>s.sql.startsWith('SELECT') ? {results:db.prepare(s.sql).all(...s.values as never[])} : {meta:{changes:Number(db.prepare(s.sql).run(...s.values as never[]).changes)}}))
  const env={DB:{prepare:(sql:string)=>new Statement(sql),batch}} as unknown as DrawGuessEnv
  const {roomId,playerId}=await createRoomWithHost(env,'Artist')
  db.prepare("INSERT INTO game_rounds(id,room_id,number,artist_id,phase,secret_word,choices_json,created_at,winner_type) VALUES('r',?,1,?,'result','太阳','[]',1,'ai')").run(roomId,playerId)
  db.prepare("UPDATE game_rooms SET phase='result',ai_phase='correct',active_round_id='r' WHERE id=?").run(roomId)
  db.prepare("INSERT INTO game_guesses VALUES('guess',?,'r',NULL,'ai','太阳','太阳','correct',2)").run(roomId)
  db.prepare("INSERT INTO ai_attempts(id,room_id,round_id,guess,confidence,phase,created_at,updated_at) VALUES('attempt',?,'r','太阳',1,'correct',1,2)").run(roomId)
  batch.mockClear()
  const snapshot=await readGameSnapshot(env,roomId)
  expect(batch).toHaveBeenCalledOnce()
  expect(snapshot.room).toMatchObject({phase:'result',ai_phase:'correct'})
  expect(snapshot.guesses[0]).toMatchObject({content:'太阳',correctness:'correct'})
  expect(snapshot.aiAttempt).toMatchObject({guess:'太阳',phase:'correct'})
  expect(snapshot.round).toMatchObject({id:'r',winner_type:'ai'})
 } finally {db.close()}
})
