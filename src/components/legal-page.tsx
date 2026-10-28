import type { ReactNode } from 'react'

export function LegalPage({ eyebrow, title, updated, children }: {
  eyebrow: string
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main className="dg-legal-page">
      <article className="dg-legal-shell">
        <header className="dg-legal-header">
          <a className="dg-brand dg-brand--small" href="/" aria-label="你画AI猜首页">
            <span className="dg-brand__mark" aria-hidden="true">✎</span>
            <span>你画<br />AI猜</span>
          </a>
          <a className="dg-button dg-button--yellow dg-legal-play" href="/">创建房间 <span aria-hidden="true">→</span></a>
        </header>

        <div className="dg-legal-hero">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>更新日期 {updated}</span>
        </div>

        <div className="dg-legal-content">{children}</div>

        <footer className="dg-legal-footer">
          <a href="/">返回你画AI猜首页</a>
          <nav aria-label="相关说明">
            <a href="/privacy">隐私说明</a>
            <a href="/terms">使用条款</a>
          </nav>
        </footer>
      </article>
    </main>
  )
}
