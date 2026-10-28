import { recordGameTiming } from './network'
type Snapshot = { image: string; hasDrawing: boolean }

/** One upload at a time; keep the newest frame until the server accepts it. */
export class DrawingSync {
  private pending: Snapshot | null = null
  private stopped = false
  private retry: ReturnType<typeof setTimeout> | undefined
  private controller: AbortController | undefined
  private failures = 0
  private offline = false
  private savedImage: string | null = null
  busy = false

  constructor(
    private url: string,
    private seat: () => string | null,
    readonly roundId: string,
    private onSaved: (hasDrawing: boolean, image: string) => void,
    private onNote: (note: string) => void,
    private onClosed: () => void,
    private onBusy: (busy: boolean) => void = () => undefined,
  ) {}

  async push(snapshot: Snapshot) {
    if (this.stopped) return
    if (snapshot.image === this.savedImage && !this.busy && !this.pending) return
    this.pending = snapshot
    if (!this.retry) await this.flush()
  }

  setOnline(online: boolean) {
    this.offline = !online
    if (online) this.retryNow()
    else this.onNote('网络已断开，画面将在连接恢复后同步。')
  }

  retryNow() {
    if (this.stopped || this.offline) return
    clearTimeout(this.retry); this.retry = undefined
    void this.flush()
  }

  dispose() {
    this.stopped = true
    this.pending = null
    clearTimeout(this.retry)
    this.controller?.abort()
  }

  private async flush() {
    if (this.busy || this.stopped || this.offline) return
    this.busy = true
    this.onBusy(true)
    try {
      while (this.pending && !this.stopped && !this.offline) {
        const frame = this.pending
        this.pending = null
        if (frame.image === this.savedImage) continue
        const began = Date.now()
        this.controller = new AbortController()
        const timeout = setTimeout(() => this.controller?.abort(), 12000)
        try {
          const response = await fetch(this.url, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ seatToken: this.seat(), roundId: this.roundId, image: frame.image }),
            signal: this.controller.signal,
          })
          if (this.stopped) return
          if (response.ok) {
            this.failures = 0
            this.onNote('')
            this.savedImage = frame.image
            recordGameTiming('upload', Date.now() - began)
            this.onSaved(frame.hasDrawing, frame.image)
            continue
          }
          const body = await response.json().catch(() => ({})) as { code?: string; error?: string }
          if (this.stopped) return
          if (body.code === 'DRAWING_CLOSED') {
            this.onNote('')
            this.dispose()
            this.onClosed()
            return
          }
          if (response.status >= 500 || response.status === 429 || response.status === 408) throw new Error('Temporary upload failure')
          this.onNote(body.error || '画面未能同步，请刷新页面后重试。')
          return
        } catch {
          if (this.stopped) return
          // Do not overwrite strokes that arrived while the failed request was in flight.
          this.pending ??= frame
          this.onNote('画面同步暂时中断，正在自动重试…')
          this.retry = setTimeout(() => {
            this.retry = undefined
            void this.flush()
          }, Math.min(1000 * 2 ** this.failures++, 8000))
          return
        } finally { clearTimeout(timeout) }
      }
    } finally { this.busy = false; if (!this.stopped) this.onBusy(false) }
  }
}
