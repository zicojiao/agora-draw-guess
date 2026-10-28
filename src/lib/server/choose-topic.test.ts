import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { chooseTopic } from './choose-topic'
import type { DrawGuessEnv } from './worker-env'

function fixture() {
 const db = new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE game_rooms(id TEXT,active_round_id TEXT,phase TEXT,ai_phase TEXT,ai_enabled INTEGER);
 CREATE TABLE game_rounds(id TEXT,artist_id TEXT,choices_json TEXT,secret_word TEXT,phase TEXT,started_at INTEGER,ends_at INTEGER,choose_ends_at INTEGER);
 INSERT INTO game_rooms VALUES('room','turn','choosing','watching',1);
 INSERT INTO game_rounds VALUES('turn','artist','["桃子","桥"]',NULL,'choosing',NULL,NULL,20000);`)
 const DB = { prepare(sql: string) {return {bind(...params: unknown[]) {return {async run() {const result=db.prepare(sql).run(...params as never[]);return {meta:{changes:Number(result.changes)}}}}}}}, async batch(statements: {run:()=>Promise<unknown>}[]) {const results=[];for(const statement of statements)results.push(await statement.run());return results} }
 return {db,env:{DB} as unknown as DrawGuessEnv,choice:{roomId:'room',roundId:'turn',artistId:'artist',choicesJson:'["桃子","桥"]',word:'桃子',seconds:60}}
}
describe('topic selection concurrency', () => {
 it('starts once and cannot overwrite an already selected topic', async () => {
  const {db,env,choice}=fixture()
  expect(await chooseTopic(env,choice,1000)).toBe(true)
  expect(await chooseTopic(env,{...choice,word:'桥'},2000)).toBe(false)
  expect(db.prepare('SELECT secret_word,started_at FROM game_rounds').get()).toMatchObject({secret_word:'桃子',started_at:1000})
  expect(db.prepare('SELECT phase FROM game_rooms').get()).toMatchObject({phase:'drawing'})
 })
 it.each([
  "UPDATE game_rooms SET active_round_id='next'",
  "UPDATE game_rooms SET phase='result'",
  "UPDATE game_rounds SET choices_json='[\"太阳\",\"桥\"]'",
  "UPDATE game_rounds SET artist_id='another'",
 ])('rejects a stale choice when state changes: %s', async sql => {
  const {db,env,choice}=fixture();db.exec(sql)
  expect(await chooseTopic(env,choice,1000)).toBe(false)
  expect(db.prepare('SELECT secret_word FROM game_rounds').get()).toMatchObject({secret_word:null})
 })
})
