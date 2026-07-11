import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import CampusBrand from './CampusBrand.jsx'
import GooeyNav from './reactbits/GooeyNav.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'
import { cn } from '@/lib/utils'

/**
 * ReactBits-style header with continuous scroll morph:
 * m=0  → solid split pills left/right (no liquid glass, no full-width hits)
 * m=0→1 → smooth transition
 * m=1  → single liquid-glass bar
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
      // Smooth ramp over ~140px of scroll (ease-out curve for nicer feel)
      const raw = Math.min(1, Math.max(0, window.scrollY / 140))
      // ease-out cubic so early scroll starts the morph gently
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

  return (
    <header
      className={cn('landing-header', merge > 0.55 ? 'is-merged' : 'is-split')}
      style={{ '--m': merge }}
      data-merge={merge.toFixed(2)}
    >
      {/* Single shell — CSS morphs solid pills → liquid glass via --m */}
      <div className="landing-header__bar" aria-label="站点导航">
        <div className="landing-header__cluster is-left">
          {brand}
          {nav}
        </div>
        <div className="landing-header__cluster is-right">{actions}</div>
      </div>
    </header>
  )
}
