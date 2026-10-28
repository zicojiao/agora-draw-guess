import { createFileRoute } from '@tanstack/react-router'
import { readGamePlayer, readGameRoom } from '#/lib/server/game-server'
import { workerEnv } from '#/lib/server/worker-env'
import { isSafeDataImage } from '#/lib/server/openai-vision'
import { json } from '#/lib/server/http'
export const Route = createFileRoute('/api/game/rooms/$roomId/drawing')({server:{handlers:{
 GET:async({request,params})=>{
  const player=await readGamePlayer(workerEnv,params.roomId,request.headers.get('x-game-seat'))
  if(!player||player.left_at!=null)return json({error:'请先加入房间。'},{status:401})
  const room=await readGameRoom(workerEnv,params.roomId)
  if(!room)return json({error:'房间不存在。'},{status:404})
  const version=await workerEnv.DB.prepare('SELECT round_id,updated_at FROM game_drawings WHERE room_id=? AND round_id=?').bind(room.id,room.active_round_id).first<{round_id:string;updated_at:number}>()
  if(version && new URL(request.url).searchParams.get('since') === `${version.round_id}:${version.updated_at}`) return new Response(null,{status:204,headers:{'cache-control':'no-store'}})
  const drawing=version ? await workerEnv.DB.prepare('SELECT round_id,image,updated_at FROM game_drawings WHERE room_id=? AND round_id=?').bind(room.id,room.active_round_id).first() : null
  return json({drawing})
 },
 POST:async({request,params})=>{
  const body=await request.json() as {seatToken?:unknown;roundId?:unknown;image?:unknown}
  const [player,room]=await Promise.all([readGamePlayer(workerEnv,params.roomId,body.seatToken),readGameRoom(workerEnv,params.roomId)])
  if(!player||player.left_at!=null||!room)return json({error:'你的房间席位已失效。'},{status:401})
  const round=await workerEnv.DB.prepare('SELECT artist_id,ends_at FROM game_rounds WHERE id=?').bind(room.active_round_id).first<{artist_id:string;ends_at:number}>()
  if(!round||room.phase!=='drawing'||room.active_round_id!==body.roundId||Date.now()>round.ends_at)return json({code:'DRAWING_CLOSED',error:'本轮作画已结束。'},{status:409})
  if(round.artist_id!==player.id)return json({error:'只有当前画家可以上传画面。'},{status:403})
  if(!isSafeDataImage(body.image))return json({error:'画面格式无效。'},{status:400})
  await workerEnv.DB.prepare('INSERT INTO game_drawings(room_id,round_id,image,updated_at) VALUES(?,?,?,?) ON CONFLICT(room_id) DO UPDATE SET round_id=excluded.round_id,image=excluded.image,updated_at=excluded.updated_at').bind(room.id,body.roundId,body.image,Date.now()).run()
  return json({ok:true})
 }
}}})
