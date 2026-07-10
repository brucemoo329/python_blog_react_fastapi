import { useRef } from 'react'
import '../../styles/react-bits-campus.css'

export default function BorderGlow({
  children,
  className = '',
  backgroundColor = 'rgba(255,255,255,.92)',
  borderRadius = 8,
  colors = ['#5b4ae8', '#0f9f83', '#ff8b5c'],
  animated = false,
}) {
  const cardRef = useRef(null)

  const handlePointerMove = (event) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--glow-x', `${event.clientX - rect.left}px`)
    card.style.setProperty('--glow-y', `${event.clientY - rect.top}px`)
    card.style.setProperty('--glow-opacity', '1')
  }

  return (
    <div
      ref={cardRef}
      className={`rb-border-glow ${animated ? 'is-animated' : ''} ${className}`.trim()}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => cardRef.current?.style.setProperty('--glow-opacity', '0')}
      style={{
        '--glow-bg': backgroundColor,
        '--glow-radius': `${borderRadius}px`,
        '--glow-color-1': colors[0],
        '--glow-color-2': colors[1] || colors[0],
        '--glow-color-3': colors[2] || colors[0],
      }}
    >
      <div className="rb-border-glow__inner">{children}</div>
    </div>
  )
}
