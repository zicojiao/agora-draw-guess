import { describe, expect, it } from 'vitest'
import { isCorrectGuess } from './model'
import { DRAWING_TOPICS } from './topics'
import { pickWords } from '../server/game-server'
import { guessDrawing } from '../server/openai-vision'
import { vi } from 'vitest'
vi.mock('../server/worker-env', () => ({ workerEnv: {} }))
describe('Chinese event game', () => {
 it('uses only the nine supplied drawing answers', () => {
  const allowed = ['桃子','西瓜','苹果','星星','太阳','灯泡','吉他','帆船','桥']
  for (let i=0; i<10; i++) expect(pickWords(9).sort()).toEqual([...allowed].sort())
 })
 it('accepts natural Chinese and English visual labels', () => {
  expect(isCorrectGuess('桃','桃子')).toBe(true)
  expect(isCorrectGuess('桥梁','桥')).toBe(true)
  expect(isCorrectGuess('light bulb','灯泡')).toBe(true)
  expect(isCorrectGuess('star','星星')).toBe(true)
  expect(isCorrectGuess('苹果','桃子')).toBe(false)
 })
 it('requests a Chinese visual guess without the round answer or drink hints', async () => {
  let body = ''
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
   body = init.body
   return Response.json({ choices: [{ message: { content: '{"guess":"太阳","confidence":0.9,"reason":"圆形周围有光芒"}' } }] })
  }))
  await guessDrawing({ OPENAI_API_KEY: 'test', AI_API_BASE_URL: 'https://vision.example/v1' } as never, 'data:image/png;base64,AAAA')
  expect(body).toContain('中文')
  for (const topic of DRAWING_TOPICS) {
   expect(body).not.toContain(topic.drink)
   expect(body).not.toContain(topic.blessing)
  }
  expect(body).not.toContain('FastH3')
  vi.unstubAllGlobals()
 })
})
