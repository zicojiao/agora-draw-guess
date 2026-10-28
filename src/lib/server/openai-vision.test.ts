import { afterEach, describe, expect, it, vi } from 'vitest'
import { guessDrawing, isSafeDataImage } from './openai-vision'
import type { DrawGuessEnv } from './worker-env'
import { DRAWING_TOPICS } from '../game/topics'

const env = {
  OPENAI_API_KEY: 'test-key',
  AI_API_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
  OPENAI_VISION_MODEL: 'glm-4.5v',
} as DrawGuessEnv

afterEach(() => vi.unstubAllGlobals())

describe('OpenAI-compatible vision', () => {
  it('sends a Zhipu-compatible image request and parses a drawing guess', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"guess":"桃子","confidence":0.91,"reason":"圆润轮廓和叶子"}' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(guessDrawing(env, 'data:image/jpeg;base64,YQ==')).resolves.toEqual({
      guess: '桃子', confidence: 0.91, reason: '圆润轮廓和叶子',
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(body.model).toBe('glm-4.5v')
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.messages[0].content[0].text).toContain('只会是 1–2 个汉字')
    expect(body.messages[0].content[0].text).toContain('"maxLength":2')
    expect(body.messages[0].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,YQ==' } })
  })

  it('allows new visual evidence to revisit a previous topic and filters invalid history', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"guess":"桥","confidence":0.7,"reason":"桥面和支柱"}' } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await guessDrawing(env, 'data:image/jpeg;base64,YQ==', ['一', '未知', '桃子', '桥'])
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.messages[0].content[0].text).toContain('此前猜测：桃子、桥。')
    expect(body.messages[0].content[0].text).toContain('有新的视觉依据时可以再次猜同一题')
    expect(body.messages[0].content[0].text).not.toContain('Do not repeat')
  })

  it.each(['一', '二', '十', '红', '圆', '画', '直线', '红色桃子', '桃子树', 'cat', '桃！', ''])('rejects out-of-topic guesses without truncating: %s', async (guess) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ guess, confidence: 0.9, reason: '轮廓' }) } }],
    }), { status: 200 })))
    await expect(guessDrawing(env, 'data:image/jpeg;base64,YQ==')).resolves.toMatchObject({ guess: '未知', confidence: 0 })
  })

  it('uses DeepSeek flash when the provider is not configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"guess":"桥","confidence":0.8,"reason":"有桥面和桥墩"}' } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(guessDrawing({ OPENAI_API_KEY: 'test-key' } as DrawGuessEnv, 'data:image/jpeg;base64,YQ==')).resolves.toMatchObject({ guess: '桥' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(body.model).toBe('deepseek-flash')
    expect(body.messages[0].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,YQ==' } })
  })

  it('constrains the Responses API to the full topic pool without revealing drinks or blessings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: [{ content: [{ text: '{"guess":"桥","confidence":0.8,"reason":"有桥面和桥墩"}' }] }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(guessDrawing({ ...env, AI_API_BASE_URL: 'https://api.openai.com/v1', OPENAI_VISION_MODEL: 'gpt-4.1-mini' }, 'data:image/jpeg;base64,YQ==')).resolves.toMatchObject({ guess: '桥' })
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.model).toBe('gpt-4.1-mini')
    expect(body.text.format.schema.properties.guess.maxLength).toBe(2)
    expect(body.text.format.schema.properties.guess.enum).toEqual([...DRAWING_TOPICS.map(topic => topic.word), '未知'])
    const prompt = body.input[0].content[0].text
    for (const topic of DRAWING_TOPICS) {
      expect(prompt).toContain(topic.word)
      expect(prompt).not.toContain(topic.drink)
      expect(prompt).not.toContain(topic.blessing)
    }
    expect(prompt).toContain('不知道玩家本轮选择了哪一个')
  })

  it.each(DRAWING_TOPICS)('accepts the canonical topic $word', async ({ word }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ guess: word, confidence: 0.8, reason: '根据物体轮廓判断' }) } }],
    }), { status: 200 })))
    await expect(guessDrawing(env, 'data:image/jpeg;base64,YQ==')).resolves.toMatchObject({ guess: word, confidence: 0.8 })
  })

  it('keeps uncertainty at zero confidence rather than forcing a random topic', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"guess":"未知","confidence":0.9,"reason":"只有一条线"}' } }],
    }), { status: 200 })))
    await expect(guessDrawing(env, 'data:image/jpeg;base64,YQ==')).resolves.toMatchObject({ guess: '未知', confidence: 0 })
  })


  it('preserves provider status for quota handling', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":{"code":"1113"}}', { status: 429 })))
    await expect(guessDrawing(env, 'data:image/jpeg;base64,YQ==')).rejects.toMatchObject({ status: 429, name: 'VisionProviderError' })
  })
})

describe('image validation', () => {
  it('accepts supported data images and rejects remote or oversized input', () => {
    expect(isSafeDataImage('data:image/png;base64,YQ==')).toBe(true)
    expect(isSafeDataImage('https://example.com/image.png')).toBe(false)
    expect(isSafeDataImage(`data:image/png;base64,${'a'.repeat(2_800_000)}`)).toBe(false)
  })
})
