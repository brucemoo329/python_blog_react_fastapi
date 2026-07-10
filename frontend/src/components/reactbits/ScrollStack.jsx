import { Children, cloneElement, isValidElement } from 'react'
import '../../styles/react-bits-campus.css'

export function ScrollStackItem({ children, className = '', style = {} }) {
  return <article className={`rb-scroll-stack__item ${className}`.trim()} style={style}>{children}</article>
}

export default function ScrollStack({ children, className = '' }) {
  const items = Children.toArray(children)
  return (
    <div className={`rb-scroll-stack ${className}`.trim()}>
      {items.map((child, index) => (
        isValidElement(child)
          ? cloneElement(child, {
              key: child.key ?? index,
              style: {
                '--stack-index': index,
                '--stack-count': items.length,
                ...(child.props.style || {}),
              },
            })
          : child
      ))}
    </div>
  )
}
