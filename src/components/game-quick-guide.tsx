import { useEffect, useRef, useState } from 'react'
import { SketchTopicIcon } from './sketch-topic-icon'
import './game-quick-guide.css'

type Props = {
  rounds: number
  seconds: number
  aiEnabled: boolean
  startOnFinish: boolean
  onClose: () => void
  onStart: () => void
}

export function GameQuickGuide({ rounds, seconds, aiEnabled, startOnFinish, onClose, onStart }: Props) {
  const [step, setStep] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement as HTMLElement | null
    dialog?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  useEffect(() => { headingRef.current?.focus() }, [step])

  const titles = ['三选一，选个想画的', '画笔和小提示，都在这里', aiEnabled ? '你来画，AI 来猜' : '你来画，朋友来猜']
  return <dialog ref={dialogRef} className="dg-guide" aria-labelledby="quick-guide-title" aria-describedby="quick-guide-description" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="dg-guide__top"><span>开画前 · 3 步就会</span><button className="dg-icon-button" onClick={onClose} aria-label="关闭新手引导">×</button></div>
    <div className="dg-guide__settings">本场 <strong>{rounds} 轮</strong><span aria-hidden="true">·</span>每轮 <strong>{seconds} 秒</strong></div>
    <ol className="dg-guide__steps" aria-label="新手引导进度">{['选题目', '动手画', '等猜中'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={step === index ? 'is-current' : step > index ? 'is-done' : ''}><span>{step > index ? '✓' : index + 1}</span>{label}</li>)}</ol>
    <section className="dg-guide__content" key={step}>
      <h2 id="quick-guide-title" ref={headingRef} tabIndex={-1}>{titles[step]}</h2>
      <p id="quick-guide-description">{step === 0 ? '轮到你作画时，从三个题目中选一个。选好后开始计时，用图画表达，别直接写答案哦。' : step === 1 ? '不会画也没关系：顶部「绘画提示」能看简笔画，下方工具栏可以换颜色、调粗细、擦一擦，或清空重画。' : aiEnabled ? '画面会自动同步，AI 会看着你的画猜答案。没猜中就再添几笔，朋友也可以在猜题区输入答案。' : '画面会自动同步，其他玩家可以在猜题区输入答案。没猜中就再添几笔，让大家更容易看懂。'}</p>
      {step === 0 && <div className="dg-guide__choices" role="img" aria-label="选题示例：桃子、太阳、帆船，任选一个"><small>选题示例</small><div>{['桃子', '太阳', '帆船'].map((word, i) => <div key={word} className={i === 0 ? 'is-picked' : ''}><SketchTopicIcon word={word} colored /><strong>{word}</strong>{i === 0 && <span>✓ 选一个就好</span>}</div>)}</div></div>}
      {step === 1 && <div className="dg-guide__board" role="img" aria-label="画板示意：顶部有绘画提示，底部有颜色、粗细、橡皮、撤销和清空工具"><header><strong>桃子</strong><span><SketchTopicIcon word="灯泡" /> 绘画提示 <b>← 看这里</b></span></header><div className="dg-guide__sketch"><SketchTopicIcon word="桃子" colored /><small>画出大概的样子就好</small></div><div className="dg-guide__tools"><span>✎ 画笔</span><div aria-label="颜色"><i style={{ background: '#171a1f' }} /><i style={{ background: '#38bdf8' }} /><i style={{ background: '#ff6b57' }} /><i style={{ background: '#54d6a0' }} /></div><span>● 粗细</span><span>橡皮</span><span>↶ 撤销</span><span>清空</span></div></div>}
      {step === 2 && <><div className="dg-guide__guess"><SketchTopicIcon word="桃子" colored /><span aria-hidden="true">→</span><div><small>{aiEnabled ? '✦ AI 画友' : '你的朋友'}</small><strong>我猜是桃子！</strong></div></div><div className="dg-guide__network"><strong>现场网络可能有点慢</strong><p>{aiEnabled ? 'AI 分析画面需要一点时间，请耐心等一等。可以继续补充线条，不用反复点击或刷新页面。' : '画面同步可能需要一点时间，请耐心等一等，不用反复点击或刷新页面。'}</p></div></>}
    </section>
    <footer className="dg-guide__footer"><p>{startOnFinish ? '看引导时不计时，准备好再开始。' : '看完后回到房间，一起准备开画。'}</p><div><button className="dg-button dg-button--paper" onClick={() => step > 0 ? setStep(step - 1) : onClose()}>{step > 0 ? '上一步' : '返回房间'}</button><button className="dg-button dg-button--blue" onClick={() => step < 2 ? setStep(step + 1) : startOnFinish ? onStart() : onClose()}>{step < 2 ? '下一步 →' : startOnFinish ? '明白了，开始游戏' : '明白了'}</button></div></footer>
  </dialog>
}
