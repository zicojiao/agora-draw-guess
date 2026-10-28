import { recordGameTiming } from './network'
export type AiGuessState = 'idle' | 'queued' | 'thinking' | 'watching' | 'retrying' | 'failed' | 'complete' | 'correct'

/** Saved frames can be inspected while the next frame uploads. One vision request at a time. */
export class AiGuessQueue {
  private hasDrawing = false
  private pending = false
  private busy = false
  private stopped = false
  private failures = 0
  private offline = false
  private nextAt = 0
  private timer?: ReturnType<typeof setTimeout>
  private controller?: AbortController

  constructor(
    private request: (signal: AbortSignal) => Promise<Response>,
    private onState: (state: AiGuessState, note: string) => void,
    private onUpdated: () => void,
  ) {}

  saved(hasDrawing: boolean) {
    if (this.stopped) return
    this.hasDrawing = hasDrawing
    this.pending = hasDrawing
    if (!hasDrawing) {
      clearTimeout(this.timer); this.timer = undefined
      if (!this.busy) this.onState('idle', '')
      return
    }
    // New strokes allow a fresh attempt after the automatic retry limit.
    if (this.failures > 2) this.failures = 0
    if (!this.offline && !this.busy && !this.timer) {
      this.onState('queued', '')
      this.schedule(Math.max(0, this.nextAt - Date.now()))
    }
  }

  setOnline(online: boolean) {
    this.offline = !online
    if (!online) {
      clearTimeout(this.timer); this.timer = undefined
      if (!this.busy && this.hasDrawing) this.onState('retrying', '网络已断开，连接恢复后继续猜题。')
    } else if (this.pending && !this.busy && !this.timer) {
      this.schedule(Math.max(0, this.nextAt - Date.now()))
    }
  }

  retry() {
    if (!this.hasDrawing || this.stopped || this.busy) return
    this.failures = 0; this.nextAt = 0
    this.saved(true)
  }

  dispose() {
    this.stopped = true
    clearTimeout(this.timer)
    this.controller?.abort()
  }

  private schedule(delay: number) {
    this.timer = setTimeout(() => { this.timer = undefined; void this.run() }, delay)
  }

  private async run() {
    if (this.stopped || this.offline || this.busy || !this.pending) return
    this.pending = false
    this.busy = true
    const began = Date.now()
    this.nextAt = began + 2500
    this.controller = new AbortController()
    const timeout = setTimeout(() => this.controller?.abort(), 35000)
    this.onState('thinking', '')
    try {
      const response = await this.request(this.controller.signal)
      const result = await response.json() as { error?: string; stale?: boolean; won?: boolean; code?: string; visionMs?: number }
      if (this.stopped) return
      recordGameTiming('ai-roundtrip', Date.now() - began)
      if (result.visionMs !== undefined) recordGameTiming('vision', result.visionMs)
      if (result.won || result.stale || result.code === 'ROUND_CLOSED') {
        this.pending = false
        this.onState(result.won ? 'correct' : 'complete', '')
        this.onUpdated()
        this.dispose()
        return
      }
      if (!response.ok) {
        if (response.status === 409 || response.status === 408 || response.status === 429 || response.status >= 500) throw new Error(result.error || 'AI 连接暂时中断。')
        this.pending = false
        this.onState('failed', result.error || 'AI 暂时无法看画，请刷新后重试。')
        return
      }
      this.failures = 0
      this.onState(!this.hasDrawing ? 'idle' : this.pending ? 'queued' : 'watching', '')
    } catch (error) {
      if (this.stopped) return
      if (!this.hasDrawing) { this.onState('idle', ''); return }
      this.failures++
      if (this.failures <= 2) {
        this.pending = true
        this.nextAt = Date.now() + 4000 * this.failures
        this.onState('retrying', 'AI 连接有些慢，正在自动重试…')
      } else {
        this.pending = false
        this.onState('failed', error instanceof Error && error.name !== 'AbortError' ? error.message : 'AI 响应超时，请稍后再试。')
      }
    } finally {
      clearTimeout(timeout)
      this.busy = false
      if (!this.stopped) {
        this.onUpdated()
        if (this.pending && !this.offline) this.schedule(Math.max(0, this.nextAt - Date.now()))
      }
    }
  }
}
