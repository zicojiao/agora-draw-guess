import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { siteUrl } from '#/lib/site-config'
import { PwaSupport } from '#/components/pwa-support'
import sonnerCss from 'sonner/dist/styles.css?url'
import appCss from '../draw-and-guess.css?url'
import brandCss from '../brand-icon.css?url'
import sketchBarCss from '../sketch-bar.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet:'utf-8' },
      { name:'viewport',content:'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title:'你画AI猜 · 灵感碰杯' },
      { name:'description',content:'和朋友、AI 画友一起玩中文你画AI猜。画出灵感，猜中快乐，收下一份小祝福。' },
      { name:'theme-color',content:'#38bdf8' },
      { name:'application-name',content:'你画AI猜' },
      { name:'mobile-web-app-capable',content:'yes' },
      { name:'apple-mobile-web-app-capable',content:'yes' },
      { name:'apple-mobile-web-app-title',content:'你画AI猜' },
      { name:'apple-mobile-web-app-status-bar-style',content:'default' },
      { property:'og:title',content:'你画AI猜 · 灵感碰杯' },
      { property:'og:description',content:'朋友一起画，AI 一起猜。九个灵感题目，九份美好祝福。' },
      { property:'og:type',content:'website' },
      { property:'og:locale',content:'zh_CN' },
      { property:'og:image',content:siteUrl('/og-chinese.svg') },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/draw-and-guess-icon.svg' },
      { rel: 'shortcut icon', href: '/favicon.ico' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/favicon-48x48.png' },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-192x192.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'sitemap', type: 'application/xml', href: '/sitemap.xml' },
      { rel: 'stylesheet', href: sonnerCss },
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: brandCss },
      { rel: 'stylesheet', href: sketchBarCss },
    ],
  }),
  notFoundComponent: DrawGuessNotFound,
  shellComponent: RootDocument,
})

function DrawGuessNotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <a className="dg-brand" href="/" aria-label="你画AI猜首页">
          <span className="dg-brand__mark">✎</span><span>你画<br />AI猜</span>
        </a>
        <span className="dg-eyebrow">404 · 画到边界外啦</span>
        <h1>这一页<br />暂时不见了。</h1>
        <p>房间链接可能已过期，请检查房间码或创建新房间。</p>
        <div className="not-found-actions">
          <a href="/">创建房间 →</a>
        </div>
      </section>
    </main>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body suppressHydrationWarning>
        {children}
        <PwaSupport />
        <ClientToaster />
        <Scripts />
      </body>
    </html>
  )
}

function ClientToaster() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? <Toaster position="top-right" closeButton duration={2600} toastOptions={{ className: 'dg-toast-sonner' }} /> : null
}
