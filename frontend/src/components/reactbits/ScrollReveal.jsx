import { useEffect, useMemo, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import '../../styles/react-bits-campus.css'

gsap.registerPlugin(ScrollTrigger)

export default function ScrollReveal({
  children,
  className = '',
  baseOpacity = 0.14,
  baseRotation = 2,
  blurStrength = 7,
}) {
  const containerRef = useRef(null)
  const words = useMemo(() => String(children || '').split(/(\s+)/), [children])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return undefined
    const wordNodes = element.querySelectorAll('.rb-scroll-reveal__word')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(element, { rotate: 0 })
      gsap.set(wordNodes, { opacity: 1, filter: 'blur(0px)' })
      return undefined
    }

    const context = gsap.context(() => {
      gsap.fromTo(element, { rotate: baseRotation }, {
        rotate: 0,
        ease: 'none',
        scrollTrigger: { trigger: element, start: 'top 88%', end: 'bottom 62%', scrub: 0.5 },
      })
      gsap.fromTo(wordNodes, { opacity: baseOpacity, filter: `blur(${blurStrength}px)`, y: 10 }, {
        opacity: 1,
        filter: 'blur(0px)',
        y: 0,
        stagger: 0.035,
        ease: 'none',
        scrollTrigger: { trigger: element, start: 'top 86%', end: 'bottom 64%', scrub: 0.55 },
      })
    }, element)

    return () => context.revert()
  }, [baseOpacity, baseRotation, blurStrength])

  return (
    <div ref={containerRef} className={`rb-scroll-reveal ${className}`.trim()}>
      {words.map((word, index) => (
        /^\s+$/.test(word)
          ? word
          : <span className="rb-scroll-reveal__word" key={`${word}-${index}`}>{word}</span>
      ))}
    </div>
  )
}
