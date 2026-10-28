import { createFileRoute } from '@tanstack/react-router'
import { matchesRequestedRound } from '#/lib/game/round-request'
import { normalizeGuess } from '#/lib/game/model'
import { readGamePlayer, readGameRoom, reconcileGameRoom } from '#/lib/server/game-server'
import { settleAiGuess } from '#/lib/server/ai-settlement'
import { json } from '#/lib/server/http'
import { guessDrawing, isSafeDataImage, VisionProviderError } from '#/lib/server/openai-vision'
import { withPrimaryD1Session, workerEnv as baseWorkerEnv } from '#/lib/server/worker-env'
export const Route = createFileRoute('/api/game/rooms/$roomId/ai-guess')({
 server:{handlers:{POST:async({request,params})=>{
  const env=withPrimaryD1Session(baseWorkerEnv)
  let claimedRound:string|null=null
  try {
   const body=await request.json() as {seatToken?:unknown;roundId?:unknown;visionImage?:unknown}
   let [room,player]=await Promise.all([readGameRoom(env,params.roomId),readGamePlayer(env,params.roomId,body.seatToken)])
   if(!room||!player||player.left_at!=null)return json({error:'你的房间席位已失效，请重新加入。'},{status:401})
   await env.DB.prepare('UPDATE game_players SET connected=1,last_seen_at=? WHERE id=? AND left_at IS NULL').bind(Date.now(),player.id).run()
   room=await reconcileGameRoom(env,room)
   if(!matchesRequestedRound(body.roundId,room.active_round_id)||!room.ai_enabled||room.phase!=='drawing'||!room.active_round_id)return json({code:'ROUND_CLOSED'},{status:409})
   if(room.waiting_for_players_since)return json({error:'AI 正在等待作画。'},{status:409})
   // Read the frame, round and history in one database round trip.
   const [roundRows,drawingRows,earlier]=await env.DB.batch([
    env.DB.prepare('SELECT * FROM game_rounds WHERE id=?').bind(room.active_round_id),
    env.DB.prepare('SELECT image FROM game_drawings WHERE room_id=? AND round_id=?').bind(room.id,room.active_round_id),
    env.DB.prepare("SELECT content FROM game_guesses WHERE round_id=? AND source='ai' ORDER BY created_at DESC LIMIT 8").bind(room.active_round_id),
   ])
   const round=roundRows.results?.[0] as {id:string;artist_id:string;secret_word:string;started_at:number;ends_at:number;winner_id:string|null}|undefined
   if(!round||round.artist_id!==player.id)return json({error:'只有当前画家可以向 AI 分享画面。'},{status:403})
   if(round.winner_id||Date.now()>round.ends_at)return json({code:'ROUND_CLOSED'},{status:409})
   // The client crop is made from an acknowledged upload; older clients use the saved full image.
   const drawing=drawingRows.results?.[0] as {image:string}|undefined
   if(!drawing)return json({error:'画面正在同步，请稍后重试。'},{status:409})
   const claimed=await env.DB.prepare("UPDATE game_rooms SET ai_phase='thinking' WHERE id=? AND ai_phase='watching' AND active_round_id=? AND phase='drawing'").bind(room.id,round.id).run()
   if(claimed.meta.changes!==1)return json({error:'AI 正在观察上一张画面。'},{status:409})
   claimedRound=round.id
   const began=Date.now()
   const decision=await guessDrawing(env,isSafeDataImage(body.visionImage)?body.visionImage:drawing.image,((earlier.results??[]) as {content:string}[]).reverse().map(g=>g.content))
   const now=Date.now(),visionMs=now-began
   // Provider reply can arrive after a human win, a pause or a host/round change.
   const active=await readGameRoom(env,room.id)
   if(!active||active.phase!=='drawing'||active.active_round_id!==round.id||active.waiting_for_players_since)return json({stale:true})
   const guessId=crypto.randomUUID(), attemptId=crypto.randomUUID()
   const evidence=(won:boolean)=>[
    env.DB.prepare("INSERT INTO game_guesses(id,room_id,round_id,player_id,source,content,normalized,correctness,created_at) VALUES(?,?,?,NULL,'ai',?,?,?,?)").bind(guessId,room.id,round.id,decision.guess,normalizeGuess(decision.guess),won?'correct':'wrong',now),
    env.DB.prepare('INSERT INTO ai_attempts(id,room_id,round_id,guess,reason,confidence,phase,vision_ms,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(attemptId,room.id,round.id,decision.guess,decision.reason,decision.confidence,won?'correct':'wrong',visionMs,began,now),
   ]
   // Publish the winning guess, explanation, scores and room status in one transaction.
   const won=await settleAiGuess(env,{roomId:room.id,roundId:round.id,artistId:round.artist_id,answer:round.secret_word,startedAt:round.started_at,endsAt:round.ends_at},decision.guess,now,evidence(true))
   if(!won)await env.DB.batch(evidence(false))
   return json({guess:decision,won,visionMs})
  } catch(error) {
   console.error('AI visual guess failed',error instanceof VisionProviderError?`provider status ${error.status}`:'request failed')
   return json({error:error instanceof VisionProviderError&&error.status===429?'AI 视觉服务额度暂时不足，请稍后重试。':'AI 暂时无法识别画面，其他玩家可以继续猜。'},{status:503})
  } finally {
   if(claimedRound)await env.DB.prepare("UPDATE game_rooms SET ai_phase='watching' WHERE id=? AND active_round_id=? AND phase='drawing' AND ai_phase='thinking'").bind(params.roomId,claimedRound).run().catch(()=>undefined)
  }
 }}}})
