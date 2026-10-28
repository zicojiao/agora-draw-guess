import { describe, expect, it } from 'vitest'
import { voiceControlCopy } from './voice-control'

describe('voice room control', () => {
  it('turns the connected state into an explicit leave action', () => {
    expect(voiceControlCopy('live', true)).toEqual({
      label: '关闭语音',
      detail: '麦克风已开启',
      icon: '×',
      action: 'leave',
    })
  })

  it('prevents duplicate actions while joining or leaving', () => {
    expect(voiceControlCopy('joining', true).action).toBe('none')
    expect(voiceControlCopy('leaving', true).action).toBe('none')
  })

  it('offers retry after a connection error and disables unavailable RTC', () => {
    expect(voiceControlCopy('error', true).action).toBe('join')
    expect(voiceControlCopy('off', true)).toMatchObject({ detail: '实时语音聊天', action: 'join' })
    expect(voiceControlCopy('off', false)).toMatchObject({ detail: '语音未连接', action: 'none' })
  })
})
