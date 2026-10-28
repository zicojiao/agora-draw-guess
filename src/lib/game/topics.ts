export const DRAWING_TOPICS = [
 { word:'桃子', emoji:'🍑', drink:'桃桃欢喜', blessing:'愿你的日子像桃子一样，甜一点，再甜一点。' },
 { word:'西瓜', emoji:'🍉', drink:'西瓜假日', blessing:'忙里偷个闲，把今天过成一个小假期。' },
 { word:'苹果', emoji:'🍎', drink:'苹果微甜', blessing:'平平安安，也有小小的惊喜，这样的日子就很好。' },
 { word:'星星', emoji:'⭐', drink:'今晚有星', blessing:'悄悄许个愿吧，愿你期待的好事慢慢发生。' },
 { word:'太阳', emoji:'☀️', drink:'满杯阳光', blessing:'愿今天的好心情，陪你走过接下来的每一天。' },
 { word:'灯泡', emoji:'💡', drink:'一点灵感', blessing:'有了好点子就试试看，说不定惊喜就从这里开始。' },
 { word:'吉他', emoji:'🎸', drink:'夏夜小调', blessing:'愿你有喜欢的歌，也有愿意陪你听歌的人。' },
 { word:'帆船', emoji:'⛵', drink:'一路顺风', blessing:'去想去的地方吧，愿一路有好风，也有好风景。' },
 { word:'桥', emoji:'🌉', drink:'美好相逢', blessing:'很高兴在这里遇见你，愿下次见面也有好事分享。' },
] as const
export function topicForWord(word?: string) { return DRAWING_TOPICS.find(t=>t.word===word) }
