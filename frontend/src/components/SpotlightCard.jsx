import { useRef } from 'react'
import '@/styles/spotlight-card.css'

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(255, 255, 255, 0.25)',
  style,
  ...rest
}) {
  const divRef = useRef(null)

  const handleMouseMove = (event) => {
    if (!divRef.current) return
    const rect = divRef.current.getBoundingClientRect()
    divRef.current.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
    divRef.current.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
    divRef.current.style.setProperty('--spotlight-color', spotlightColor)
  }

  return (
    <div {...rest} ref={divRef} style={style} onMouseMove={handleMouseMove} className={`card-spotlight ${className}`}>
      {children}
    </div>
  )
}
