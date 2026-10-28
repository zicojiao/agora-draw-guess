// Pick a style first so each group has an equal chance, without inferring gender.
const NICKNAME_STYLES = [
  ['阿杰', '阿哲', '阿凯', '阿川', '大鹏', '小宇', '阿航', '阿远', '大林', '小北', '阿东', '阿斌'],
  ['小满', '可乐', '橙子', '豆豆', '七七', '木木', '小麦', '团子', '乐乐', '小白', '阿布', '多多'],
  ['小夏', '小雨', '安安', '小雅', '晓晓', '小棠', '朵朵', '阿宁', '小葵', '小桃', '甜甜', '月月'],
] as const

function randomIndex(length: number, random: () => number) {
  const value = Math.max(0, Math.min(0.999999, random()))
  return Math.floor(value * length)
}

export function createRandomNickname(previous = '', random = Math.random) {
  const names = NICKNAME_STYLES[randomIndex(NICKNAME_STYLES.length, random)]
  let index = randomIndex(names.length, random)
  if (names[index].toLowerCase() === previous.trim().toLowerCase()) {
    index = (index + 1) % names.length
  }
  const nickname = names[index]

  return nickname
}

// Refresh the retired suggestion list and exact QA labels. Do not match parts of custom names.
const RETIRED_NICKNAME_STYLES = [
  ['追风少年', '闪电阿杰', '山野阿川', '阳光阿哲', '逐浪阿航', '酷酷阿凯', '星际阿辰', '热血阿枫', '大力小熊', '疾风小狼', '墨镜阿酷', '灌篮阿飞'],
  ['橙子同学', '灵感玩家', '银河旅人', '山间清风', '海盐苏打', '落日汽水', '星空漫游', '周末画家', '宇宙饭团', '快乐土豆', '自由像素', '云游画笔'],
  ['元气少女', '桃桃小夏', '星光小月', '花间小鹿', '晴天小晴', '樱桃小丸', '月亮小满', '画画小葵', '清风小岚', '甜橙小柚', '软萌小桃子', '奶糖小兔'],
] as const
const DEMO_NAMES = new Set(['画面同步验证', '同步诊断', '同步回归验证', '图标上线验证', '图标样式验证', '选题图标验证', '文案', '文案检查'])
const RETIRED_NAMES = new Set<string>(RETIRED_NICKNAME_STYLES.flat())
export function suggestedNickname(stored: string | null, random = Math.random) {
  const name = stored?.trim() ?? ''
  return !name || DEMO_NAMES.has(name) || RETIRED_NAMES.has(name) ? createRandomNickname(name, random) : name
}
