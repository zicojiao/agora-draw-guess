import { useEffect, useRef } from 'react'
import './room-exit-dialog.css'

export function RoomExitDialog({ onDecision }: { onDecision: (leave: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const stayRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    dialog?.showModal()
    stayRef.current?.focus()
    return () => {
      dialog?.close()
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  return <dialog ref={dialogRef} className="dg-exit-dialog" aria-labelledby="room-exit-title" aria-describedby="room-exit-description" onCancel={event => { event.preventDefault(); onDecision(false) }}>
    <button className="dg-icon-button dg-exit-dialog__close" aria-label="取消退出" onClick={() => onDecision(false)}>×</button>
    <div className="dg-exit-dialog__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H4v14h5M10 12h10m-4-4 4 4-4 4" /></svg></div>
    <h2 id="room-exit-title">要退出房间吗？</h2>
    <p id="room-exit-description">误点了？选择「继续游戏」就能留在房间。</p>
    <div className="dg-exit-dialog__actions"><button ref={stayRef} className="dg-button dg-button--blue" onClick={() => onDecision(false)}>继续游戏</button><button className="dg-button dg-exit-dialog__leave" onClick={() => onDecision(true)}>退出房间 <span aria-hidden="true">↗</span></button></div>
  </dialog>
}
