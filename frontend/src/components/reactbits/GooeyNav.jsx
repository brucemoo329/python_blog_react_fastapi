import { useEffect, useRef, useState } from 'react'
import '../../styles/react-bits-campus.css'

export default function GooeyNav({
  items = [],
  initialActiveIndex = 0,
  particleCount = 9,
  animationTime = 520,
  onItemChange,
}) {
  const containerRef = useRef(null)
  const listRef = useRef(null)
  const effectRef = useRef(null)
  const timersRef = useRef(new Set())
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex)

  const schedule = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer)
      callback()
    }, delay)
    timersRef.current.add(timer)
  }

  const positionEffect = (element) => {
    if (!containerRef.current || !effectRef.current || !element) return
    const parent = containerRef.current.getBoundingClientRect()
    const rect = element.getBoundingClientRect()
    Object.assign(effectRef.current.style, {
      left: `${rect.left - parent.left}px`,
      top: `${rect.top - parent.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    })
  }

  const makeParticles = () => {
    const effect = effectRef.current
    if (!effect || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    effect.querySelectorAll('.rb-gooey-particle').forEach((particle) => particle.remove())
    for (let index = 0; index < particleCount; index += 1) {
      schedule(() => {
        const particle = document.createElement('span')
        const angle = ((Math.PI * 2) / particleCount) * index
        const distance = 20 + Math.random() * 22
        particle.className = 'rb-gooey-particle'
        particle.style.setProperty('--particle-x', `${Math.cos(angle) * distance}px`)
        particle.style.setProperty('--particle-y', `${Math.sin(angle) * distance}px`)
        particle.style.setProperty('--particle-color', `var(--gooey-color-${(index % 4) + 1})`)
        particle.style.setProperty('--particle-time', `${animationTime + Math.random() * 220}ms`)
        effect.appendChild(particle)
        schedule(() => particle.remove(), animationTime + 300)
      }, index * 16)
    }
  }

  const selectItem = (event, index) => {
    event.preventDefault()
    const element = event.currentTarget.closest('li')
    positionEffect(element)
    setActiveIndex(index)
    makeParticles()
    onItemChange?.(items[index], index)
  }

  useEffect(() => {
    const active = listRef.current?.querySelectorAll('li')[activeIndex]
    positionEffect(active)
    const observer = new ResizeObserver(() => positionEffect(listRef.current?.querySelectorAll('li')[activeIndex]))
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [activeIndex])

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  return (
    <div className="rb-gooey-nav" ref={containerRef}>
      <nav aria-label="介绍页导航">
        <ul ref={listRef}>
          {items.map((item, index) => (
            <li key={item.label} className={activeIndex === index ? 'is-active' : ''}>
              <a href={item.href} onClick={(event) => selectItem(event, index)}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <span className="rb-gooey-effect" ref={effectRef} aria-hidden="true" />
    </div>
  )
}
