import { useEffect, useState, type CSSProperties } from 'react'

const colors = ['#30b9f3', '#ffda47', '#4dd4a5', '#ff839a', '#7b86ed']
// Stable positions avoid hydration differences and keep room polling from restarting the shower.
const pieces = Array.from({ length: 80 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  color: colors[index % colors.length],
  delay: `${((index * 13) % 18) / 10}s`,
  duration: `${3 + ((index * 7) % 16) / 10}s`,
  drift: `${((index * 29) % 180) - 90}px`,
  rotation: `${(index % 2 ? 1 : -1) * (360 + (index % 5) * 180)}deg`,
}))

export function FinishConfetti() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 6500)
    return () => window.clearTimeout(timeout)
  }, [])
  if (!visible) return null
  return <div className="dg-finish-confetti" aria-hidden="true">
    {pieces.map((piece, index) => <span key={index} className={index % 3 === 0 ? 'is-ribbon' : ''} style={{
      left: piece.left,
      '--confetti-color': piece.color,
      '--confetti-delay': piece.delay,
      '--confetti-duration': piece.duration,
      '--confetti-drift': piece.drift,
      '--confetti-rotation': piece.rotation,
    } as CSSProperties}><i /></span>)}
  </div>
}
