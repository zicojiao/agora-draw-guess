interface Env { DB: D1Database; DATABASE_SERVICE_KEY: string }
export default {
 async fetch(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/query') return new Response('Not found', { status: 404 })
  const supplied = request.headers.get('authorization') || ''
  const encoder = new TextEncoder()
  const [a,b] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(supplied)),crypto.subtle.digest('SHA-256', encoder.encode(`Bearer ${env.DATABASE_SERVICE_KEY}`))])
  const av = new Uint8Array(a), bv = new Uint8Array(b)
  let difference = 0; for (let i=0;i<av.length;i++) difference |= av[i]^bv[i]
  if (!env.DATABASE_SERVICE_KEY || difference) return new Response('Unauthorized', { status: 401 })
  try {
   const body = await request.json() as { statements: { sql: string; params?: (string|number|null)[] }[] }
   if (!Array.isArray(body.statements) || body.statements.length < 1 || body.statements.length > 40) return new Response('Invalid request', {status:400})
   const result = await env.DB.batch(body.statements.map(s=>env.DB.prepare(s.sql).bind(...(s.params??[]))))
   return Response.json(result, {headers:{'cache-control':'no-store'}})
  } catch { return Response.json({error:'Database operation failed'}, {status:500}) }
 }
}
