import { describe, expect, it } from 'vitest'
import { createRandomNickname, suggestedNickname } from './random-nickname'

function sequence(...values: number[]) {
  let index = 0
  return () => values[index++] ?? values.at(-1) ?? 0
}

describe('createRandomNickname', () => {
  it('selects a name from the masculine style', () => {
    expect(createRandomNickname('', sequence(0, 0))).toBe('阿杰')
  })

  it('does not return the same nickname twice in a row', () => {
    expect(createRandomNickname('阿杰', sequence(0, 0))).toBe('阿哲')
  })

  it('offers neutral and feminine styles with equal-sized selection ranges', () => {
    expect(createRandomNickname('', sequence(0.4, 0))).toBe('小满')
    expect(createRandomNickname('', sequence(0.8, 0))).toBe('小夏')
  })

  it('always fits the nickname field', () => {
    for (let index = 0; index < 100; index += 1) {
      expect(createRandomNickname().length).toBeLessThanOrEqual(24)
    }
  })
})

describe('suggestedNickname', () => {
  it('gives new visitors and old test names a suggested nickname', () => {
    for (const stored of [null, '', '画面同步验证', '图标上线验证', '文案', '文案检查', ' 文案检查 ']) {
      expect(suggestedNickname(stored, () => 0)).toBe('阿杰')
    }
  })
  it('refreshes saved suggestions from the retired list', () => {
    for (const stored of ['追风少年', '墨镜阿酷', '橙子同学', '云游画笔', '元气少女', '奶糖小兔']) {
      expect(suggestedNickname(stored, () => 0)).toBe('阿杰')
    }
  })
  it('keeps current suggestions and custom names, including partial QA-label matches', () => {
    for (const name of ['小满', '阿杰', '小夏', '老王', '小陈不加班', '文案小王', 'Alice']) {
      expect(suggestedNickname(name, () => 0)).toBe(name)
    }
  })
})
