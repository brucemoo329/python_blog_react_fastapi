import { Recycle } from 'lucide-react'

export default function CampusBrand({ compact = false, inverted = false, className = '' }) {
  return (
    <span className={`campus-brand ${compact ? 'is-compact' : ''} ${inverted ? 'is-inverted' : ''} ${className}`.trim()}>
      <span className="campus-brand__mark" aria-hidden="true"><Recycle /></span>
      <span className="campus-brand__copy">
        <strong>校园集市</strong>
        {!compact ? <small>Campus Pulse</small> : null}
      </span>
    </span>
  )
}
