import { useNavigate } from '@tanstack/react-router'
import { gameRequest } from '../lib/game/network'
import { LoadingCompanion } from './loading-companion'
import { isGameRoomId } from '../lib/game/model'
import { GameplayPreview } from './gameplay-preview'
import { useEffect, useState } from 'react'
import { AgoraCredit } from './agora-credit'
import { GameRulesDialog } from './game-rules-dialog'
import { ImplementationDialog } from './implementation-dialog'
import { DRAWING_TOPICS } from '../lib/game/topics'
import { SketchCocktail, SketchTopicIcon } from './sketch-topic-icon'
import { createRandomNickname, suggestedNickname } from '../lib/random-nickname'

export function DrawGuessHome() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const name = suggestedNickname(window.localStorage.getItem('drawguess.nickname'))
    setNickname(name)
    window.localStorage.setItem('drawguess.nickname', name)
  }, [])

  const remember = () => {
    const value = nickname.trim().replace(/\s+/g, ' ').slice(0, 24)
    if (!value) { setError('请先输入你的昵称。'); return '' }
    window.localStorage.setItem('drawguess.nickname', value)
    return value
  }
  const createRoom = async () => {
    const name = remember()
    if (!name || busy) return
    setBusy(true); setError('')
    try {
      const { response, data: result } = await gameRequest<{ roomId?: string; seatToken?: string; error?: string }>('/api/game/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nickname: name }) })
      if (!response.ok || !result.roomId || !result.seatToken) throw new Error(result.error || '房间创建失败，请稍后重试。')
      window.sessionStorage.setItem(`drawguess.seat.${result.roomId}`, result.seatToken)
      await navigate({ to: '/room/$roomId', params: { roomId: result.roomId } })
    } catch (caught) { setError(caught instanceof Error ? caught.message : '房间创建失败，请稍后重试。'); setBusy(false) }
  }
  const joinRoom = () => {
    if (!remember()) return
    const code = roomCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!isGameRoomId(code)) { setError('请输入 6 位数字房间号。'); return }
    void navigate({ to: '/room/$roomId', params: { roomId: code } })
  }
  const randomizeNickname = () => {
    setNickname((current) => createRandomNickname(current))
    setError('')
  }

  return (
    <main className="dg-home">
      <nav className="dg-nav">
        <a className="dg-brand" href="/" aria-label="你画AI猜首页"><span className="dg-brand__mark">✎</span><span>你画<br />AI猜</span></a>
        <div className="dg-nav__actions">
          <div className="dg-nav__credits">
            <AgoraCredit placement="home_header" />

          </div>
          <button className="dg-nav-rules" onClick={() => setRulesOpen(true)}><span aria-hidden="true">?</span> 怎么玩</button>
          <ImplementationDialog />
        </div>
      </nav>
      <section className="dg-hero">
        <div className="dg-hero__copy">
          <div className="dg-hero__headline">
            <h1><span>画出灵感，</span><span>碰个好彩头。</span></h1>
          </div>
        </div>
        <div className="dg-hero__play">
          <GameplayPreview />
          <div className="dg-entry-card">
            <div className="dg-entry-heading"><SketchCocktail /><div><span>灵感碰杯 · 等你入座</span><h2>开一桌，画一局</h2></div></div>
            <label>
              <span>你的昵称</span>
              <div className="dg-nickname-field">
                <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={24} placeholder="取个你喜欢的昵称" autoComplete="nickname" />
                <button className="dg-random-name" type="button" onClick={randomizeNickname} aria-label="随机生成昵称" title="随机昵称">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.45" /><circle cx="16" cy="8" r="1.45" /><circle cx="12" cy="12" r="1.45" /><circle cx="8" cy="16" r="1.45" /><circle cx="16" cy="16" r="1.45" /></svg>
                </button>
              </div>
            </label>
            <button className="dg-button dg-button--blue dg-entry-card__create" onClick={createRoom} disabled={busy}>{busy ? <LoadingCompanion compact label="正在创建房间…" /> : <>{error ? '重试创建房间' : '创建房间'} <span aria-hidden="true">→</span></>}</button>
            <div className="dg-entry-card__or"><span>朋友已经开好房间？</span></div>
            <div className="dg-join-row"><input value={roomCode} onChange={(event) => setRoomCode(event.target.value)} maxLength={6} inputMode="numeric" autoComplete="off" enterKeyHint="go" placeholder="输入 6 位数字房间号" aria-label="房间号" onKeyDown={(event) => { if (event.key === 'Enter') joinRoom() }} /><button className="dg-button dg-button--yellow" onClick={joinRoom}>加入</button></div>
            <p className="dg-entry-note">一个人也能玩，AI 画友已经就位。</p>
            {error && <p className="dg-form-error" role="alert">{error}</p>}
          </div>
        </div>
      </section>
      <section className="dg-topic-preview" aria-label="九个作画题目与对应的灵感酒单"><div className="dg-menu-heading"><span>今夜灵感酒单</span><h2>九个题目，九杯好彩头</h2><p>画的是眼前的小事物，收获的是下一次创造的祝福。</p></div><div className="dg-topic-list">{DRAWING_TOPICS.map(topic=><div className="dg-topic-item" key={topic.word}><SketchTopicIcon word={topic.word} colored/><span><strong>{topic.word}</strong><small>{topic.drink}</small></span></div>)}</div></section>
      <section className="dg-how" aria-label="游戏玩法">
        <p><b>01</b><span>创建房间，邀请伙伴</span></p>
        <i aria-hidden="true">→</i>
        <p><b>02</b><span>轮流作画，一起猜题</span></p>
        <i aria-hidden="true">→</i>
        <p><b>03</b><span>AI 猜图，收获祝福</span></p>
      </section>
      <footer className="dg-home-footer"><a href="/terms" target="_blank" rel="noopener noreferrer">使用条款</a><a href="/privacy" target="_blank" rel="noopener noreferrer">隐私说明</a></footer>
      <GameRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </main>
  )
}
