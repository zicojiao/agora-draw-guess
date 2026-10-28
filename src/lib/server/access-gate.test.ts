import { describe, expect, it } from 'vitest'
import { accessGate } from './access-gate'

const config = { password: 'test', secret: 'test-only-cookie-signing-key' }
const origin = 'https://example.com'
const now = 1_800_000_000
function request(path = '/', init: RequestInit = {}) { return new Request(origin + path, init) }
async function login(password = config.password, next = '/room/abc123') {
  return (await accessGate(request('/access', {
    method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password, next }),
  }), config, now))!
}

describe('optional access gate', () => {
  it('shows a generic access page without revealing the configured password', async () => {
    for (const path of ['/', '/room/abc123?invite=1']) {
      const response = (await accessGate(request(path), config, now))!
      const html = await response.text()
      expect(response.status).toBe(200)
      expect(html).toContain('访问密码')
      expect(html).toContain('页面不会提示具体内容')
      expect(html).not.toContain('Developer Experience')
      expect(html).not.toContain('4 个小写英文字母')
      expect(html).toContain(`value="${path.replace('&', '&amp;')}"`)
      expect(html).not.toContain(`value="${config.password}"`)
      expect(response.headers.get('cache-control')).toContain('no-store')
    }
  })
  it('blocks unauthenticated APIs and non-GET requests', async () => {
    for (const [path, method] of [['/api/game/rooms/abc123', 'GET'], ['/api/game/rooms', 'POST'], ['/', 'POST']]) {
      const response = (await accessGate(request(path, { method }), config, now))!
      expect(response.status).toBe(401)
      expect(await response.json()).toHaveProperty('error')
    }
  })
  it('rejects the wrong password and shows a useful error without a cookie', async () => {
    const response = await login('nope')
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await response.text()).toContain('密码不对，请再试一次。')
  })
  it('unlocks with a signed secure cookie and returns to the invited room', async () => {
    const response = await login()
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/room/abc123')
    const cookie = response.headers.get('set-cookie')!
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=604800', 'Path=/']) expect(cookie).toContain(flag)
    expect(cookie).not.toContain(config.password)
    for (const path of ['/', '/room/abc123', '/api/game/rooms/abc123']) {
      expect(await accessGate(request(path, { headers: { cookie: cookie.split(';')[0] } }), config, now + 1)).toBeNull()
    }
  })
  it('rejects forged, expired, and old-password cookies', async () => {
    const cookie = (await login()).headers.get('set-cookie')!.split(';')[0]
    expect((await accessGate(request('/', { headers: { cookie: cookie + 'changed' } }), config, now))?.status).toBe(200)
    expect((await accessGate(request('/', { headers: { cookie } }), config, now + 604800))?.status).toBe(200)
    expect((await accessGate(request('/', { headers: { cookie } }), { ...config, password: 'next' }, now))?.status).toBe(200)
  })
  it('keeps redirects on this site and escapes form values', async () => {
    for (const next of ['https://evil.test', '//evil.test', '/\\evil.test', '/access']) {
      expect((await login(config.password, next)).headers.get('location')).toBe('/')
    }
    const response = (await accessGate(request('/access?next=' + encodeURIComponent('/room/abc123?x="/><script>bad</script>&v=1')), config, now))!
    const html = await response.text()
    expect(html).not.toContain('<script>bad</script>')
    expect(html).toContain('%22')
    expect(html).toContain('&amp;v=1')
  })
  it('rejects cross-origin login submissions and oversized bodies', async () => {
    expect((await accessGate(request('/access', { method: 'POST', headers: { origin: 'https://evil.test' } }), config, now))?.status).toBe(403)
    expect((await accessGate(request('/access', { method: 'POST', body: 'x'.repeat(1025) }), config, now))?.status).toBe(413)
  })
  it('stays open when no access password is configured', async () => {
    expect(await accessGate(request(), {}, now)).toBeNull()
    expect(await accessGate(request(), { password: '  ', secret: '  ' }, now)).toBeNull()
  })
  it('fails closed when only one access credential is set', async () => {
    for (const settings of [{ password: config.password }, { secret: config.secret }]) {
      expect((await accessGate(request(), settings, now))?.status).toBe(503)
    }
  })
})
