import { useRef, useState } from 'react'

const copy = {
  zh: {
    label: '声网 RTC × AI 视觉 × 互动游戏',
    title: '让你的每一笔，都有 AI 来猜。',
    intro: '你画AI猜是声网实时互动与 AI 视觉在游戏场景中的应用案例。选一个题目，画出线条；朋友一起看，AI 一起猜。一个人也能开局，猜题之后，收下一杯专属祝福。',
    voiceTitle: '声网实时音频，让画友边画边聊。',
    voice: '加入语音后，Agora RTC 将玩家的麦克风声音实时传给同一房间的伙伴。画面中的线条交给视觉模型识别，玩家之间的交流交给 RTC 连接。麦克风只在你主动加入语音后开启。',
    flowTitle: '从一笔线条，到一次猜中。',
    steps: [
      { verb: '画给大家看', name: '声网互动白板', type: '共享画面 · Whiteboard', body: '画家使用画笔、颜色与橡皮作画，互动白板同步房间中的笔迹。画面有新变化时，浏览器提取画布快照，供 AI 观察。' },
      { verb: '看图猜答案', name: 'AI 视觉语言模型', type: '图像理解 · VLM', body: '模型根据快照中的线条、形状和颜色，用中文给出猜测与视觉依据。模型知道完整的九个候选题目，但不知道玩家本轮选择了哪一个，也不会收到酒名或祝福。' },
      { verb: '同步猜题结果', name: '房间服务 × Agora RTM', type: '游戏状态 · Signaling', body: '服务端校验真人与 AI 的答案，结算得分并推进回合。RTM 通知伙伴刷新房间状态，房间轮询补充同步，让大家看到同一轮的结果。' },
    ],
    details: [
      { tech: 'Canvas · AI Vision', title: '只看你的画，不偷看答案。', body: '画布出现新笔迹后，最新画面会先保存，再交给视觉模型。空白画布不会触发猜题；之前猜过的词作为上下文，帮助 AI 随着新线条继续观察。绘画提示只展示给画家，不会进入共享画面。' },
      { tech: 'React · TanStack Start · Vercel · Cloudflare D1', title: '从选题开画，到碰杯收祝福。', body: '浏览器负责作画和交互，服务端负责房间、回合、倒计时与答案校验，D1 保存游戏记录。每轮揭晓后，展示对应的灵感酒名与祝福；AI 没猜中，也为你的认真创造碰个杯。' },
    ],
    learn: '了解声网 RTC', whiteboard: '了解声网互动白板', back: '返回游戏', close: '关闭实现原理',
    url: 'https://www.shengwang.cn/rtc/',
    whiteboardUrl: 'https://www.shengwang.cn/interactive-whiteboard/',
  },
  en: {
    label: 'Agora RTC × AI Vision × Interactive Games',
    title: 'You draw. AI joins the guessing.',
    intro: 'Draw & Guess brings Agora real-time interaction and AI vision into a drawing game. Pick a topic and start sketching. Friends watch together, and AI guesses alongside them. You can also play solo with AI and receive a drink-themed wish after each round.',
    voiceTitle: 'Real-time audio keeps drawing friends connected.',
    voice: 'When players join voice chat, Agora RTC shares their microphone audio with others in the room. The vision model reads the drawing, while RTC connects the players through voice. Your microphone only turns on when you choose to join voice chat.',
    flowTitle: 'From a first stroke to a correct guess.',
    steps: [
      { verb: 'Share the sketch', name: 'Agora Interactive Whiteboard', type: 'Shared drawing · Whiteboard', body: 'The artist draws with pens, colors, and an eraser. The interactive whiteboard syncs strokes across the room. When the drawing changes, the browser captures a canvas snapshot for AI to inspect.' },
      { verb: 'Guess from the image', name: 'AI Vision-Language Model', type: 'Image understanding · VLM', body: 'The model uses lines, shapes, and colors in the snapshot to return a Chinese guess and a short visual explanation. The model knows the full pool of nine topics, but not which one the artist selected. Drink names and wishes are never sent to the model.' },
      { verb: 'Share the result', name: 'Room Service × Agora RTM', type: 'Game state · Signaling', body: 'The server checks human and AI guesses, awards points, and advances rounds. RTM notifies other players to refresh room state, with polling providing additional updates so everyone follows the same round.' },
    ],
    details: [
      { tech: 'Canvas · AI Vision', title: 'It sees your sketch, not the secret answer.', body: 'New strokes trigger a snapshot that is saved before the vision model reads it. Blank canvases do not trigger guesses. Previous AI guesses provide context as the drawing develops. Drawing references are private to the artist and stay outside the shared canvas.' },
      { tech: 'React · TanStack Start · Vercel · Cloudflare D1', title: 'Draw a round. Raise a glass.', body: 'The browser handles drawing and interaction. The server manages rooms, rounds, timers, and answer checks, while D1 stores game records. Each reveal pairs the topic with a drink name and a wish—even when AI does not guess in time.' },
    ],
    learn: 'Explore Agora RTC', whiteboard: 'Explore Interactive Whiteboard', back: 'Back to game', close: 'Close how it works',
    url: 'https://www.agora.io/en/products/agora-rtc/',
    whiteboardUrl: 'https://www.agora.io/en/products/interactive-whiteboard/',
  },
}

