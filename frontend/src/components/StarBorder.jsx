import '@/styles/star-border.css'
import { createElement } from 'react'

export default function StarBorder({
  as: Component = 'button',
  className = '',
  color = 'white',
  speed = '6s',
  thickness = 1,
  children,
  ...rest
}) {
  return createElement(
    Component,
    {
      className: `star-border-container ${className}`,
      style: { padding: `${thickness}px 0`, ...rest.style },
      ...rest,
    },
    <>
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div className="inner-content">{children}</div>
    </>,
  )
}
