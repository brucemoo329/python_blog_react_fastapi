import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import CampusBrand from './CampusBrand.jsx'
import GlassSurface from './reactbits/GlassSurface.jsx'
import GooeyNav from './reactbits/GooeyNav.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'
import { cn } from '@/lib/utils'

/**
 * ReactBits-style header:
 * - Top of page: two separate GlassSurface liquid-glass pills (left / right)
 * - Scroll down: continuous crossfade into one full-width GlassSurface bar
 * Only active layer receives pointer events (no ghost register clicks).
 */
export default function LandingHeader({
  navItems,
  copy,
  language,
  onLanguageChange,
  isAuthenticated = false,
  onNavigateLogin,
  onEnterMarket,
  onPrimaryAction,
  onScrollToItem,
}) {
  const [merge, setMerge] = useState(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const raw = Math.min(1, Math.max(0, window.scrollY / 140))
      const eased = 1 - (1 - raw) ** 2.2
      setMerge((prev) => (Math.abs(prev - eased) < 0.008 ? prev : eased))
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [])

  const mergedActive = merge > 0.55
  const splitOpacity = Math.max(0, 1 - merge * 1.35)
  const mergedOpacity = Math.max(0, (merge - 0.12) / 0.88)

  const brand = (
    <button type="button" className="landing-brand-button" onClick={() => onScrollToItem(navItems[0])}>
      <CampusBrand inverted />
    </button>
  )

  const nav = (
    <div className="landing-header__nav-slot">
      <GooeyNav items={navItems} onItemChange={onScrollToItem} />
    </div>
  )

  const actions = (
    <div className="landing-header__actions">
      <LanguageSwitcher language={language} onChange={onLanguageChange} className="landing-language-switcher" />
      <button
        type="button"
        className="landing-link-button"
        onClick={isAuthenticated ? onEnterMarket : onNavigateLogin}
      >
        {isAuthenticated ? copy.market : copy.login}
      </button>
      <button type="button" className="landing-solid-button" onClick={onPrimaryAction}>
        {isAuthenticated ? copy.continue : copy.join} <ArrowRight />
      </button>
    </div>
  )

  // Heavier React Bits liquid-glass (stronger frost + distortion)
  const glassFx = {
    borderWidth: 0.09,
    brightness: 62,
    opacity: 0.95,
    blur: 14,
    displace: 1.2,
    backgroundOpacity: 0.28,
    saturation: 1.75,
    distortionScale: -200,
    redOffset: 2,
    greenOffset: 12,
    blueOffset: 22,
    mixBlendMode: 'difference',
  }

  return (
    <header
      className={cn('landing-header', mergedActive ? 'is-merged' : 'is-split')}
      style={{ '--m': merge }}
      data-merge={merge.toFixed(2)}
    >
      {/* —— Split: two GlassSurface pills on sides —— */}
      <div
        className="landing-header__split"
        style={{
          opacity: splitOpacity,
          transform: `translateY(${merge * -4}px) scale(${1 - merge * 0.02})`,
          pointerEvents: mergedActive ? 'none' : 'auto',
          visibility: splitOpacity < 0.02 ? 'hidden' : 'visible',
        }}
        aria-hidden={mergedActive}
      >
        <GlassSurface
          className="landing-header__pill landing-header__pill--left"
          width="auto"
          height={58}
          borderRadius={999}
          {...glassFx}
          backgroundOpacity={0.26}
          style={{ minWidth: 'fit-content' }}
        >
          <div className="landing-header__cluster is-left">
            {brand}
            {nav}
          </div>
        </GlassSurface>

        <GlassSurface
          className="landing-header__pill landing-header__pill--right"
          width="auto"
          height={58}
          borderRadius={999}
          {...glassFx}
          backgroundOpacity={0.26}
          style={{ minWidth: 'fit-content', marginLeft: 'auto' }}
        >
          <div className="landing-header__cluster is-right">{actions}</div>
        </GlassSurface>
      </div>

      {/* —— Merged: one full liquid-glass bar —— */}
      <div
        className="landing-header__merged"
        style={{
          opacity: mergedOpacity,
          transform: `translateY(${(1 - merge) * 8}px) scale(${0.96 + merge * 0.04})`,
          pointerEvents: mergedActive ? 'auto' : 'none',
          visibility: mergedOpacity < 0.02 ? 'hidden' : 'visible',
        }}
        aria-hidden={!mergedActive}
      >
        <GlassSurface
          className="landing-header__glass"
          width="100%"
          height={66}
          borderRadius={22}
          {...glassFx}
          backgroundOpacity={0.32}
          blur={16}
          distortionScale={-210}
          displace={1.4}
        >
          <nav className="landing-header__inner" aria-label="站点导航">
            <div className="landing-header__cluster is-left">
              {brand}
              {nav}
            </div>
            <div className="landing-header__cluster is-right">{actions}</div>
          </nav>
        </GlassSurface>
      </div>
    </header>
  )
}
