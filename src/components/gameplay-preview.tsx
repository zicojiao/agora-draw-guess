import { useEffect, useState } from 'react'
import { SketchTopicIcon } from './sketch-topic-icon'

const SCENES = [
  { word: '桃子', src: '/assets/pencil-draw-ai-guess.webp' },
  { word: '太阳', src: '/assets/pencil-ai-sun.webp' },
  { word: '帆船', src: '/assets/pencil-ai-sailboat.webp' },
  { word: '吉他', src: '/assets/pencil-ai-guitar.webp' },
]

export function GameplayPreview() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const [focused, setFocused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(true)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(preference.matches)
    const updateVisibility = () => setVisible(!document.hidden)
    updateMotion()
    updateVisibility()
    preference.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      preference.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  const autoPlaying = !paused && !reducedMotion && !interacting && !focused && visible
  useEffect(() => {
    if (!autoPlaying) return
    const timer = window.setTimeout(() => setActive(index => (index + 1) % SCENES.length), 5000)
    return () => window.clearTimeout(timer)
  }, [active, autoPlaying])

  return (
    <figure className="dg-gameplay-art" aria-label="你来画，AI 来猜：彩铅主题画册" aria-roledescription="轮播"
      onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <div className="dg-gameplay-art__top"><div className="dg-gameplay-art__heading">你来画，AI 来猜</div><span aria-hidden="true">{active + 1} / {SCENES.length}</span></div>
      <div className="dg-gameplay-art__slides">
        {SCENES.map((scene, index) => <img key={scene.word} className={index === active ? 'is-active' : ''} src={scene.src} width="1536" height="1024" alt={`暖色素描纸上，黄色铅笔画出${scene.word}，蓝色 AI 画友说：是${scene.word}！`} aria-hidden={index !== active} fetchPriority={index === 0 ? 'high' : 'low'} decoding="async" />)}
        <button className="dg-gameplay-art__arrow dg-gameplay-art__arrow--previous" type="button" aria-label="上一张主题图片" title="上一张" onClick={() => setActive(index => (index - 1 + SCENES.length) % SCENES.length)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
        <button className="dg-gameplay-art__arrow dg-gameplay-art__arrow--next" type="button" aria-label="下一张主题图片" title="下一张" onClick={() => setActive(index => (index + 1) % SCENES.length)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
      </div>
      <div className="dg-gameplay-art__controls">
        <div className="dg-gameplay-art__topics" role="group" aria-label="切换彩铅主题">{SCENES.map((scene, index) => <button key={scene.word} type="button" aria-label={`查看${scene.word}主题`} aria-pressed={active === index} onClick={() => setActive(index)}><SketchTopicIcon word={scene.word} /><span>{scene.word}</span></button>)}</div>
        {!reducedMotion && <button className="dg-gameplay-art__pause" type="button" aria-label={paused ? '播放主题轮播' : '暂停主题轮播'} onClick={() => setPaused(value => !value)}><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{paused ? <path d="m8 5 11 7-11 7Z" /> : <path d="M6 5h4v14H6Zm8 0h4v14h-4Z" />}</svg></button>}
      </div>
    </figure>
  )
}
