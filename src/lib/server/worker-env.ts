import { GameDatabase } from './database'
export type DrawGuessEnv = {
 DB: Pick<D1Database, 'prepare'|'batch'>
 AGORA_APP_ID: string
 AGORA_APP_CERTIFICATE: string
 AGORA_WHITEBOARD_APP_IDENTIFIER?: string
 AGORA_WHITEBOARD_ACCESS_KEY?: string
 AGORA_WHITEBOARD_SECRET_KEY?: string
 AGORA_WHITEBOARD_SDK_TOKEN?: string
 AGORA_WHITEBOARD_REGION?: string
 OPENAI_API_KEY?: string
 AI_API_BASE_URL?: string
 OPENAI_VISION_MODEL?: string
}
const database = new GameDatabase()
export const workerEnv = new Proxy({} as DrawGuessEnv, {
 get(_target, key) { return key === 'DB' ? database : process.env[String(key)] },
})
export function withPrimaryD1Session(source: DrawGuessEnv): DrawGuessEnv {
 const db = source.DB as DrawGuessEnv['DB'] & Partial<Pick<D1Database,'withSession'>>
 return typeof db.withSession === 'function' ? {...source, DB:db.withSession('first-primary')} : source
}
