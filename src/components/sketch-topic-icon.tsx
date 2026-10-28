import type { ReactNode } from 'react'
const drawings: Record<string, ReactNode> = {
  桃子: <><path d="M16 11C9 5 4 12 6 20c2 6 10 10 10 10s9-5 10-11c2-9-5-13-10-8Z"/><path d="M16 11c-1-5 2-8 7-7-1 4-3 6-7 7Zm0 3c3 4 2 8 0 12"/></>,
  西瓜: <><path d="M3 12h26c0 12-8 17-13 17S3 23 3 12Z"/><path d="M6 15h20c-1 7-5 11-10 11S7 22 6 15Zm5 3 1 2m8-2-1 2m-3 1v2"/></>,
  苹果: <><path d="M16 11C9 6 4 12 6 20c2 7 6 9 10 7 5 3 10-2 11-9 1-7-6-11-11-7Z"/><path d="M16 11V6m0 3c1-5 4-6 7-5-1 4-3 5-7 5"/></>,
  星星: <path d="m16 3 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z"/>,
  太阳: <><circle cx="16" cy="16" r="7"/><path d="M16 2v4m0 20v4M2 16h4m20 0h4M6 6l3 3m14 14 3 3M26 6l-3 3M9 23l-3 3"/></>,
  灯泡: <><path d="M10 22c0-4-4-5-4-11a10 10 0 0 1 20 0c0 6-4 7-4 11Z"/><path d="M11 26h10m-9 4h8m-7-8V12l3 3 3-3v10"/></>,
  吉他: <><path d="m21 3 5 2-9 14m-1-5c-4-4-8-1-7 3-5 0-8 5-5 9s9 4 11-1c5 2 8-3 4-7Z"/><circle cx="12" cy="22" r="2"/><path d="m24 3 4 3M8 27l3-4"/></>,
  帆船: <><path d="m3 23 4 6h18l4-6Zm13-2V3l11 16H16ZM13 7 4 20h9"/><path d="M2 31c5-3 8 2 14 0s9-2 14 0"/></>,
  桥: <><path d="M3 21h26M8 28V7m16 21V7M2 28h28M3 20l5-13c4 12 12 12 16 0l5 13"/><path d="M12 16v5m4-3v3m4-5v5"/></>,
}
const topicColors: Record<string, string> = {
  桃子: '#c94870', 西瓜: '#16846c', 苹果: '#d1443f',
  星星: '#a76e08', 太阳: '#c87912', 灯泡: '#8b57c3',
  吉他: '#ad6029', 帆船: '#087fae', 桥: '#5669bd',
}
export function SketchTopicIcon({word,className='',colored=false}:{word?:string;className?:string;colored?:boolean}) {
  return <svg className={`dg-sketch-icon ${className}`} style={colored ? { color: topicColors[word || ''] } : undefined} viewBox="0 0 32 34" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawings[word || ''] || drawings.星星}</svg>
}
export function SketchCocktail({className=''}:{className?:string}) {
 return <svg className={`dg-sketch-cocktail ${className}`} viewBox="0 0 64 70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16c1 13 9 22 20 22s19-9 20-22Z" fill="#fff6cb"/><path d="M17 24c4 8 9 12 15 12s13-4 16-12" fill="#ffd84d" stroke="none"/><path d="m34 22 15-18m-17 34v24m-11 3c7-3 15-3 23-1"/><path d="M41 8c-2-5 4-8 8-5m-35 4-4-2m-3 9H3"/><path d="m26 24 6 3m-11-6 3 2" stroke="#d4a22e"/></svg>
}
