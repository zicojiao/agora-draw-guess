import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function worker() {
  const listeners: Record<string, (event: unknown) => void> = {}
  const match = vi.fn().mockResolvedValue(new Response('offline screen'))
  const addAll = vi.fn().mockResolvedValue(undefined)
  const open = vi.fn().mockResolvedValue({ match, addAll })
  const remove = vi.fn().mockResolvedValue(true)
  const fetch = vi.fn().mockResolvedValue(new Response('private page'))
  runInNewContext(readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8'), {
    URL, Response, fetch,
    caches: { open, delete: remove, keys: async () => ['other-app', 'draw-guess-offline-v0', 'draw-guess-offline-v1'] },
    self: {
      location: { origin: 'https://game.test' },
      skipWaiting: async () => undefined, clients: { claim: async () => undefined },
      addEventListener: (name: string, listener: (event: unknown) => void) => { listeners[name] = listener },
    },
  })
  const request = (path: string, mode = 'navigate', method = 'GET') => {
    const respondWith = vi.fn()
    listeners.fetch({ request: { url: `https://game.test${path}`, mode, method }, respondWith })
    return respondWith
  }
  return { listeners, request, fetch, match, addAll, open, remove }
}

describe('PWA offline safety', () => {
  it('precaches only the public offline page and icon', async () => {
    const w = worker()
    let done: Promise<unknown> | undefined
    w.listeners.install({ waitUntil: (value: Promise<unknown>) => { done = value } })
    await done
    expect(w.addAll).toHaveBeenCalledWith(['/offline.html', '/favicon-192x192.png'])
  })

  it('always fetches private navigations from the server and never writes them to cache', async () => {
    const w = worker()
    const response = w.request('/room/abc123')
    expect(await (await response.mock.calls[0][0]).text()).toBe('private page')
    expect(w.fetch).toHaveBeenCalledOnce()
    expect(w.open).not.toHaveBeenCalled()
  })

  it('uses the public fallback when navigation is offline, never a cached room', async () => {
    const w = worker()
    w.fetch.mockRejectedValue(new Error('offline'))
    const response = w.request('/room/abc123')
    expect(await (await response.mock.calls[0][0]).text()).toBe('offline screen')
    expect(w.match).toHaveBeenCalledWith('/offline.html')
  })

  it('leaves game APIs, login, mutations, and bundles entirely on the network', () => {
    const w = worker()
    for (const [path, mode, method] of [
      ['/api/game/rooms', 'cors', 'GET'], ['/api/game/rooms/abc123/ai-guess', 'cors', 'POST'],
      ['/access', 'navigate', 'POST'], ['/access', 'navigate', 'GET'],
      ['/_build/app.js', 'cors', 'GET'],
    ]) expect(w.request(path, mode, method)).not.toHaveBeenCalled()
  })

  it('removes only this app’s outdated offline caches on activation', async () => {
    const w = worker()
    let done: Promise<unknown> | undefined
    w.listeners.activate({ waitUntil: (value: Promise<unknown>) => { done = value } })
    await done
    expect(w.remove).toHaveBeenCalledExactlyOnceWith('draw-guess-offline-v0')
  })
})
