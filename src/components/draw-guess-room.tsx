import { gameRequest } from '#/lib/game/network'
import { prepareVisionImage } from '#/lib/game/vision-image'
import { LoadingCompanion } from './loading-companion'
import { useBlocker } from '@tanstack/react-router'
import { aiResultView } from '#/lib/game/ai-result-view'
import { actionTransitionReducer } from '#/lib/game/action-transition'
import { suggestedNickname } from '#/lib/random-nickname'
import { AiGuessQueue, type AiGuessState } from '#/lib/game/ai-guess-queue'
import { DrawingSync } from '#/lib/game/drawing-sync'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { AgoraGameBoard, preloadAgoraWhiteboardSdk } from './agora-game-board'
import { AgoraCredit } from './agora-credit'
import { ConnectionIcon } from './connection-icon'
import { GameQuickGuide } from './game-quick-guide'
import { GameRulesDialog } from './game-rules-dialog'
import { RoomExitDialog } from './room-exit-dialog'
import { RoomLoading } from './room-loading'
import { FinishConfetti } from './finish-confetti'
import { DrawingHint } from './drawing-hint'
import { SketchCocktail, SketchTopicIcon } from './sketch-topic-icon'
import { topicForWord } from '#/lib/game/topics'
import { gameStartGate, type PublicGameRoom } from '#/lib/game/model'
import { countdownCue, GameAudio } from '#/lib/game/game-audio'
import { voiceControlCopy, type VoiceControlState } from '#/lib/game/voice-control'
import { connectAgoraSession, loadAgoraSessionDependencies, type ConnectedAgoraSession } from '#/lib/agora/session'

type GameSettings = { rounds: number; seconds: number }

function playerName(room: PublicGameRoom, id: string | null) {
  if (id === 'ai') return 'AI 画友'
  return room.players.find((player) => player.id === id)?.nickname ?? '有位玩家'
}

function readRoomSeat(key: string) {
  return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key)
}

function saveRoomSeat(key: string, seatToken: string) {
  window.sessionStorage.setItem(key, seatToken)
  window.localStorage.setItem(key, seatToken)
}

function clearRoomSeat(key: string) {
  window.sessionStorage.removeItem(key)
  window.localStorage.removeItem(key)
}

function roomPlayerStatus(player: PublicGameRoom['players'][number], artistId?: string | null, aiPhase?: string) {
  if (player.role === 'ai') return aiPhase === 'settling' ? '结果同步中' : aiPhase === 'thinking' ? '正在看画' : aiPhase === 'correct' ? '猜对啦' : aiPhase === 'failed' ? '暂时离线' : '看画猜题'
  if (player.presence === 'left') return '已离开房间'
  if (!player.connected) return '正在重连…'
  return player.id === artistId ? '正在作画' : '正在猜题'
}

