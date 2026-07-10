import { motion } from 'motion/react'
import { createElement, useEffect, useMemo, useState } from 'react'
import '../../styles/react-bits-campus.css'

const MotionSpan = motion.span

export default function BlurText({
  text = '',
  delay = 90,
  className = '',
  animateBy = 'words',
  direction = 'bottom',
  as: Component = 'p',
}) {
  const parts = useMemo(() => (animateBy === 'letters' ? text.split('') : text.split(/(\s+)/)), [animateBy, text])
  const [visible, setVisible] = useState(() => (
    typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))
  const [node, setNode] = useState(null)

  useEffect(() => {
    if (!node) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.16 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  const offset = direction === 'top' ? -24 : 24
  return createElement(
    Component,
    { ref: setNode, className: `rb-blur-text ${className}`.trim() },
    parts.map((part, index) => (
      /^\s+$/.test(part)
        ? createElement('span', { key: `space-${index}`, 'aria-hidden': true }, part)
        : createElement(
          MotionSpan,
          {
            key: `${part}-${index}`,
            initial: { filter: 'blur(10px)', opacity: 0, y: offset },
            animate: visible ? { filter: 'blur(0px)', opacity: 1, y: 0 } : undefined,
            transition: { duration: 0.55, delay: (index * delay) / 1000, ease: [0.22, 1, 0.36, 1] },
          },
          part,
        )
    )),
  )
}
