export function ConnectionIcon({ kind, active = false, busy = false }: { kind: 'voice' | 'board'; active?: boolean; busy?: boolean }) {
  return (
    <svg className={`dg-connection-icon${busy ? ' is-busy' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {busy ? <path d="M20 12a8 8 0 1 1-5.5-7.6" /> : kind === 'voice' ? <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M9 21h6" />
        {active && <path d="M3 9v5M21 9v5" />}
      </> : <>
        <path d="M13 4H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M8 22l2-4m4 0 2 4M7 22h10" />
        <path d="m12 10 7-7 2 2-7 7-3 1 1-3ZM17 5l2 2M7 14h6" />
      </>}
    </svg>
  )
}
