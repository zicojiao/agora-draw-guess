import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '#/components/legal-page'
export const Route=createFileRoute('/terms')({component:()=> <LegalPage eyebrow="使用条款" title="一起画点快乐。" updated="2026 年 10 月 19 日"><h2>友善参与</h2><p>这是一个与朋友和 AI 一起玩的绘画游戏。请尊重其他玩家，不上传违法、侵权或包含他人隐私的内容。房间邀请链接应仅分享给你希望邀请的人。</p><h2>公平猜题</h2><p>画家用图形表达题目，请不要直接写出答案。AI 根据共享画面猜测，可能猜错；先猜对的真人或 AI 获得积分，画家获得协作积分。</p><h2>服务与祝福</h2><p>网络或第三方服务中断时，房间、语音或 AI 识图可能暂时不可用。游戏中的酒名和出单祝福仅为活动展示，不代表购买、兑奖或出单承诺。</p></LegalPage>})
