import { useRef } from 'react'
import '../../styles/react-bits-campus.css'

export default function GlassSurface({
  children,
  width = '100%',
  height = 'auto',
  borderRadius = 8,
  blur = 18,
  backgroundOpacity = 0.36,
  saturation = 1.35,
  className = '',
  style = {},
}) {
  const surfaceRef = useRef(null)

  const handlePointerMove = (event) => {
    const surface = surfaceRef.current
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    surface.style.setProperty('--glass-x', `${event.clientX - rect.left}px`)
    surface.style.setProperty('--glass-y', `${event.clientY - rect.top}px`)
  }

  return (
    <div
      ref={surfaceRef}
      className={`rb-glass-surface uses-fallback ${className}`.trim()}
      onPointerMove={handlePointerMove}
      style={{
        ...style,
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: `${borderRadius}px`,
        '--glass-opacity': backgroundOpacity,
        '--glass-saturation': saturation,
        '--glass-blur': `${blur}px`,
      }}
    >
      <div className="rb-glass-content">{children}</div>
    </div>
  )
}
