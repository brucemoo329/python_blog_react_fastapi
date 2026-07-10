import { useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Fullscreen image viewer for product/feed photos.
 * Note: stored images may already be client-compressed; this shows the full
 * uploaded asset at natural size without card/thumbnail cropping.
 */
export default function ImageLightbox({ images = [], index = 0, open, onClose, onIndexChange }) {
  const list = (images || []).filter(Boolean)
  const current = list[index] || null
  const hasMultiple = list.length > 1

  const go = useCallback((next) => {
    if (!list.length) return
    const value = (next + list.length) % list.length
    onIndexChange?.(value)
  }, [list.length, onIndexChange])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
      if (event.key === 'ArrowLeft') go(index - 1)
      if (event.key === 'ArrowRight') go(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, go, index])

  if (!open || !current) return null

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="查看大图" onClick={onClose}>
      <div className="image-lightbox-toolbar" onClick={(event) => event.stopPropagation()}>
        <span><ZoomIn /> 大图预览 {hasMultiple ? `${index + 1} / ${list.length}` : ''}</span>
        <button type="button" onClick={onClose} aria-label="关闭"><X /></button>
      </div>

      {hasMultiple ? (
        <button
          type="button"
          className="image-lightbox-nav is-prev"
          aria-label="上一张"
          onClick={(event) => { event.stopPropagation(); go(index - 1) }}
        >
          <ChevronLeft />
        </button>
      ) : null}

      <div className="image-lightbox-stage" onClick={(event) => event.stopPropagation()}>
        <img src={current} alt={`商品图片 ${index + 1}`} />
      </div>

      {hasMultiple ? (
        <button
          type="button"
          className="image-lightbox-nav is-next"
          aria-label="下一张"
          onClick={(event) => { event.stopPropagation(); go(index + 1) }}
        >
          <ChevronRight />
        </button>
      ) : null}

      {hasMultiple ? (
        <div className="image-lightbox-thumbs" onClick={(event) => event.stopPropagation()}>
          {list.map((src, i) => (
            <button
              key={`${src.slice(0, 24)}-${i}`}
              type="button"
              className={cn(i === index && 'is-active')}
              onClick={() => onIndexChange?.(i)}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