export function DrawGuessRoom({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<PublicGameRoom | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [joinName, setJoinName] = useState('')
  const [guess, setGuess] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [connection, setConnection] = useState<'connected' | 'slow' | 'reconnecting' | 'offline'>('connected')
  const [checkingConnection, setCheckingConnection] = useState(false)
  const lastRefreshRef = useRef(Date.now())
  const visionFrameRef = useRef<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [guideMode, setGuideMode] = useState<'start' | 'review' | null>(null)
  const guestGuideShownRef = useRef(false)
  const [needsPlayerOpen, setNeedsPlayerOpen] = useState(false)
  const [aiMutationPending, setAiMutationPending] = useState(false)
  const [transition, dispatchTransition] = useReducer(actionTransitionReducer, null)
  const startPending = transition?.kind === 'start'
  const selectedTopic = transition?.kind === 'choose' ? transition.word : null
  const [replayPending, setReplayPending] = useState(false)
  const [nextTurnPending, setNextTurnPending] = useState(false)
  const [leavePending, setLeavePending] = useState(false)
  const [exitDialogOpen, setExitDialogOpen] = useState(false)
  const exitDecisionRef = useRef<{ promise: Promise<boolean>; resolve: (leave: boolean) => void } | null>(null)
  const [optimisticSettings, setOptimisticSettings] = useState<GameSettings | null>(null)
  const [whiteboardReady, setWhiteboardReady] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceControlState>('off')
  const [aiNote, setAiNote] = useState('')
  const [drawingImage, setDrawingImage] = useState<string | null>(null)
  const drawingSyncRef = useRef<DrawingSync | null>(null)
  const aiQueueRef = useRef<AiGuessQueue | null>(null)
  const [aiState, setAiState] = useState<AiGuessState>('idle')
  const [uploadNote, setUploadNote] = useState('')
  const [drawingUploading, setDrawingUploading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [now, setNow] = useState(Date.now())
  const sessionRef = useRef<ConnectedAgoraSession | null>(null)
  const sessionPromiseRef = useRef<Promise<ConnectedAgoraSession> | null>(null)
  const intentionalVoiceCloseRef = useRef(false)
  const aiMutationPendingRef = useRef(false)
  const startPendingRef = useRef(false)
  const choosePendingRef = useRef(false)
  const replayPendingRef = useRef(false)
  const nextTurnPendingRef = useRef(false)
  const queuedSettingsRef = useRef<GameSettings | null>(null)
  const settingsSavingRef = useRef(false)
  const audioRef = useRef<GameAudio | null>(null)
  const lastCountdownRef = useRef('')
  const previousPhaseRef = useRef<string | null>(null)
  const previousHostRef = useRef<string | null>(null)
  const refreshFailureRef = useRef(0)
  const refreshPendingRef = useRef(false)
  const refreshAgainRef = useRef(false)
  const leavingRef = useRef(false)
  const seatKey = `drawguess.seat.${roomId}`

  const needsLeaveConfirmation = Boolean(room && room.phase !== 'finished')
  const shouldWarnBeforeLeaving = useCallback(
    () => needsLeaveConfirmation && !leavingRef.current,
    [needsLeaveConfirmation],
  )
  const confirmRoomLeave = useCallback((): Promise<boolean> => {
    if (!shouldWarnBeforeLeaving()) return Promise.resolve(true)
    if (exitDecisionRef.current) return exitDecisionRef.current.promise
    let resolve!: (leave: boolean) => void
    const promise = new Promise<boolean>(done => { resolve = done })
    exitDecisionRef.current = { promise, resolve }
    setExitDialogOpen(true)
    return promise
  }, [shouldWarnBeforeLeaving])
  const resolveRoomLeave = useCallback((leave: boolean) => {
    const pending = exitDecisionRef.current
    exitDecisionRef.current = null
    setExitDialogOpen(false)
    pending?.resolve(leave)
  }, [])
  useEffect(() => {
    if (!room && exitDecisionRef.current) resolveRoomLeave(false)
  }, [room, resolveRoomLeave])
  useEffect(() => () => {
    exitDecisionRef.current?.resolve(false)
    exitDecisionRef.current = null
  }, [])
  const blockNavigation = useCallback(async () => !(await confirmRoomLeave()), [confirmRoomLeave])
  useBlocker({
    shouldBlockFn: blockNavigation,
    enableBeforeUnload: shouldWarnBeforeLeaving,
  })

  const refresh = useCallback(async (): Promise<void> => {
    if (leavingRef.current) return
    if (refreshPendingRef.current) { refreshAgainRef.current = true; return }
    const seatToken = readRoomSeat(seatKey)
    if (!seatToken) return
    refreshPendingRef.current = true
    const slowTimer = setTimeout(() => setConnection(current => current === 'offline' ? current : 'slow'), 5000)
    try {
    const { response, data: result } = await gameRequest<{ playerId?: string; room?: PublicGameRoom; error?: string }>(`/api/game/rooms/${roomId}`, { headers: { 'x-game-seat': seatToken } }, 12000)
    if (!response.ok || !result.room || !result.playerId) {
      if (response.status === 401 || response.status === 404) {
        clearRoomSeat(seatKey)
        setRoom(null)
        setPlayerId('')
        setError(result.error || '房间已失效或已过期。')
        setLoading(false)
        return
      }
      throw new Error(result.error || '暂时无法刷新房间。')
    }
    refreshFailureRef.current = 0
    lastRefreshRef.current = Date.now()
    setConnection('connected')
    setRoom((previous) => ({
      ...result.room!,
      agora: previous?.agora ?? result.room!.agora,
      whiteboard: result.room!.whiteboard?.writable === previous?.whiteboard?.writable
        ? previous?.whiteboard
        : result.room!.whiteboard ?? previous?.whiteboard,
    })); setPlayerId(result.playerId); setLoading(false)
    } catch (error) {
      refreshFailureRef.current += 1
      setConnection(navigator.onLine ? 'reconnecting' : 'offline')
      throw error
    } finally {
      clearTimeout(slowTimer)
      refreshPendingRef.current = false
      if (refreshAgainRef.current) {
        refreshAgainRef.current = false
        void refresh().catch(() => undefined)
      }
    }
  }, [roomId, seatKey])

  const join = useCallback(async (name: string, existingSeat?: string | null) => {
    setLoading(true); setError('')
    try {
      const { response, data: result } = await gameRequest<{ seatToken?: string; playerId?: string; room?: PublicGameRoom; error?: string }>(`/api/game/rooms/${roomId}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nickname: name, seatToken: existingSeat }) })
      if (!response.ok || !result.seatToken || !result.playerId || !result.room) throw new Error(result.error || '加入房间失败，请重试。')
      saveRoomSeat(seatKey, result.seatToken)
      if (name) window.localStorage.setItem('drawguess.nickname', name)
      setRoom(result.room); setPlayerId(result.playerId); setLoading(false)
    } catch (caught) { setError(caught instanceof Error ? caught.message : '加入房间失败，请重试。'); setLoading(false) }
  }, [roomId, seatKey])

  useEffect(() => {
    const storedName = suggestedNickname(window.localStorage.getItem('drawguess.nickname'))
    window.localStorage.setItem('drawguess.nickname', storedName)
    setSoundEnabled(window.localStorage.getItem('drawguess.sound') !== 'false')
    setJoinName(storedName)
    const seat = readRoomSeat(seatKey)
    if (seat) void join(storedName, seat)
    else setLoading(false)
  }, [join, seatKey])

  const recoverConnection = useCallback(async () => {
    if (refreshPendingRef.current || !navigator.onLine) return
    setCheckingConnection(true)
    try {
      await refresh()
      drawingSyncRef.current?.retryNow()
      // Resume queued work; successful frames are not guessed again.
      aiQueueRef.current?.setOnline(true)
    } catch { /* Connection banner retains the recovery state. */ }
    finally { setCheckingConnection(false) }
  }, [refresh])

  useEffect(() => {
    const offline = () => {
      setConnection('offline')
      drawingSyncRef.current?.setOnline(false)
      aiQueueRef.current?.setOnline(false)
    }
    const online = () => {
      setConnection('reconnecting')
      drawingSyncRef.current?.setOnline(true)
      aiQueueRef.current?.setOnline(true)
      void recoverConnection()
    }
    const visible = () => { if (!document.hidden && navigator.onLine) void recoverConnection() }
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', visible)
    if (!navigator.onLine) offline()
    return () => {
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [recoverConnection])

  useEffect(() => {
    if (room?.whiteboard) void preloadAgoraWhiteboardSdk().catch(() => undefined)
  }, [room?.whiteboard?.appIdentifier])

  useEffect(() => {
    if (!room) return
    const poll = window.setInterval(() => {
      if (!navigator.onLine) return
      if (document.hidden && Date.now() - lastRefreshRef.current < 10000) return
      void refresh().catch(() => undefined)
    }, 2_500)
    const clock = window.setInterval(() => setNow(Date.now()), 250)
    return () => { window.clearInterval(poll); window.clearInterval(clock) }
  }, [refresh, room?.id])

  const ensureAgoraSession = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current
    if (sessionPromiseRef.current) return sessionPromiseRef.current
    const credentials = room?.agora
    if (!credentials) throw new Error('当前房间的实时语音暂不可用。')
    const promise = (async () => {
      const dependencies = await loadAgoraSessionDependencies()
      const connected = await connectAgoraSession(credentials, {
        onOpponentJoined: () => { void refresh() },
        onOpponentLeft: () => { void refresh() },
        onMessage: (message) => { try { if ((JSON.parse(message) as { type?: string }).type === 'refresh') void refresh() } catch { /* ignore */ } },
        onConnectionState: (state) => {
          if (state === 'DISCONNECTED' || state === 'SAME_UID_LOGIN') {
            setVoiceState((current) => current === 'live' ? 'error' : current)
            if (state === 'SAME_UID_LOGIN') setError('你在另一个标签页打开了相同席位，请保留一个标签页后重试语音。')
          }
        },
        renewToken: async () => {
          const seatToken = readRoomSeat(seatKey)
          const { response, data: result } = await gameRequest<{ seatToken?: string; playerId?: string; room?: PublicGameRoom; error?: string }>(`/api/game/rooms/${roomId}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seatToken }) })
          const token = result.room?.agora?.token
          if (!response.ok || !result.room || !token) throw new Error(result.error || '语音凭证更新失败，请重新连接。')
          setRoom((previous) => previous?.agora ? { ...previous, agora: { ...previous.agora, token } } : result.room!)
          return token
        },
      }, dependencies, { deferMicrophone: true })
      sessionRef.current = connected
      return connected
    })()
    sessionPromiseRef.current = promise
    try {
      return await promise
    } finally {
      if (sessionPromiseRef.current === promise) sessionPromiseRef.current = null
    }
  }, [refresh, room?.agora, roomId, seatKey])

  useEffect(() => {
    if (!room?.agora) return
    void ensureAgoraSession().catch(() => undefined)
  }, [ensureAgoraSession, room?.agora])

  useEffect(() => () => {
    intentionalVoiceCloseRef.current = true
    const session = sessionRef.current
    sessionRef.current = null
    sessionPromiseRef.current = null
    void session?.close()
  }, [])

  useEffect(() => {
    audioRef.current = new GameAudio()
    const unlock = () => { if (soundEnabled) void audioRef.current?.unlock() }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      audioRef.current?.close()
      audioRef.current = null
    }
  }, [])

  const publishRefresh = () => { void sessionRef.current?.publish(JSON.stringify({ type: 'refresh', at: Date.now() }), 'drawguess.refresh').catch(() => undefined) }
  const act = async (action: string, value?: string) => {
    try {
    const seatToken = readRoomSeat(seatKey)
    const { response, data: result } = await gameRequest<{ error?: string; code?: string }>(`/api/game/rooms/${roomId}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seatToken, action, value, roundId: action === 'choose-word' || action === 'next-turn' ? room?.round?.id : undefined }), }, 20000)
    if (action === 'choose-word' && response.status === 409 && result.code === 'TOPIC_CHOICES_CHANGED') {
      setError('')
      await refresh().catch(() => undefined)
      return false
    }
    if (!response.ok) { setError(result.error || '操作失败，请重试。'); return false }
    setError(''); publishRefresh()
    if (action === 'start' || action === 'choose-word') await refresh().catch(() => undefined)
    else await refresh()
    return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '连接暂时中断，请稍后重试。')
      await refresh().catch(() => undefined)
      return false
    }
  }

  const changeAiPlayer = async (action: 'invite-ai' | 'remove-ai') => {
    if (aiMutationPendingRef.current) return false
    aiMutationPendingRef.current = true
    setAiMutationPending(true)
    try {
      return await act(action)
    } finally {
      aiMutationPendingRef.current = false
      setAiMutationPending(false)
    }
  }

  useEffect(() => {
    if (room) dispatchTransition({ type: 'room', phase: room.phase, roundId: room.round?.id ?? null, ready: whiteboardReady })
    else dispatchTransition({ type: 'failed' })
  }, [room?.phase, room?.round?.id, whiteboardReady])

  useEffect(() => {
    if (!transition) { startPendingRef.current = false; choosePendingRef.current = false }
  }, [transition])

  useEffect(() => {
    if (!transition) return
    const timeout = window.setTimeout(() => {
      dispatchTransition({ type: 'failed' })
      setError('准备时间较长，请检查网络后重试。')
      void refresh().catch(() => undefined)
    }, 45000)
    return () => window.clearTimeout(timeout)
  }, [transition, refresh])

  const startGame = async () => {
    if (startPendingRef.current || settingsSavingRef.current || room?.phase !== 'lobby') return
    startPendingRef.current = true
    dispatchTransition({ type: 'start' })
    setWhiteboardReady(false)
    setError('')
    try {
      const success = await act('start')
      dispatchTransition({ type: success ? 'accepted' : 'failed' })
      if (!success) startPendingRef.current = false
    } catch {
      dispatchTransition({ type: 'failed' })
      startPendingRef.current = false
      setError('开始游戏失败，请检查网络后重试。')
    }
  }

  const chooseTopic = async (word: string) => {
    if (choosePendingRef.current || !room?.round || !whiteboardReady) return
    choosePendingRef.current = true
    dispatchTransition({ type: 'choose', word, roundId: room.round.id })
    setError('')
    try {
      const success = await act('choose-word', word)
      dispatchTransition({ type: success ? 'accepted' : 'failed' })
      if (!success) choosePendingRef.current = false
    } catch {
      dispatchTransition({ type: 'failed' })
      choosePendingRef.current = false
      setError('题目提交失败，请检查网络后重试。')
    }
  }

  const requestStartGame = () => {
    if (!room || room.phase !== 'lobby' || startPendingRef.current || settingsSavingRef.current) return
    const gate = gameStartGate(room.players, room.hostPlayerId, room.aiEnabled)
    if (gate === 'needs-player') {
      setNeedsPlayerOpen(true)
      return
    }
    setGuideMode('start')
  }

  const finishStartGuide = () => {
    if (!room || room.phase !== 'lobby' || room.hostPlayerId !== playerId || settingsSavingRef.current) return
    setGuideMode(null)
    if (gameStartGate(room.players, room.hostPlayerId, room.aiEnabled) === 'needs-player') {
      setNeedsPlayerOpen(true)
      return
    }
    void startGame()
  }

  const replayCurrentRoom = async () => {
    if (replayPendingRef.current) return
    replayPendingRef.current = true
    setReplayPending(true)
    try {
      const seatToken = readRoomSeat(seatKey)
      const { response, data: result } = await gameRequest<{ error?: string; needsPlayer?: boolean }>(`/api/game/rooms/${roomId}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seatToken, action: 'restart' }),
      })
      if (!response.ok) {
        setError(result.error || '重新开局失败，请重试。')
        return
      }
      setError('')
      await publishRefresh()
      await refresh()
      if (result.needsPlayer) setNeedsPlayerOpen(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '重新开局失败，请重试。')
    } finally {
      replayPendingRef.current = false
      setReplayPending(false)
    }
  }

  const nextTurn = useCallback(async () => {
    if (nextTurnPendingRef.current) return
    nextTurnPendingRef.current = true
    setNextTurnPending(true)
    try {
      await act('next-turn')
    } finally {
      nextTurnPendingRef.current = false
      setNextTurnPending(false)
    }
  }, [roomId, seatKey, room?.round?.id])

  const updateSettings = async (settings: GameSettings) => {
    queuedSettingsRef.current = settings
    setOptimisticSettings(settings)
    if (settingsSavingRef.current) return
    settingsSavingRef.current = true
    try {
      while (queuedSettingsRef.current) {
        const latest = queuedSettingsRef.current
        queuedSettingsRef.current = null
        if (!await act('settings', JSON.stringify(latest))) {
          queuedSettingsRef.current = null
          break
        }
      }
    } catch (caught) {
      queuedSettingsRef.current = null
      setError(caught instanceof Error ? caught.message : '房间设置保存失败。')
    } finally {
      settingsSavingRef.current = false
      setOptimisticSettings(null)
    }
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('邀请链接已复制！', {
        id: `invite-copied-${roomId}`,
        description: `把房间 ${roomId.toUpperCase()} 分享给伙伴吧。`,
        duration: 3_600,
        icon: (
          <svg className="dg-toast-check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6.5 12.5 3.25 3.25L17.8 7.7" />
          </svg>
        ),
      })
    } catch {
      toast.error("邀请链接复制失败", {
        id: `invite-copy-failed-${roomId}`,
        description: '请复制浏览器地址栏中的链接。',
        duration: 4_500,
      })
    }
  }

  const connectVoice = async () => {
    if (!room?.agora || voiceState === 'joining' || voiceState === 'leaving' || voiceState === 'live') return
    intentionalVoiceCloseRef.current = false
    setVoiceState('joining')
    try {
      const session = await ensureAgoraSession()
      await session.enableMicrophone()
      setVoiceState('live')
    } catch (caught) { setVoiceState('error'); setError(caught instanceof Error ? caught.message : '语音连接失败，请重试。') }
  }

  const disconnectVoice = async () => {
    if (voiceState !== 'live' || !sessionRef.current) return
    intentionalVoiceCloseRef.current = true
    setVoiceState('leaving')
    const session = sessionRef.current
    try {
      await session.disableMicrophone()
      setError('')
      setVoiceState('off')
      toast.success('已关闭语音')
    } catch (caught) {
      setVoiceState('error')
      setError(caught instanceof Error ? caught.message : '语音断开失败，请重试。')
    }
  }

  const leaveRoom = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (leavePending || leavingRef.current || !(await confirmRoomLeave())) return
    // Multiple clicks can share one dialog, but only one request may leave the room.
    if (leavingRef.current) return
    leavingRef.current = true
    setLeavePending(true)
    const seatToken = readRoomSeat(seatKey)
    try {
      if (seatToken) {
        await fetch(`/api/game/rooms/${roomId}/leave`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ seatToken }),
          keepalive: true,
        })
      }
    } catch {
      // The server-side grace period still recovers an interrupted leave request.
    } finally {
      clearRoomSeat(seatKey)
      const session = sessionRef.current
      sessionRef.current = null
      await session?.close().catch(() => undefined)
      window.location.assign('/')
    }
  }

  const submitGuess = async () => { if (guess.trim() && await act('guess', guess)) setGuess('') }

  const inspectDrawing = useCallback((image: string, hasDrawing = true) => {
    const sync = drawingSyncRef.current
    if (sync?.roundId === room?.round?.id) void sync?.push({ image, hasDrawing })
  }, [room?.round?.id])

  useEffect(() => {
    setAiState('idle'); setAiNote('')
    if (!room?.aiEnabled || room.phase !== 'drawing' || room.round?.artistId !== playerId || room.waitingForPlayersUntil) return
    const queue = new AiGuessQueue(
      async (signal) => {
        const frame = visionFrameRef.current
        const visionImage = frame ? await prepareVisionImage(frame).catch(() => undefined) : undefined
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
        if (visionImage === null) return Response.json({ skipped: true })
        return fetch(`/api/game/rooms/${roomId}/ai-guess`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seatToken: readRoomSeat(seatKey), roundId: room.round?.id, visionImage }), signal,
      }) },
      (state, note) => { setAiState(state); setAiNote(note) },
      () => { publishRefresh(); void refresh().catch(() => undefined) },
    )
    queue.setOnline(navigator.onLine)
    aiQueueRef.current = queue
    return () => { queue.dispose(); aiQueueRef.current = null }
  }, [room?.aiEnabled, room?.phase, room?.round?.id, room?.round?.artistId, room?.waitingForPlayersUntil, playerId, roomId, seatKey, refresh])

  useEffect(() => {
    setUploadNote(''); setDrawingUploading(false); visionFrameRef.current = null
    if (room?.phase !== 'drawing' || !room.round || room.round.artistId !== playerId) return
    const sync = new DrawingSync(
      `/api/game/rooms/${roomId}/drawing`, () => readRoomSeat(seatKey), room.round.id,
      (hasDrawing, image) => { visionFrameRef.current = image; aiQueueRef.current?.saved(hasDrawing) }, setUploadNote,
      () => { void refresh().catch(() => undefined) }, setDrawingUploading,
    )
    sync.setOnline(navigator.onLine)
    drawingSyncRef.current = sync
    return () => { sync.dispose(); drawingSyncRef.current = null }
  }, [room?.phase, room?.round?.id, room?.round?.artistId, playerId, roomId, seatKey, refresh])

  useEffect(() => {
    if (!room?.round || room.round.artistId === playerId) return
    let cancelled = false
    let version = ''
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    setDrawingImage(null)
    const sync = async () => {
      try {
        if (!navigator.onLine || document.hidden) return
        const { response, data } = await gameRequest<{ drawing?: { image: string; round_id: string; updated_at: number } | null }>(
          `/api/game/rooms/${roomId}/drawing?since=${encodeURIComponent(version)}`,
          { headers: { 'x-game-seat': readRoomSeat(seatKey) || '' }, signal: controller.signal }, 10000,
        )
        if (response.ok && !cancelled && data?.drawing && data.drawing.round_id === room.round?.id) {
          version = `${data.drawing.round_id}:${data.drawing.updated_at}`
          setDrawingImage(data.drawing.image)
        }
      } catch { /* Retain the last shared image while reconnecting. */ }
      finally { if (!cancelled) timer = setTimeout(() => void sync(), document.hidden ? 10000 : 2000) }
    }
    void sync()
    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [room?.round?.id, room?.round?.artistId, playerId, roomId, seatKey])

  const isHost = room?.hostPlayerId === playerId
  const isArtist = room?.round?.artistId === playerId
  useEffect(() => {
    if (room?.phase !== 'lobby') {
      setGuideMode(null)
      return
    }
    if (playerId && !isHost && !guestGuideShownRef.current) {
      guestGuideShownRef.current = true
      setGuideMode('review')
    }
  }, [room?.phase, playerId, isHost])
  const waitingForPlayers = Boolean(room?.waitingForPlayersUntil)
  const waitingSeconds = room?.waitingForPlayersUntil ? Math.max(0, Math.ceil((room.waitingForPlayersUntil - now) / 1000)) : 0
  const secondsLeft = room?.round?.endsAt ? Math.max(0, Math.ceil((room.round.endsAt - now) / 1000)) : room?.turnSeconds ?? 60
  const sortedPlayers = useMemo(() => [...(room?.players ?? [])].sort((a, b) => b.score - a.score), [room?.players])
  const isSoloWithAi = Boolean(room?.aiEnabled && room.players.some(player => player.role === 'ai') && room.players.filter(player => player.role !== 'ai').length === 1)
  const displayedPlayers = isSoloWithAi ? room?.players ?? [] : sortedPlayers
  const hintsRevealed = room?.phase === 'drawing' && !isArtist ? (room.round?.wordHint.match(/[\p{L}\p{N}]/gu)?.length ?? 0) : 0
  const voiceControl = voiceControlCopy(voiceState, Boolean(room?.agora))
  const whiteboardStatus = !room?.whiteboard
    ? { state: 'fallback', detail: '共享画板', label: '画作自动同步给所有玩家' }
    : room.phase === 'lobby'
      ? { state: 'standby', detail: '准备连接', label: '实时画板已准备' }
      : whiteboardReady
        ? { state: 'ready', detail: '已同步', label: '实时画板已连接' }
        : { state: 'loading', detail: '正在连接…', label: '正在连接实时画板' }
  const displayedRounds = optimisticSettings?.rounds ?? room?.roundsTotal ?? 3
  const displayedSeconds = optimisticSettings?.seconds ?? room?.turnSeconds ?? 60
  const aiView = aiResultView(room, aiState)
  const aiThinking = room?.phase === 'drawing' && (isArtist ? aiState === 'thinking' : room.aiPhase === 'thinking')
  const aiStatus = !room?.aiEnabled ? '等待邀请'
    : waitingForPlayers ? '等待玩家回来'
    : aiView.correct ? '我猜对啦！'
    : aiView.settling ? '正在同步猜题结果…'
    : room.phase === 'result' || room.phase === 'finished' ? '本轮猜题已结束'
    : aiState === 'complete' ? '本轮猜题已结束'
    : room.phase !== 'drawing' ? '准备好了，等你开画'
    : aiThinking ? 'AI 正在猜测中…'
    : aiState === 'retrying' ? 'AI 正在重新连接…'
    : aiState === 'failed' ? 'AI 暂时没连上'
    : aiState === 'queued' ? '画面已收到，AI 准备猜测…'
    : drawingUploading ? '正在把画面传给 AI…'
    : aiState === 'watching' || room.aiActivity ? 'AI 已看过画面，继续补充线索吧'
    : '等你画出第一笔'

  const resultInterrupted = room?.round?.endReason === 'artist_left'
  const resultTimedOut = room?.round?.endReason === 'timeout'

  useEffect(() => {
    if (!room || !playerId) return
    const previousHost = previousHostRef.current
    if (previousHost && previousHost !== room.hostPlayerId && room.hostPlayerId === playerId) {
      toast.success('你现在是房主', { description: '上一位房主离开了，由你带大家继续玩。' })
    }
    previousHostRef.current = room.hostPlayerId
  }, [playerId, room?.hostPlayerId])

  useEffect(() => {
    if (!isHost || room?.phase !== 'result' || !room.round?.id) return
    const timer = window.setTimeout(() => { void nextTurn() }, 12_000)
    return () => window.clearTimeout(timer)
  }, [isHost, nextTurn, room?.phase, room?.round?.id])

  useEffect(() => {
    if (!room) return
    const previousPhase = previousPhaseRef.current
    previousPhaseRef.current = room.phase
    if (!soundEnabled) return
    if (room.phase === 'choosing' && previousPhase !== 'choosing' && isArtist) audioRef.current?.play('your-turn')
    if (room.phase === 'result' && previousPhase !== 'result') {
      audioRef.current?.play(room.round?.endReason === 'timeout' ? 'round-end' : 'correct')
    }
    if (room.phase === 'finished' && previousPhase !== 'finished') audioRef.current?.play('celebration')
  }, [isArtist, room?.phase, room?.round?.endReason, soundEnabled])

  useEffect(() => {
    if (!room || !soundEnabled || room.phase !== 'drawing' || !room.round?.id) return
    const cue = countdownCue(secondsLeft)
    const cueKey = `${room.round.id}:${secondsLeft}`
    if (cue === 'none' || lastCountdownRef.current === cueKey) return
    lastCountdownRef.current = cueKey
    audioRef.current?.play(cue)
  }, [room?.phase, room?.round?.id, secondsLeft, soundEnabled])

  const toggleSound = async () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    window.localStorage.setItem('drawguess.sound', String(next))
    if (next) {
      await audioRef.current?.unlock()
      audioRef.current?.play('tick')
    }
  }

  if (loading) return <RoomLoading roomId={roomId} />
  if (!room) return <main className="dg-room-shell dg-join-page"><section className="dg-join-card"><a className="dg-brand" href="/"><span className="dg-brand__mark">✎</span><span>你画<br />AI猜</span></a><span className="dg-eyebrow">加入房间 {roomId.toUpperCase()}</span><h1>取个昵称。<br />一起画点快乐。</h1><label><span>你的昵称</span><input value={joinName} maxLength={24} onChange={(event) => setJoinName(event.target.value)} placeholder="取个你喜欢的昵称" /></label><button className="dg-button dg-button--blue" onClick={() => void join(joinName)}>加入房间 →</button>{error && <p className="dg-form-error">{error}</p>}</section></main>

  return (
    <main className={`dg-room-shell dg-room-shell--active ${room.phase === 'finished' ? 'dg-room-shell--finished' : ''}`}>
      <div className="dg-room-top">
      <div className={`dg-network-status is-${connection}`} role="status" aria-live="polite">
        <span>{connection === 'connected' ? '● 房间已连接' : connection === 'offline' ? '网络已断开，正在等待连接恢复。请保留此页面。' : connection === 'slow' ? '网络有点慢，正在同步房间…' : '房间连接暂时中断，正在自动重连…'}</span>
        {connection !== 'connected' && <button disabled={checkingConnection || connection === 'offline'} onClick={() => void recoverConnection()}>{checkingConnection ? '正在重连…' : '立即重试'}</button>}
      </div>
      <header className="dg-game-header">
        <a className="dg-brand dg-brand--small" href="/" onClick={(event) => void leaveRoom(event)}><span className="dg-brand__mark">✎</span><span>你画<br />AI猜</span></a>
        <div className="dg-game-header__credits" aria-label="技术支持">
          <AgoraCredit compact placement="game_header" />

        </div>
        <div className="dg-room-code"><span>房间</span><strong>{room.id.toUpperCase()}</strong><button onClick={() => void copyInvite()}>复制邀请</button></div>
        <div className="dg-round-word"><span>{room.phase === 'lobby' ? room.aiEnabled ? 'AI 画友已就位' : '等待伙伴加入' : room.phase === 'finished' ? isSoloWithAi ? '灵感碰杯' : '最终积分' : `第 ${room.round?.number ?? 1} / ${room.roundsTotal} 轮`}{hintsRevealed > 0 && <em>提示 +{hintsRevealed}</em>}</span><div className="dg-round-word__topic"><strong>{room.phase === 'finished' ? '本场结束' : room.round?.wordHint ?? '准备好灵感'}</strong>{isArtist && room.phase === 'drawing' && room.round?.secretWord && <DrawingHint key={room.round.id} word={room.round.secretWord} />}</div></div>
        {room.phase === 'finished' ? (
          <a className="dg-header-exit" href="/" aria-label="离开房间并返回首页" aria-disabled={leavePending} aria-busy={leavePending} onClick={(event) => void leaveRoom(event)}>
            <span>{leavePending ? '正在离开…' : '退出房间'}</span>
            {leavePending ? <span className="dg-action-spinner" aria-hidden="true" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5H4v14h5M10 12h10m-4-4 4 4-4 4" /></svg>}
          </a>
        ) : (
          <div className={`dg-timer ${!waitingForPlayers && secondsLeft <= 10 ? 'is-urgent' : ''}`}><span>{waitingForPlayers ? '重连中' : '剩余时间'}</span><strong>{waitingForPlayers ? `00:${String(waitingSeconds).padStart(2, '0')}` : `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`}</strong></div>
        )}
      </header>
      </div>

      {room.phase === 'lobby' ? (
        <section className="dg-lobby">
          <div className="dg-lobby__intro"><span className="dg-eyebrow">房间 {room.id.toUpperCase()}</span><h1>灵感到位，<br />就等你开画。</h1><p>一个人也能开局：你来画，AI 来猜。也可以邀请朋友一起玩，每画完一轮，收下一份小祝福。</p><div className="dg-lobby__actions"><button className="dg-button dg-button--blue" onClick={() => setGuideMode('review')}>新手引导</button><button className="dg-button dg-button--paper" onClick={() => setRulesOpen(true)}>查看玩法</button></div>{isHost && <div className="dg-lobby-settings" aria-busy={Boolean(optimisticSettings)}><div><span>游戏轮数</span>{[1, 3, 5].map((count) => <button key={count} className={displayedRounds === count ? 'is-selected' : ''} aria-pressed={displayedRounds === count} onPointerUp={(event) => event.currentTarget.blur()} disabled={startPending} onClick={() => void updateSettings({ rounds: count, seconds: displayedSeconds })}>{count}</button>)}</div><div><span>每轮时间</span>{[45, 60, 90].map((seconds) => <button key={seconds} className={displayedSeconds === seconds ? 'is-selected' : ''} aria-pressed={displayedSeconds === seconds} onPointerUp={(event) => event.currentTarget.blur()} disabled={startPending} onClick={() => void updateSettings({ rounds: displayedRounds, seconds })}>{seconds}s</button>)}</div></div>}</div>
          <div className="dg-lobby__roster"><div className="dg-panel-title"><span>房间成员</span><strong>{room.players.length}/7</strong></div>{sortedPlayers.map((player) => <div className={`dg-player-row ${player.id === playerId ? 'is-me' : ''}`} key={player.id}><span className="dg-player-avatar">{player.role === 'ai' ? '✦' : player.nickname.slice(0, 1).toUpperCase()}</span><div><strong>{player.nickname}{player.id === playerId ? '（你）' : ''}</strong><span>{player.role === 'ai' ? 'AI 画友' : player.role === 'host' ? player.connected ? '房主' : '房主 · 正在重连…' : player.connected ? '已加入' : '正在重连…'}</span></div><b aria-label={player.connected ? '在线' : '离线'}>{player.role === 'ai' ? 'AI' : player.connected ? '✓' : '…'}</b></div>)}
            {isHost && !room.aiEnabled && <button className="dg-invite-ai" disabled={aiMutationPending} onClick={() => void changeAiPlayer('invite-ai')}><span>✦</span><div><strong>邀请 AI 画友</strong><small>让 AI 和大家一起看画猜题</small></div><b>+</b></button>}
            <button className="dg-roster-copy" onClick={() => void copyInvite()}>
              <span aria-hidden="true">⧉</span>
              <span><strong>复制邀请链接</strong><small>分享房间 {room.id.toUpperCase()}</small></span>
              <b>复制</b>
            </button>
          </div>
          <div className="dg-lobby__start">{isHost ? <button className="dg-start-game" disabled={startPending || Boolean(optimisticSettings)} aria-busy={startPending} onClick={requestStartGame}><span><small>房主操作</small><strong>{startPending ? '正在开始…' : optimisticSettings ? '正在保存设置…' : '开始游戏'}</strong></span><b aria-hidden="true">{startPending ? <span className="dg-action-spinner" /> : '→'}</b></button> : <p className="dg-waiting-host">你已加入，等房主开始游戏…</p>}</div>
        </section>
      ) : room.phase === 'finished' ? (
        <section className={`dg-finished ${isSoloWithAi ? 'dg-finished--solo' : ''}`}>
          <FinishConfetti />
          <header className="dg-finished__heading">
            <span className="dg-eyebrow">{isSoloWithAi ? '你画 AI 猜 · 本场完成' : '本场成绩'}</span>
            <h1>灵感满杯，快乐收工。</h1>
            <p>{sortedPlayers.some((player) => player.score > 0) ? '每一次猜中，都是你和伙伴的默契。' : '这次还没猜中，再画一局吧！'}</p>
          </header>
          {!isSoloWithAi && <div className="dg-finished__scores" aria-label="最终积分">
            {sortedPlayers.map((player, index) => (
              <div className={`dg-finish-row ${index === 0 ? 'is-winner' : ''}`} key={player.id}>
                <span>#{index + 1}</span>
                <div><strong>{player.nickname}</strong><small>{player.role === 'ai' ? 'AI 画友' : player.role === 'host' ? '房主' : '玩家'}</small></div>
                <b aria-label={`${player.score} 分`}><span>{player.score.toLocaleString('en-US')}</span><small>积分</small></b>
              </div>
            ))}
          </div>}
          <div className="dg-finished__actions">{isHost && <button className="dg-button dg-button--yellow" disabled={replayPending} onClick={() => void replayCurrentRoom()}>{replayPending ? '正在准备房间…' : '在这个房间再玩一局'}</button>}<a className="dg-button dg-button--blue" href="/">创建新房间</a></div>
        </section>
      ) : (
        <section className="dg-game-grid">
          <aside className="dg-panel dg-players-panel"><div className="dg-panel-title"><span>{isSoloWithAi ? '画友' : '积分榜'}</span><strong>实时</strong></div>{displayedPlayers.map((player, index) => <div className={`dg-player-row ${player.id === room.round?.artistId ? 'is-artist' : ''} ${!player.connected ? 'is-offline' : ''}`} key={player.id}>{!isSoloWithAi && <span className="dg-player-rank">{index + 1}</span>}<span className="dg-player-avatar">{player.role === 'ai' ? '✦' : player.nickname.slice(0, 1).toUpperCase()}</span><div><strong>{player.nickname}</strong><span>{roomPlayerStatus(player, room.round?.artistId, aiView.correct ? 'correct' : aiView.settling ? 'settling' : room.aiPhase)}</span></div>{!isSoloWithAi && <b>{player.score}</b>}</div>)}</aside>
          <section className="dg-canvas-panel">
            <AgoraGameBoard credentials={room.whiteboard} canDraw={Boolean(!waitingForPlayers && isArtist && room.phase === 'drawing' && secondsLeft > 0)} roundId={room.round?.id ?? ''} remoteImage={drawingImage} sampleEnabled={Boolean(!waitingForPlayers && isArtist && room.phase === 'drawing' && secondsLeft > 0)} onSnapshot={inspectDrawing} onReadyChange={setWhiteboardReady} />
            {room.phase === 'choosing' && isArtist ? <div className="dg-word-picker"><span className={`dg-word-picker__board-status ${whiteboardReady ? 'is-ready' : 'is-loading'}`}>{whiteboardReady ? '✓ 画板已就绪' : '◌ 正在连接画板…'}</span><span className="dg-eyebrow">轮到你作画</span><h2>{selectedTopic ? '正在准备画布…' : '选一个题目'}</h2><div className="dg-word-choices" aria-busy={Boolean(selectedTopic)}>{room.round?.choices?.map((choice) => <button key={choice} className={selectedTopic === choice ? 'is-pending' : ''} disabled={!whiteboardReady || Boolean(selectedTopic)} onClick={() => void chooseTopic(choice)}>{selectedTopic === choice ? <span className="dg-action-spinner dg-topic-spinner" aria-hidden="true" /> : <SketchTopicIcon word={choice} />}<span>{choice}</span></button>)}</div>{selectedTopic && <LoadingCompanion compact label={`正在打开「${selectedTopic}」画布…`} />}</div> : room.phase === 'choosing' ? <div className="dg-word-picker"><div className="dg-loader">✎</div><h2>{playerName(room, room.round?.artistId ?? null)} 正在选题…</h2><small>下一轮马上开始。</small></div> : null}
            {room.phase === 'result' && <div className={`dg-result-overlay ${resultTimedOut || resultInterrupted ? 'is-timeout' : ''}`}><span>{resultInterrupted ? '↗ 画家暂时离开' : resultTimedOut ? '⌛ 时间到，本轮结束' : room.round?.winnerType === 'ai' ? '✦ AI 猜对了' : '✓ 猜对啦'}</span><h2>{resultInterrupted ? '本轮跳过' : resultTimedOut ? room.aiEnabled ? '这次难住 AI 啦！' : '这次没被猜中！' : `${playerName(room, room.round?.winnerId ?? null)} 猜中了！`}</h2><p>{resultInterrupted ? '画家断线了，本轮不计分。' : <>{resultTimedOut && (room.aiEnabled ? 'AI 还没猜中，' : '还没有人猜中，')}本轮题目是 <strong>{room.round?.secretWord}</strong>。</>}</p>{topicForWord(room.round?.secretWord) && <div className="dg-drink-result"><SketchCocktail /><h3>{topicForWord(room.round?.secretWord)?.drink}</h3><p>{topicForWord(room.round?.secretWord)?.blessing}</p><small>{resultTimedOut || resultInterrupted ? '猜没猜中，都值得碰个杯。' : '这一杯，敬刚刚的默契。'}</small></div>}{isHost ? <button className="dg-button dg-button--yellow" disabled={nextTurnPending} onClick={() => void nextTurn()}>{nextTurnPending ? '正在加载…' : (room.round?.number ?? 0) >= room.roundsTotal ? isSoloWithAi ? '完成本场 →' : '查看最终积分' : '下一轮 →'}</button> : <small>下一轮将自动开始…</small>}</div>}
            {waitingForPlayers && <div className="dg-player-shortage" role="status" aria-live="assertive"><span className="dg-eyebrow">游戏暂停</span><h2>等待画家回来。</h2><p>倒计时已暂停，画家回来后就能继续。</p><strong>{waitingSeconds}s</strong></div>}
          </section>
          <aside className="dg-panel dg-chat-panel">
            <div className="dg-panel-title"><span>大家的猜测</span><strong>{room.messages.length}</strong></div>
            <div className="dg-chat-log" aria-live="polite">{room.messages.length === 0 && <p className="dg-empty">还没有人猜，仔细看看画面吧！</p>}{room.messages.map(message => <div className={`dg-chat-message is-${message.correctness}`} key={message.id}><strong>{message.source === 'ai' ? '✦ AI 画友' : playerName(room,message.playerId)}</strong><span>{message.source === 'ai' && message.content === '未知' ? '暂时没看出来，再补几笔吧' : message.content}</span>{message.correctness === 'close' && <em>很接近了！</em>}</div>)}</div>
            <aside className={`dg-ai-race dg-ai-race--sidebar is-${aiThinking ? 'thinking' : room.aiPhase}`} aria-live="polite" aria-busy={aiThinking}><div className="dg-ai-race__head"><span className="dg-ai-race__orb">{aiThinking ? <span className="dg-action-spinner" aria-hidden="true" /> : '✦'}</span><div><b>AI 画友 · 视觉猜题</b><strong>{aiStatus}</strong></div></div>{aiView.activity && <div className="dg-ai-race__candidate"><span>{aiView.correct ? 'AI 猜中的题目' : 'AI 上一次猜测'}</span><strong>{aiView.activity.guess === '未知' ? '还没看出来，再补几笔吧' : `“${aiView.activity.guess}”`}</strong>{aiView.activity.reason && <small>{aiView.activity.reason}</small>}</div>}{aiThinking && <LoadingCompanion compact label="认真看画中…" />}{!aiThinking && drawingUploading && <LoadingCompanion compact label="正在同步画作…" />}{uploadNote && isArtist && <button className="dg-ai-retry" onClick={() => drawingSyncRef.current?.retryNow()}>重新同步画面</button>}{!aiView.correct && !aiView.settling && (aiNote || uploadNote) && <p className="dg-ai-race__note" role="status">{aiNote || uploadNote}</p>}{isArtist && room.phase === 'drawing' && aiState === 'failed' && <button className="dg-ai-retry" onClick={() => aiQueueRef.current?.retry()}>重新猜一次</button>}</aside>
            {!waitingForPlayers && !isArtist && room.phase === 'drawing' && secondsLeft > 0 && <form className="dg-guess-input" onSubmit={event=>{event.preventDefault();void submitGuess()}}><input value={guess} onChange={event=>setGuess(event.target.value)} placeholder="你猜画的是什么？" aria-label="输入你的答案" maxLength={80}/><button type="submit" aria-label="发送答案">↑</button></form>}
          </aside>
        </section>
      )}

      <footer className="dg-game-footer" aria-label="房间控制">
        <div className="dg-footer-realtime" aria-label="实时连接">
          <button
            className={`dg-footer-control dg-footer-control--voice is-${voiceState}`}
            onClick={() => { if (voiceControl.action === 'leave') void disconnectVoice(); else if (voiceControl.action === 'join') void connectVoice() }}
            disabled={voiceControl.action === 'none'}
            aria-pressed={voiceState === 'live'}
            aria-label={`${voiceControl.label}. ${voiceControl.detail}`}
          >
            <span className="dg-footer-control__icon" aria-hidden="true"><ConnectionIcon kind="voice" active={voiceState === 'live'} busy={voiceState === 'joining' || voiceState === 'leaving'} /></span>
            <span><b>{voiceControl.label}</b><small>{voiceControl.detail}</small></span>
          </button>
          <span className={`dg-sync-indicator is-${whiteboardStatus.state}`} role="status" aria-live="polite" aria-label={whiteboardStatus.label} title={whiteboardStatus.label}>
            <span className="dg-sync-indicator__icon" aria-hidden="true"><ConnectionIcon kind="board" /><i /></span><span><b>画板</b><small>{whiteboardStatus.detail}</small></span>
          </span>
        </div>
        <div className="dg-footer-utilities">
          <button className={`dg-footer-icon-button dg-sound-toggle ${soundEnabled ? 'is-on' : 'is-muted'}`} onClick={() => void toggleSound()} aria-label={soundEnabled ? '关闭游戏音效' : '开启游戏音效'} aria-pressed={soundEnabled} title={soundEnabled ? '关闭游戏音效' : '开启游戏音效'}>
            <span aria-hidden="true">{soundEnabled ? '🔊' : '🔇'}</span>
          </button>
          <button className="dg-footer-mini-button dg-footer-mini-button--rules" onClick={() => setRulesOpen(true)} aria-label="怎么玩">
            <span aria-hidden="true">?</span> 玩法
          </button>
          {room.phase !== 'finished' && <a className="dg-footer-mini-button dg-footer-mini-button--leave" href="/" aria-label="离开房间并返回首页" aria-disabled={leavePending} onClick={(event) => void leaveRoom(event)}>
            {leavePending ? '正在离开…' : '退出'} <span aria-hidden="true">↗</span>
          </a>}
        </div>
      </footer>
      {startPending && <div className="dg-start-loading"><section className="dg-start-loading__card" role="status" aria-live="polite"><LoadingCompanion label="正在准备画室…" /><p>{room.phase === 'lobby' ? '正在确认开局，请稍候。' : '开局成功，正在连接画板。'}</p><div className="dg-start-loading__steps"><span className={room.phase !== 'lobby' ? 'is-done' : 'is-active'}>{room.phase !== 'lobby' ? '✓' : '1'} 确认开局</span><i aria-hidden="true">→</i><span className={room.phase !== 'lobby' ? 'is-active' : ''}>2 准备画板</span></div><div className="dg-start-loading__track" role="progressbar" aria-label="正在准备画室"><i /></div></section></div>}
      {error && <div className="dg-toast dg-toast--room" role="alert">{error}<button aria-label="关闭错误提示" onClick={() => setError('')}>×</button></div>}
      {exitDialogOpen && <RoomExitDialog onDecision={resolveRoomLeave} />}
      {guideMode && room.phase === 'lobby' && <GameQuickGuide rounds={displayedRounds} seconds={displayedSeconds} aiEnabled={room.aiEnabled} startOnFinish={guideMode === 'start' && isHost} onClose={() => setGuideMode(null)} onStart={finishStartGuide} />}
      <GameRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      {needsPlayerOpen && <div className="dg-modal-backdrop"><section className="dg-modal dg-start-check" role="dialog" aria-modal="true" aria-labelledby="needs-player-title"><span className="dg-start-check__orb" aria-hidden="true">↗</span><span className="dg-eyebrow">再来一位伙伴就能开始</span><h2 id="needs-player-title">先邀请一位朋友吧。</h2><p>至少需要两位在线玩家，一位作画，一位猜题。AI 画友会和大家一起玩。</p><div className="dg-ai-confirm__rule"><strong>你的画室已经准备好了</strong><span>把邀请链接分享给朋友，等对方加入后就能开始。</span></div><div className="dg-modal-actions"><button className="dg-button dg-button--paper" onClick={() => setNeedsPlayerOpen(false)}>关闭</button><button className="dg-button dg-button--yellow" onClick={async () => { await copyInvite(); setNeedsPlayerOpen(false) }}>复制邀请链接</button></div></section></div>}
    </main>
  )
}
