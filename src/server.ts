import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { accessGate } from './lib/server/access-gate'

export default createServerEntry({
  async fetch(request, options) {
    const blocked = await accessGate(request)
    if (blocked) return blocked
    const response = await handler.fetch(request, options)
    response.headers.set('cache-control', 'private, no-store')
    return response
  },
})
