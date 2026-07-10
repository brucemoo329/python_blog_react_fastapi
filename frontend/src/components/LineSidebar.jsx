import { useCallback, useEffect, useRef, useState } from 'react'
import '@/styles/line-sidebar.css'

const FALLOFF_CURVES = {
  linear: (p) => p,
  smooth: (p) => p * p * (3 - 2 * p),
  sharp: (p) => p * p * p,
}

export default function LineSidebar({
  items,
  accentColor = '#2dd4bf',
  textColor = '#cbd5e1',
  markerColor = '#64748b',
  showIndex = true,
  showMarker = true,
  proximityRadius = 100,
  maxShift = 24,
  falloff = 'smooth',
  markerLength = 48,
  markerGap = 0,
  tickScale = 0.5,
  scaleTick = true,
  itemGap = 16,
  fontSize = 0.98,
  smoothing = 100,
  defaultActive = null,
  onItemClick,
  className = '',
}) {
  const listRef = useRef(null)
  const itemRefs = useRef([])
  const targetsRef = useRef([])
  const activeRef = useRef(defaultActive)
  const [activeIndex, setActiveIndex] = useState(defaultActive)

  const applyEffects = useCallback(() => {
    for (let i = 0; i < itemRefs.current.length; i += 1) {
      const el = itemRefs.current[i]
      if (!el) continue
      const effect = Math.max(targetsRef.current[i] || 0, activeRef.current === i ? 0.44 : 0)
      el.style.setProperty('--effect', effect.toFixed(4))
    }
  }, [])

  const handlePointerMove = useCallback((event) => {
    const list = listRef.current
    if (!list) return
    const rect = list.getBoundingClientRect()
    const pointerY = event.clientY - rect.top
    const ease = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear
    for (let i = 0; i < itemRefs.current.length; i += 1) {
      const el = itemRefs.current[i]
      if (!el) continue
      const center = el.offsetTop + el.offsetHeight / 2
      const distance = Math.abs(pointerY - center)
      targetsRef.current[i] = ease(Math.max(0, 1 - distance / proximityRadius))
    }
    applyEffects()
  }, [applyEffects, falloff, proximityRadius])

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = targetsRef.current.map(() => 0)
    applyEffects()
  }, [applyEffects])

  const handleClick = useCallback((index, label) => {
    setActiveIndex(index)
    onItemClick?.(index, label)
  }, [onItemClick])

  useEffect(() => {
    setActiveIndex(defaultActive)
  }, [defaultActive])

  useEffect(() => {
    activeRef.current = activeIndex
    applyEffects()
  }, [activeIndex, applyEffects])

  return (
    <nav
      className={`line-sidebar${showMarker ? ' line-sidebar--markers' : ''}${scaleTick ? ' line-sidebar--scale-tick' : ''}${className ? ` ${className}` : ''}`}
      style={{
        '--accent-color': accentColor,
        '--text-color': textColor,
        '--marker-color': markerColor,
        '--marker-length': `${markerLength}px`,
        '--marker-gap': `${markerGap}px`,
        '--tick-scale': tickScale,
        '--max-shift': `${maxShift}px`,
        '--item-gap': `${itemGap}px`,
        '--font-size': `${fontSize}rem`,
        '--smoothing': `${smoothing}ms`,
      }}
    >
      <ul ref={listRef} className="line-sidebar__list" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
        {items.map((label, index) => (
          <li
            key={`${label}-${index}`}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            className="line-sidebar__item"
            aria-current={activeIndex === index ? 'true' : undefined}
            onClick={() => handleClick(index, label)}
          >
            {showMarker && <span className="line-sidebar__marker" aria-hidden="true" />}
            <span className="line-sidebar__label">
              {showIndex && <span className="line-sidebar__index">{String(index + 1).padStart(2, '0')}</span>}
              <span className="line-sidebar__text">{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  )
}
