import { LoadingCompanion } from './loading-companion'
import { useEffect, useRef, useState } from 'react'
import type { PublicGameRoom } from '#/lib/game/model'
import { colorsMatch, DRAWING_COLOR_OPTIONS, DRAWING_WIDTHS, enableWhiteboardUndo, hasVisibleDrawing, isWhiteboardReady, resetWhiteboardForRound, shouldClearForRound, type DrawingColor, type DrawingTool, type WhiteboardConnectionStatus } from '#/lib/game/whiteboard-state'

const COLOR_NAMES: Record<string,string> = {'Ink black':'墨黑','Graphite':'石墨灰','Agora blue':'天蓝','Deep blue':'深蓝','Coral':'珊瑚色','Cherry red':'樱桃红','Mint':'薄荷绿','Leaf green':'叶绿','Sunshine':'阳光黄','Orange':'橘色','Purple':'紫色','Hot pink':'亮粉','Brown':'棕色','White':'白色'}
type WhiteboardCredentials = NonNullable<PublicGameRoom['whiteboard']>
let whiteboardSdkPromise: Promise<typeof import('white-web-sdk')> | null = null

export function preloadAgoraWhiteboardSdk() {
  whiteboardSdkPromise ??= import('white-web-sdk').catch((error) => {
    whiteboardSdkPromise = null
    throw error
  })
  return whiteboardSdkPromise
}

