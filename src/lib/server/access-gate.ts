import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { accessPage } from './access-page'

const TTL = 7 * 24 * 60 * 60
const COOKIE = 'draw_guess_access'
type AccessConfig = { password?: string; secret?: string }

function equal(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}

function signature(expires: string, config: AccessConfig) {
  return createHmac('sha256', config.secret!).update(`draw-guess:${expires}:${config.password}`).digest('base64url')
}

function unlocked(request: Request, config: AccessConfig, now: number) {
  const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!cookie) return false
  const [expires, signed, extra] = cookie.split('.')
  if (!expires || !signed || extra || !/^\d+$/.test(expires)) return false
  const expiry = Number(expires)
  return expiry > now && expiry <= now + TTL && equal(signed, signature(expires, config))
}

function destination(value: string | null, origin: string) {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  const url = new URL(value, origin)
  if (url.origin !== origin || url.pathname === '/access') return '/'
  return `${url.pathname}${url.search}`
}

export async function accessGate(request: Request, config: AccessConfig = {
  password: process.env.ACCESS_PASSWORD,
  secret: process.env.ACCESS_COOKIE_SECRET,
}, now = Math.floor(Date.now() / 1000)): Promise<Response | null> {
  const password = config.password?.trim() ?? ''
  const secret = config.secret?.trim() ?? ''
  if (!password && !secret) return null
  const active = { password, secret }
  const url = new URL(request.url)
  const headers = new Headers({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' })
  if (!password || !secret) {
    return new Response('访问入口暂时未就绪，请稍后再试。', { status: 503, headers })
  }
  if (url.pathname === '/access' && request.method === 'POST') {
    if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) {
      return new Response('请从本站输入访问密码。', { status: 403, headers })
    }
    if (Number(request.headers.get('content-length')) > 1024) return new Response(null, { status: 413, headers })
    const text = await request.text()
    if (text.length > 1024) return new Response(null, { status: 413, headers })
    const form = new URLSearchParams(text)
    const next = destination(form.get('next'), url.origin)
    if (!equal(form.get('password') ?? '', active.password)) return page(next, true, 401, headers)
    const expires = String(now + TTL)
    headers.set('set-cookie', `${COOKIE}=${expires}.${signature(expires, active)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL}${url.protocol === 'https:' ? '; Secure' : ''}`)
    headers.set('location', next)
    return new Response(null, { status: 303, headers })
  }
  if (unlocked(request, active, now)) {
    if (url.pathname === '/access') {
      headers.set('location', destination(url.searchParams.get('next'), url.origin))
      return new Response(null, { status: 303, headers })
    }
    return null
  }
  if (url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method)) {
    headers.set('content-type', 'application/json; charset=utf-8')
    return new Response(JSON.stringify({ error: '请先输入访问密码，再进入游戏。' }), { status: 401, headers })
  }
  const next = url.pathname === '/access' ? destination(url.searchParams.get('next'), url.origin) : `${url.pathname}${url.search}`
  const response = page(next, false, 200, headers)
  return request.method === 'HEAD' ? new Response(null, { headers: response.headers }) : response
}

function page(next: string, error: boolean, status: number, headers: Headers) {
  headers.set('content-type', 'text/html; charset=utf-8')
  headers.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  return new Response(accessPage(next, error), { status, headers })
}
