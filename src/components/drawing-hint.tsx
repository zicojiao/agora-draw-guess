import { useRef } from 'react'
import { topicForWord } from '#/lib/game/topics'
import { SketchTopicIcon } from './sketch-topic-icon'

export function DrawingHint({ word }: { word: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  if (!topicForWord(word)) return null

  return <>
    <button className="dg-drawing-hint-button" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 17h6m-5 4h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z" /></svg>
      绘画提示
    </button>
    <dialog ref={dialogRef} className="dg-drawing-hint-dialog" aria-labelledby="drawing-hint-title" onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close() }}>
      <section>
        <button className="dg-icon-button dg-modal__close" aria-label="关闭绘画提示" onClick={() => dialogRef.current?.close()}>×</button>
        <p>绘画提示</p>
        <h2 id="drawing-hint-title">{word}</h2>
        <div className="dg-drawing-hint-sketch" role="img" aria-label={`${word}的简笔画参考`}><SketchTopicIcon word={word} /></div>
        <button className="dg-button dg-button--blue" onClick={() => dialogRef.current?.close()}>继续画画</button>
      </section>
    </dialog>
  </>
}
