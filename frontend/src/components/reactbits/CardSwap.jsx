import React, { Children, cloneElement, forwardRef, isValidElement, useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import '../../styles/react-bits-campus.css'

export const SwapCard = forwardRef(({ className = '', ...props }, ref) => (
  <article ref={ref} {...props} className={`rb-swap-card ${className}`.trim()} />
))
SwapCard.displayName = 'SwapCard'

const makeSlot = (index, distanceX, distanceY, total) => ({
  x: index * distanceX,
  y: -index * distanceY,
  scale: Math.max(0.88, 1 - index * 0.045),
  zIndex: total - index,
})

function placeNow(element, slot, skew) {
  if (!element) return
  gsap.set(element, {
    x: slot.x,
    y: slot.y,
    scale: slot.scale,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: false,
  })
}

export default function CardSwap({
  width = 440,
  height = 330,
  cardDistance = 44,
  verticalDistance = 46,
  delay = 4200,
  pauseOnHover = true,
  onCardClick,
  skewAmount = 3,
  children,
}) {
  const cards = useMemo(() => Children.toArray(children), [children])
  // Card count is the stable identity needed for the element refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refs = useMemo(() => cards.map(() => React.createRef()), [cards.length])
  const orderRef = useRef(Array.from({ length: cards.length }, (_, index) => index))
  const timelineRef = useRef(null)
  const intervalRef = useRef(null)
  const containerRef = useRef(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    orderRef.current = Array.from({ length: cards.length }, (_, index) => index)
    refs.forEach((ref, index) => placeNow(ref.current, makeSlot(index, cardDistance, verticalDistance, refs.length), skewAmount))

    const swap = () => {
      if (pausedRef.current || orderRef.current.length < 2) return
      const [front, ...rest] = orderRef.current
      const frontElement = refs[front]?.current
      if (!frontElement) return

      timelineRef.current?.kill()
      const timeline = gsap.timeline()
      timelineRef.current = timeline
      const exitDistance = Math.min(250, width * 0.42)
      timeline.to(frontElement, {
        x: `+=${exitDistance}`,
        y: '+=18',
        opacity: 0,
        scale: 0.96,
        duration: 0.52,
        ease: 'power2.in',
      })
      timeline.addLabel('promote', '-=0.28')
      rest.forEach((cardIndex, index) => {
        const element = refs[cardIndex]?.current
        const slot = makeSlot(index, cardDistance, verticalDistance, refs.length)
        timeline.set(element, { zIndex: slot.zIndex }, 'promote')
        timeline.to(element, { x: slot.x, y: slot.y, scale: slot.scale, duration: 0.82, ease: 'back.out(1.5)' }, `promote+=${index * 0.07}`)
      })
      const backSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length)
      timeline.set(frontElement, {
        x: backSlot.x,
        y: backSlot.y,
        scale: backSlot.scale,
        opacity: 0,
        zIndex: backSlot.zIndex,
      }, '>-0.06')
      timeline.to(frontElement, { opacity: 1, duration: 0.42, ease: 'power1.out' })
      timeline.call(() => { orderRef.current = [...rest, front] })
    }

    intervalRef.current = window.setInterval(swap, delay)
    const node = containerRef.current
    const pause = () => { pausedRef.current = true; timelineRef.current?.pause() }
    const resume = () => { pausedRef.current = false; timelineRef.current?.play() }
    if (pauseOnHover && node) {
      node.addEventListener('pointerenter', pause)
      node.addEventListener('pointerleave', resume)
    }

    return () => {
      window.clearInterval(intervalRef.current)
      timelineRef.current?.kill()
      if (pauseOnHover && node) {
        node.removeEventListener('pointerenter', pause)
        node.removeEventListener('pointerleave', resume)
      }
    }
  }, [cardDistance, cards.length, delay, pauseOnHover, refs, skewAmount, verticalDistance, width])

  return (
    <div ref={containerRef} className="rb-card-swap" style={{ width, height }}>
      {cards.map((child, index) => (
        isValidElement(child)
          ? cloneElement(child, {
              key: child.key ?? index,
              ref: refs[index],
              style: { width, height, ...(child.props.style || {}) },
              onClick: (event) => {
                child.props.onClick?.(event)
                onCardClick?.(index)
              },
            })
          : child
      ))}
    </div>
  )
}
