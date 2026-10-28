import { createPartnerUrl, type PartnerPlacement } from '../lib/partner-links'

export function AgoraCredit({ compact = false, placement = 'home_header' }: { compact?: boolean; placement?: PartnerPlacement }) {
  return (
    <a
      className={`dg-agora-credit${compact ? ' dg-agora-credit--compact' : ''}`}
      href={createPartnerUrl('agora', placement)}
      target="_blank"
      rel="noreferrer"
      aria-label="Agora RTC and Interactive whiteboard"
    >
      <span className="dg-agora-credit__mark" aria-hidden="true"><img src="/assets/agora-symbol-blue.svg" alt="" width="24" height="24" /></span>
      <span className="dg-agora-credit__copy"><small>实时互动支持</small><strong>Agora RTC<span className="dg-agora-credit__whiteboard"> and Interactive whiteboard</span></strong></span>
      {!compact && <span className="dg-agora-credit__product">+ RTM</span>}
    </a>
  )
}
