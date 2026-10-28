import { useEffect, useState } from 'react'

export function LoadingCompanion({ label, compact = false, slowAfter = 7000 }: { label: string; compact?: boolean; slowAfter?: number }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    setSlow(false)
    const timer = setTimeout(() => setSlow(true), slowAfter)
    return () => clearTimeout(timer)
  }, [label, slowAfter])
  return <div className={`dg-companion ${compact ? 'dg-companion--compact' : ''}`} role="status" aria-live="polite">
    <svg className="dg-companion__cat" viewBox="0 0 140 112" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 97c24-5 68-5 101 0" stroke="#87cde9" />
      <path d="M41 74c-24 17-26-11-15-12" stroke="#e4a53a" strokeWidth="7" />
      <path d="M43 87c-7-18-1-33 13-35h28c18 10 16 25 11 36" fill="#fff2bc" />
      <path d="M39 39 38 13l22 12c8-2 16-2 23 0l21-13-2 29c8 29-13 35-31 35S32 65 39 39Z" fill="#fffdf7" />
      <path d="m44 24 10 8m43-9-10 9" stroke="#f59b96" />
      <g className="dg-companion__eyes"><path d="M55 45v5m30-5v5" /></g>
      <path d="m67 54 4 3 4-3m-4 3c-1 7-8 6-10 3m10-3c1 7 8 6 10 3M34 52l12 2m-12 6 12-2m49-4 12-2m-12 6 12 2" />
      <path d="M53 86h15m10 0h12" />
      <g className="dg-companion__pencil"><path d="m85 85 26-40 9 6-26 40-13 9Z" fill="#ffdd53" /><path d="m108 50 9 6m-32 29 9 6m-13 9 3-8" /><path d="m110 46 3-5c4-5 13 1 9 6l-3 5" fill="#ffaaa1" /></g>
      <path className="dg-companion__line" d="M59 103c13-8 22 5 38-2" stroke="#20a7df" />
      <path d="m17 28 2-6 2 6 6 2-6 2-2 6-2-6-6-2Zm105-9 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill="#75d5fa" stroke="none" />
    </svg>
    <div><strong>{label}</strong>{slow && <small>比平时慢一点，正在继续处理，请稍候。</small>}</div>
  </div>
}
