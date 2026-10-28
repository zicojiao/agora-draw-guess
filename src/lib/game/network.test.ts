import { afterEach, expect, it, vi } from 'vitest'
import { gameRequest } from './network'
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('ends a stalled mutation with useful copy and never replays it', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn((_url, { signal }) => new Promise<Response>((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')))))
  vi.stubGlobal('fetch', fetcher)
  const result = gameRequest('/rooms', { method: 'POST' }, 1000)
  const check = expect(result).rejects.toThrow('连接时间有点长')
  await vi.advanceTimersByTimeAsync(1000)
  await check
  expect(fetcher).toHaveBeenCalledOnce()
})

it('handles unchanged frames without attempting to read a body', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
  expect((await gameRequest('/drawing')).data).toBeNull()
})

it('also cancels a stalled response body', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn((_url, { signal }) => Promise.resolve({ status: 200, json: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')))) })))
  const check = expect(gameRequest('/join', {}, 1000)).rejects.toThrow('连接时间有点长')
  await vi.advanceTimersByTimeAsync(1000)
  await check
})
