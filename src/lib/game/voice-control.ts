export type VoiceControlState = 'off' | 'joining' | 'live' | 'leaving' | 'error'

export function voiceControlCopy(state: VoiceControlState, available: boolean) {
  if (!available) return { label: '语音暂不可用', detail: '语音未连接', icon: '◖', action: 'none' as const }
  if (state === 'joining') return { label: '正在加入语音…', detail: '正在打开麦克风', icon: '…', action: 'none' as const }
  if (state === 'live') return { label: '关闭语音', detail: '麦克风已开启', icon: '×', action: 'leave' as const }
  if (state === 'leaving') return { label: '正在关闭语音…', detail: '正在释放麦克风', icon: '…', action: 'none' as const }
  if (state === 'error') return { label: '重试语音', detail: '连接异常，请重试', icon: '↻', action: 'join' as const }
  return { label: '加入语音', detail: '实时语音聊天', icon: '◖', action: 'join' as const }
}
