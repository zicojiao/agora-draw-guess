/** A request deadline also covers reading the response body. Never replay mutations here. */
export async function gameRequest<T>(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<{ response: Response; data: T }> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  init.signal?.addEventListener('abort', abort, { once: true })
  if (init.signal?.aborted) controller.abort()
  const timer = setTimeout(abort, timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const data = response.status === 204 ? null as T : await response.json() as T
    return { response, data }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('连接时间有点长，请检查网络后重试。')
    if (error instanceof TypeError) throw new Error('网络暂时未连上，请检查网络后重试。')
    throw error
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', abort)
  }
}

/** Local-only diagnostic entries; no drawings, identities or credentials. */
export function recordGameTiming(stage: 'upload' | 'ai-roundtrip' | 'vision', duration: number) {
  if (typeof performance === 'undefined' || !Number.isFinite(duration) || duration < 0) return
  const name = `drawguess:${stage}`
  if (performance.getEntriesByName(name).length >= 50) performance.clearMeasures(name)
  try { performance.measure(name, { start: Math.max(0, performance.now() - duration), duration }) } catch { /* optional diagnostics */ }
}