export function ImplementationDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [language, setLanguage] = useState<'zh' | 'en'>('zh')
  const text = copy[language]
  const close = () => dialogRef.current?.close()

  return <>
    <button className="dg-nav-rules dg-nav-implementation" aria-haspopup="dialog" onClick={() => { dialogRef.current?.showModal(); if (dialogRef.current) dialogRef.current.scrollTop = 0 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20" /></svg>
      实现原理
    </button>
    <dialog ref={dialogRef} className="dg-implementation" aria-labelledby="implementation-title" lang={language === 'zh' ? 'zh-CN' : 'en'} onClick={event => { if (event.target === event.currentTarget) close() }}>
      <div className="dg-implementation__shell">
        <header className="dg-implementation__header">
          <p>{text.label}</p>
          <div className="dg-implementation__controls">
            <div className="dg-implementation__languages" role="group" aria-label="说明语言 / Explanation language">
              <button aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中文</button>
              <button aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
            </div>
            <button className="dg-icon-button" aria-label={text.close} onClick={close}>×</button>
          </div>
        </header>
        <div className="dg-implementation__content">
          <h2 id="implementation-title">{text.title}</h2>
          <p className="dg-implementation__intro">{text.intro}</p>
          <section className="dg-implementation__voice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4m-4 0h8" /></svg>
            <div><h3>{text.voiceTitle}</h3><p>{text.voice}</p></div>
          </section>
          <section className="dg-implementation__flow">
            <h3>{text.flowTitle}</h3>
            <ol>{text.steps.map((step, i) => <li key={i}>
              <p className="dg-implementation__step">0{i + 1} / {step.verb}</p>
              <h4>{step.name}</h4><p className="dg-implementation__type">{step.type}</p><p>{step.body}</p>
            </li>)}</ol>
          </section>
          <div className="dg-implementation__details">{text.details.map(detail => <section key={detail.tech}>
            <p className="dg-implementation__tech">{detail.tech}</p><h3>{detail.title}</h3><p>{detail.body}</p>
          </section>)}</div>
        </div>
        <footer className="dg-implementation__footer">
          <a className="dg-button dg-button--blue" href={text.url} target="_blank" rel="noopener noreferrer">{text.learn} <span aria-hidden="true">↗</span></a>
          <a className="dg-button dg-button--yellow" href={text.whiteboardUrl} target="_blank" rel="noopener noreferrer">{text.whiteboard} <span aria-hidden="true">↗</span></a>
          <button className="dg-button dg-button--paper" onClick={close}>{text.back}</button>
        </footer>
      </div>
    </dialog>
  </>
}
