import { describe, expect, it } from 'vitest'
import { createPartnerUrl } from './partner-links'

describe('partner links', () => {
  it('identifies homepage Agora referrals', () => {
    const url = new URL(createPartnerUrl('agora', 'home_header'))

    expect(url.origin).toBe('https://www.agora.io')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: 'agora-draw-guess.vercel.app',
    })
  })


})
