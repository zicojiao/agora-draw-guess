import { afterEach, describe, expect, it, vi } from 'vitest'
import { DrawingSync } from './drawing-sync'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const snapshot = { image: 'data:image/jpeg;base64,YQ==', hasDrawing: true }
function setup() {
  const saved = vi.fn(), note = vi.fn(), closed = vi.fn()
  const sync = new DrawingSync('/drawing', () => 'seat', 'round', saved, note, closed)
  return { sync, saved, note, closed }
}

describe('drawing upload lifecycle', () => {
  it('treats a completed round as normal and does not trigger AI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 'DRAWING_CLOSED' }, { status: 409 })))
    const { sync, saved, note, closed } = setup()
    await sync.push(snapshot)
    expect(closed).toHaveBeenCalledOnce()
    expect(saved).not.toHaveBeenCalled()
    expect(note).toHaveBeenLastCalledWith('')
  })

  it('retries a lost upload without requiring another pen stroke and clears the warning', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetcher)
    const { sync, saved, note } = setup()
    await sync.push(snapshot)
    expect(saved).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(saved).toHaveBeenCalledWith(true, snapshot.image)
    expect(note).toHaveBeenLastCalledWith('')
    sync.dispose()
  })

  it('sends the newest drawing on retry, including a cleared board', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetcher)
    const { sync, saved } = setup()
    await sync.push(snapshot)
    await sync.push({ image: 'blank', hasDrawing: false })
    await vi.advanceTimersByTimeAsync(2000)
    expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body).image).toBe('blank')
    expect(saved).toHaveBeenLastCalledWith(false, 'blank')
    sync.dispose()
  })

  it('ignores an old in-flight response after changing rounds', async () => {
    let resolve!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolve = r })))
    const { sync, saved, note, closed } = setup()
    const pending = sync.push(snapshot)
    sync.dispose()
    resolve(Response.json({ ok: true }))
    await pending
    expect(saved).not.toHaveBeenCalled()
    expect(note).not.toHaveBeenCalled()
    expect(closed).not.toHaveBeenCalled()
  })

  it('does not retry invalid images or authentication failures', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: '请先输入访问密码，再进入游戏。' }, { status: 401 }))
    vi.stubGlobal('fetch', fetcher)
    const { sync, note } = setup()
    await sync.push(snapshot)
    await vi.advanceTimersByTimeAsync(20000)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(note).toHaveBeenLastCalledWith('请先输入访问密码，再进入游戏。')
    sync.dispose()
  })
})

it('retains only the latest offline drawing and resumes without another stroke', async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ ok: true })))
  vi.stubGlobal('fetch', fetcher)
  const { sync, saved } = setup()
  sync.setOnline(false)
  await sync.push(snapshot)
  await sync.push({ ...snapshot, image: 'latest' })
  expect(fetcher).not.toHaveBeenCalled()
  sync.setOnline(true)
  await vi.waitFor(() => expect(saved).toHaveBeenCalledWith(true, 'latest'))
  await sync.push({ ...snapshot, image: 'latest' })
  expect(fetcher).toHaveBeenCalledOnce()
  sync.dispose()
})

it('can restore the saved image while a different frame is queued offline', async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ ok: true })))
  vi.stubGlobal('fetch', fetcher)
  const { sync } = setup()
  await sync.push(snapshot)
  sync.setOnline(false)
  await sync.push({ ...snapshot, image: 'unwanted stroke' })
  await sync.push(snapshot)
  sync.setOnline(true)
  expect(fetcher).toHaveBeenCalledOnce()
  sync.dispose()
})
