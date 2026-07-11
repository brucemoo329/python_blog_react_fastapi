import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import CampusBrand from './CampusBrand.jsx'
import GlassSurface from './reactbits/GlassSurface.jsx'
import GooeyNav from './reactbits/GooeyNav.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'

/**
 * ReactBits-style top chrome:
 * - At page top: two glass pills on left / right
 * - On scroll: pills expand and merge into one glass bar
 * Behavior (links, login, language) stays identical.
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
      // Merge over first ~90px of scroll
      const next = Math.min(1, Math.max(0, window.scrollY / 90))
      setMerge((prev) => (Math.abs(prev - next) < 0.01 ? prev : next))
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

  const merged = merge > 0.72
  const brand = (
    <button type="button" className="landing-brand-button" onClick={() => onScrollToItem(navItems[0])}>
      <CampusBrand inverted />
    </button>
  )

  const nav = <GooeyNav items={navItems} onItemChange={onScrollToItem} />

  const actions = (
    <div className="landing-header__actions">
      <LanguageSwitcher language={language} onChange={onLanguageChange} className="landing-language-switcher" />
      <button type="button" className="landing-link-button" onClick={isAuthenticated ? onEnterMarket : onNavigateLogin}>
        {isAuthenticated ? copy.market : copy.login}
      </button>
      <button type="button" className="landing-solid-button" onClick={onPrimaryAction}>
        {isAuthenticated ? copy.continue : copy.join} <ArrowRight />
      </button>
    </div>
  )

  return (
    <header
      className={`landing-header ${merged ? 'is-merged' : 'is-split'}`}
      style={{ '--header-merge': merge }}
      data-merge={merge.toFixed(2)}
    >
      {/* Split mode: left + right glass pills (ReactBits top-of-page) */}
      <div className="landing-header__split" aria-hidden={merged}>
        <GlassSurface
          className="landing-header__pill landing-header__pill--left"
          height={66}
          borderRadius={999}
          backgroundOpacity={0.38}
          blur={20}
        >
          <div className="landing-header__pill-inner is-left">
            {brand}
            <div className="landing-header__pill-nav">{nav}</div>
          </div>
        </GlassSurface>

        <GlassSurface
          className="landing-header__pill landing-header__pill--right"
          height={66}
          borderRadius={999}
          backgroundOpacity={0.38}
          blur={20}
        >
          <div className="landing-header__pill-inner is-right">{actions}</div>
        </GlassSurface>
      </div>

      {/* Merged mode: single glass bar */}
      <div className="landing-header__merged" aria-hidden={!merged}>
        <GlassSurface className="landing-header__glass" height={66} backgroundOpacity={0.4} blur={22} borderRadius={20}>
          <nav className="landing-header__inner" aria-label="站点导航">
            {brand}
            {nav}
            {actions}
          </nav>
        </GlassSurface>
      </div>
    </header>
  )
}
