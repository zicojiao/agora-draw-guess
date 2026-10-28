import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { settleAiGuess } from './ai-settlement'
import type { DrawGuessEnv } from './worker-env'
function fixture() {
 const db = new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE game_rounds(id TEXT,room_id TEXT,phase TEXT,winner_id TEXT,winner_type TEXT,end_reason TEXT,result_at INTEGER,started_at INTEGER,ends_at INTEGER); CREATE TABLE game_rooms(id TEXT,active_round_id TEXT,phase TEXT,ai_phase TEXT); CREATE TABLE game_players(id TEXT,room_id TEXT,role TEXT,score INTEGER); INSERT INTO game_rounds VALUES('turn','room','drawing',NULL,NULL,NULL,NULL,1000,61000); INSERT INTO game_rooms VALUES('room','turn','drawing','thinking'); INSERT INTO game_players VALUES('artist','room','host',0),('bot','room','ai',0);`)
 const DB = {prepare(sql:string) {return {bind(...params:unknown[]) {return {async run() {const r=db.prepare(sql).run(...params as never[]);return {meta:{changes:Number(r.changes)}}}}}}},async batch(statements:{run:()=>Promise<unknown>}[]) {return Promise.all(statements.map(s=>s.run()))}}
 return {db,env:{DB} as unknown as DrawGuessEnv}
}
describe('AI visual scoring',()=>{
 it('publishes winning evidence in the same batch as the correct room status',async()=>{
  const {env,db}=fixture()
  db.exec('CREATE TABLE evidence(guess TEXT)')
  const evidence=env.DB.prepare('INSERT INTO evidence VALUES(?)').bind('西瓜')
  const batch=env.DB.batch.bind(env.DB)
  let publishedWithoutEvidence=false
  env.DB.batch=async<T>(statements:D1PreparedStatement[])=>{
   const result=await batch<T>(statements)
   if((db.prepare('SELECT ai_phase FROM game_rooms').get() as {ai_phase:string}).ai_phase==='correct' && !db.prepare('SELECT * FROM evidence').get())publishedWithoutEvidence=true
   return result
  }
  await settleAiGuess(env,{roomId:'room',roundId:'turn',artistId:'artist',answer:'西瓜',startedAt:1000,endsAt:61000},'西瓜',2000,[evidence])
  expect(publishedWithoutEvidence).toBe(false)
  expect(db.prepare('SELECT * FROM evidence').get()).toMatchObject({guess:'西瓜'})
 })
 it('awards AI and artist points from a correct image guess',async()=>{
  const {env,db}=fixture()
  expect(await settleAiGuess(env,{roomId:'room',roundId:'turn',artistId:'artist',answer:'太阳',startedAt:1000,endsAt:61000},'太阳',2000)).toBe(true)
  expect(db.prepare('SELECT winner_type FROM game_rounds').get()).toMatchObject({winner_type:'ai'})
  expect((db.prepare("SELECT score FROM game_players WHERE role='ai'").get() as {score:number}).score).toBeGreaterThan(0)
  expect(await settleAiGuess(env,{roomId:'room',roundId:'turn',artistId:'artist',answer:'太阳',startedAt:1000,endsAt:61000},'太阳',2100)).toBe(false)
 })
 it('never steals a human win or settles a late vision reply',async()=>{
  const {env,db}=fixture()
  const round={roomId:'room',roundId:'turn',artistId:'artist',answer:'太阳',startedAt:1000,endsAt:61000}
  expect(await settleAiGuess(env,round,'太阳',62000)).toBe(false)
  expect(await settleAiGuess(env,round,'苹果',2000)).toBe(false)
  db.exec("UPDATE game_rounds SET winner_id='human',winner_type='human',phase='result'")
  expect(await settleAiGuess(env,round,'太阳',2000)).toBe(false)
  expect(db.prepare('SELECT winner_type FROM game_rounds').get()).toMatchObject({winner_type:'human'})
 })
})