export function AgoraGameBoard({ credentials, canDraw, roundId, sampleEnabled, remoteImage, onSnapshot, onReadyChange }: {
  credentials?: WhiteboardCredentials
  canDraw: boolean
  roundId: string
  sampleEnabled: boolean
  remoteImage?: string | null
  onSnapshot: (image: string, hasDrawing?: boolean) => void
  onReadyChange?: (ready: boolean) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const fallbackRef = useRef<HTMLCanvasElement>(null)
  const roomRef = useRef<import('white-web-sdk').Room | null>(null)
  const [status, setStatus] = useState<WhiteboardConnectionStatus>(credentials ? 'loading' : 'local')
  const [tool, setTool] = useState<DrawingTool>('pencil')
  const [color, setColor] = useState<DrawingColor>(DRAWING_COLOR_OPTIONS[0].rgb)
  const [strokeWidth, setStrokeWidth] = useState<number>(DRAWING_WIDTHS[1])
  const [agoraUndoSteps, setAgoraUndoSteps] = useState(0)
  const [fallbackUndoSteps, setFallbackUndoSteps] = useState(0)
  const dirtyRef = useRef(false)
  const lastStrokeRef = useRef(0)
  const clearedRoundRef = useRef<string | null>(null)
  const fallbackHistoryRef = useRef<ImageData[]>([])

  useEffect(() => {
    if (!credentials || !hostRef.current) { setStatus('local'); return }
    let cancelled = false
    let room: import('white-web-sdk').Room | null = null
    const deadline = setTimeout(() => {
      if (!room && !cancelled) { cancelled = true; setStatus('error') }
    }, 12000)
    const connect = async () => {
      try {
        const { WhiteWebSdk } = await preloadAgoraWhiteboardSdk()
        const sdk = new WhiteWebSdk({ appIdentifier: credentials.appIdentifier, region: credentials.region, useMobXState: false })
        room = await sdk.joinRoom({
          uuid: credentials.uuid,
          uid: credentials.uid,
          roomToken: credentials.roomToken,
          region: credentials.region,
          isWritable: credentials.writable,
          userPayload: { name: credentials.uid },
        }, {
          onRoomStateChanged: () => { dirtyRef.current = true },
          onCanUndoStepsUpdate: (steps) => setAgoraUndoSteps(steps),
        })
        if (cancelled) { await room.disconnect(); return }
        room.bindHtmlElement(hostRef.current)
        room.disableDeviceInputs = !canDraw
        setAgoraUndoSteps(enableWhiteboardUndo(room, credentials.writable))
        if (canDraw) room.setMemberState({ currentApplianceName: 'pencil' as import('white-web-sdk').ApplianceNames, strokeColor: color, strokeWidth })
        roomRef.current = room
        clearTimeout(deadline)
        setStatus('agora')
      } catch (error) {
        clearTimeout(deadline)
        if (!cancelled) { console.error('Agora 画板 connection failed', error); setStatus('error') }
      }
    }
    void connect()
    return () => { clearTimeout(deadline); cancelled = true; roomRef.current = null; if (room) { room.bindHtmlElement(null); void room.disconnect() } }
  }, [credentials?.uuid, credentials?.uid, credentials?.roomToken])

  useEffect(() => {
    onReadyChange?.(isWhiteboardReady(status))
  }, [onReadyChange, status])

  useEffect(() => {
    const room = roomRef.current
    if (!room) return
    void room.setWritable(canDraw).then(() => {
      room.disableDeviceInputs = !canDraw
      if (canDraw) {
        room.setMemberState({
          currentApplianceName: tool as import('white-web-sdk').ApplianceNames,
          strokeColor: color,
          strokeWidth: tool === 'eraser' ? 18 : strokeWidth,
          fillColor: tool === 'rectangle' || tool === 'ellipse' ? color : undefined,
        })
      }
    }).catch(() => undefined)
  }, [canDraw])

  useEffect(() => {
    const host = hostRef.current
    if (!host || status !== 'agora' || !canDraw) return
    const markLocalStroke = () => { dirtyRef.current = true; lastStrokeRef.current = Date.now() }
    host.addEventListener('pointerup', markLocalStroke, true)
    host.addEventListener('mouseup', markLocalStroke, true)
    host.addEventListener('touchend', markLocalStroke, true)
    return () => {
      host.removeEventListener('pointerup', markLocalStroke, true)
      host.removeEventListener('mouseup', markLocalStroke, true)
      host.removeEventListener('touchend', markLocalStroke, true)
    }
  }, [canDraw, status])

  useEffect(() => {
    const room = roomRef.current
    if (!room || !canDraw) return
    room.setMemberState({
      currentApplianceName: tool as import('white-web-sdk').ApplianceNames,
      strokeColor: color,
      strokeWidth: tool === 'eraser' ? 18 : strokeWidth,
      fillColor: tool === 'rectangle' || tool === 'ellipse' ? color : undefined,
    })
  }, [canDraw, color, status, strokeWidth, tool])

  useEffect(() => {
    const room = roomRef.current
    const boardReady = Boolean(room) || Boolean(fallbackRef.current && status !== 'loading')
    if (!shouldClearForRound({ canDraw, roundId, clearedRoundId: clearedRoundRef.current, boardReady })) return
    if (room) {
      resetWhiteboardForRound(room)
      setAgoraUndoSteps(0)
    }
    const canvas = fallbackRef.current
    const context = canvas?.getContext('2d')
    if (canvas && context) {
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    clearedRoundRef.current = roundId
    fallbackHistoryRef.current = []
    setFallbackUndoSteps(0)
    dirtyRef.current = false
  }, [canDraw, roundId, status])

  const undo = () => {
    if (!canDraw) return
    if (roomRef.current) {
      roomRef.current.undo()
      setAgoraUndoSteps(roomRef.current.canUndoSteps)
      dirtyRef.current = true
      return
    }
    const canvas = fallbackRef.current
    const context = canvas?.getContext('2d')
    const previous = fallbackHistoryRef.current.pop()
    if (canvas && context && previous) {
      context.putImageData(previous, 0, 0)
      setFallbackUndoSteps(fallbackHistoryRef.current.length)
      dirtyRef.current = true
    }
  }

  useEffect(() => {
    if (!canDraw) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]') || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); return }
      if (event.key.toLowerCase() === 'p') setTool('pencil')
      if (event.key.toLowerCase() === 'e') setTool('eraser')
      if (event.key.toLowerCase() === 'r') setTool('rectangle')
      if (event.key.toLowerCase() === 'o') setTool('ellipse')
      if (event.key === '[') setStrokeWidth((width) => DRAWING_WIDTHS[Math.max(0, DRAWING_WIDTHS.indexOf(width as typeof DRAWING_WIDTHS[number]) - 1)])
      if (event.key === ']') setStrokeWidth((width) => DRAWING_WIDTHS[Math.min(DRAWING_WIDTHS.length - 1, DRAWING_WIDTHS.indexOf(width as typeof DRAWING_WIDTHS[number]) + 1)])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canDraw])

  useEffect(() => {
    if (!sampleEnabled) return
    let capturing = false, cancelled = false, lastCapture = 0
    const timer = window.setInterval(async () => {
      if (!dirtyRef.current || capturing) return
      const now = Date.now()
      // Let a finished stroke settle, but still sample continuous drawing.
      if (now - lastCapture < 700 || (now - lastStrokeRef.current < 300 && now - lastCapture < 1400)) return
      lastCapture = now
      capturing = true
      dirtyRef.current = false
      try {
      if (roomRef.current) {
        const room = roomRef.current
        const transparent = document.createElement('canvas')
        transparent.width = 800; transparent.height = 450
        const transparentContext = transparent.getContext('2d')
        if (!transparentContext) return
        try {
          await room.screenshotToCanvasAsync(transparentContext, room.state.sceneState.scenePath, 800, 450, room.state.cameraState)
          const pixels = transparentContext.getImageData(0, 0, transparent.width, transparent.height).data
          if (cancelled) return
          if (!hasVisibleDrawing(pixels)) { onSnapshot('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==', false); return }
          const canvas = document.createElement('canvas')
          canvas.width = 800; canvas.height = 450
          const context = canvas.getContext('2d')
          if (!context) return
          context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
          context.drawImage(transparent, 0, 0)
          onSnapshot(canvas.toDataURL('image/jpeg', .78))
        } catch { dirtyRef.current = true }
      } else if (fallbackRef.current) {
        const context = fallbackRef.current.getContext('2d')
        if (!context) return
        const visible = hasVisibleDrawing(context.getImageData(0, 0, fallbackRef.current.width, fallbackRef.current.height).data)
        if (!visible) { onSnapshot(fallbackRef.current.toDataURL('image/jpeg', .78), false); return }
        // Cap high-DPI fallback uploads, preserving the full board's aspect ratio.
        const source = fallbackRef.current
        const scaled = document.createElement('canvas')
        const scale = Math.min(1, 1000 / Math.max(source.width, source.height))
        scaled.width = Math.max(1, Math.round(source.width * scale)); scaled.height = Math.max(1, Math.round(source.height * scale))
        scaled.getContext('2d')!.drawImage(source, 0, 0, scaled.width, scaled.height)
        onSnapshot(scaled.toDataURL('image/jpeg', .85))
      }
      } finally { capturing = false }
    }, 200)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [sampleEnabled, onSnapshot])

  useEffect(() => {
    const canvas = fallbackRef.current
    if (!canvas || status === 'agora') return
    const context = canvas.getContext('2d')
    if (!context) return
    const resize = () => {
      if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return
      const old = document.createElement('canvas'); old.width = Math.max(1, canvas.width); old.height = Math.max(1, canvas.height)
      old.getContext('2d')?.drawImage(canvas, 0, 0)
      const ratio = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * ratio; canvas.height = canvas.clientHeight * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      context.drawImage(old, 0, 0, canvas.clientWidth, canvas.clientHeight)
    }
    resize(); window.addEventListener('resize', resize)
    const observer = new ResizeObserver(resize); observer.observe(canvas)
    let drawing = false
    let startPoint: readonly [number, number] | null = null
    const point = (event: PointerEvent) => { const box = canvas.getBoundingClientRect(); return [event.clientX - box.left, event.clientY - box.top] as const }
    const down = (event: PointerEvent) => {
      if (!canDraw) return
      fallbackHistoryRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height))
      if (fallbackHistoryRef.current.length > 20) fallbackHistoryRef.current.shift()
      setFallbackUndoSteps(fallbackHistoryRef.current.length)
      drawing = true; canvas.setPointerCapture(event.pointerId); startPoint = point(event)
      context.beginPath(); context.moveTo(...startPoint)
    }
    const move = (event: PointerEvent) => {
      if (!drawing || !canDraw || (tool !== 'pencil' && tool !== 'eraser')) return
      const [x, y] = point(event); context.strokeStyle = tool === 'eraser' ? '#fff' : `rgb(${color.join(',')})`; context.lineWidth = tool === 'eraser' ? 28 : strokeWidth; context.lineCap = 'round'; context.lineJoin = 'round'; context.lineTo(x, y); context.stroke(); dirtyRef.current = true
    }
    const up = (event: PointerEvent) => {
      if (drawing) lastStrokeRef.current = Date.now()
      if (drawing && startPoint && (tool === 'rectangle' || tool === 'ellipse')) {
        const [x, y] = point(event); const [startX, startY] = startPoint
        context.fillStyle = `rgb(${color.join(',')})`; context.strokeStyle = `rgb(${color.join(',')})`; context.lineWidth = strokeWidth
        context.beginPath()
        if (tool === 'rectangle') context.rect(startX, startY, x - startX, y - startY)
        else context.ellipse((startX + x) / 2, (startY + y) / 2, Math.abs(x - startX) / 2, Math.abs(y - startY) / 2, 0, 0, Math.PI * 2)
        context.fill(); context.stroke(); dirtyRef.current = true
      }
      drawing = false; startPoint = null
    }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up)
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up) }
  }, [canDraw, color, status, strokeWidth, tool])

  const clear = () => {
    if (!canDraw) return
    if (roomRef.current) roomRef.current.cleanCurrentScene(false)
    const canvas = fallbackRef.current; const context = canvas?.getContext('2d')
    if (canvas && context) {
      fallbackHistoryRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height))
      if (fallbackHistoryRef.current.length > 20) fallbackHistoryRef.current.shift()
      setFallbackUndoSteps(fallbackHistoryRef.current.length)
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); dirtyRef.current = true
    }
  }

  const canUndo = canDraw && (status === 'agora' ? agoraUndoSteps > 0 : fallbackUndoSteps > 0)

  return (
    <div className="dg-board-wrap">
      {canDraw && <div className="dg-board-tools" aria-label="绘画工具">
        <button className={`dg-tool ${tool === 'pencil' ? 'is-selected' : ''}`} aria-pressed={tool === 'pencil'} onPointerUp={(event) => event.currentTarget.blur()} onClick={() => setTool('pencil')}><span aria-hidden="true">✎</span> 画笔</button>
        <div className="dg-color-palette" aria-label="画笔颜色">
        {DRAWING_COLOR_OPTIONS.map(({ name, rgb }) => {
          const selected = tool !== 'eraser' && colorsMatch(color, rgb)
          return <button key={name} className={`dg-color ${selected ? 'is-selected' : ''}`} style={{ backgroundColor: `rgb(${rgb.join(',')})` }} title={COLOR_NAMES[name] || name} aria-label={`使用${COLOR_NAMES[name] || name}`} aria-pressed={selected} onPointerUp={(event) => event.currentTarget.blur()} onClick={() => { setTool((current) => current === 'eraser' ? 'pencil' : current); setColor(rgb) }}><span aria-hidden="true">✓</span></button>
        })}
        </div>
        <span className="dg-tool-divider" aria-hidden="true" />
        <div className="dg-size-group" aria-label="画笔粗细">{DRAWING_WIDTHS.map((width, index) => <button key={width} className={`dg-size ${strokeWidth === width ? 'is-selected' : ''}`} aria-label={`${['细', '中', '粗'][index]}画笔`} aria-pressed={strokeWidth === width} onClick={() => setStrokeWidth(width)}><span style={{ width: index * 4 + 5, height: index * 4 + 5 }} /></button>)}</div>
        <button className={`dg-tool dg-tool--icon ${tool === 'rectangle' ? 'is-selected' : ''}`} aria-label="实心矩形（R）" aria-pressed={tool === 'rectangle'} onClick={() => setTool('rectangle')}><span aria-hidden="true">■</span></button>
        <button className={`dg-tool dg-tool--icon ${tool === 'ellipse' ? 'is-selected' : ''}`} aria-label="实心圆形（O）" aria-pressed={tool === 'ellipse'} onClick={() => setTool('ellipse')}><span aria-hidden="true">●</span></button>
        <button className={`dg-tool ${tool === 'eraser' ? 'is-selected' : ''}`} aria-pressed={tool === 'eraser'} onPointerUp={(event) => event.currentTarget.blur()} onClick={() => setTool('eraser')}><span aria-hidden="true">▱</span> 橡皮</button>
        <span className="dg-tool-divider" aria-hidden="true" />
        <button className="dg-tool dg-tool--action dg-tool--undo" disabled={!canUndo} aria-label={canUndo ? '撤销上一步' : '暂无可撤销操作'} onPointerUp={(event) => event.currentTarget.blur()} onClick={undo}><span aria-hidden="true">↶</span> 撤销</button>
        <button className="dg-tool dg-tool--action dg-tool--clear" onPointerUp={(event) => event.currentTarget.blur()} onClick={clear}>清空</button>
      </div>}
      <div ref={hostRef} className={`dg-whiteboard ${status === 'agora' ? 'is-active' : ''}`} />
      {(status === 'local' || status === 'error') && <canvas ref={fallbackRef} className="dg-whiteboard dg-whiteboard--fallback" aria-label="绘画画板" />}
      {!canDraw && remoteImage && <img className="dg-shared-drawing" src={remoteImage} alt="当前画家的实时画作" />}
      {status === 'loading' && <div className="dg-board-loading" role="status"><LoadingCompanion label="正在连接画板…" /><small>画板就绪后即可选题。</small></div>}
      <span className={`dg-board-status dg-board-status--${status}`}>{status === 'agora' ? '● 实时画板已连接' : status === 'loading' ? '正在连接画板…' : status === 'error' ? '● 共享画板 · 自动同步' : '● 共享画板 · 自动同步'}</span>
    </div>
  )
}
