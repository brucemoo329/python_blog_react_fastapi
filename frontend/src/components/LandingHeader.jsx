import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import CampusBrand from './CampusBrand.jsx'
import GlassSurface from './reactbits/GlassSurface.jsx'
import GooeyNav from './reactbits/GooeyNav.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'
import { cn } from '@/lib/utils'

/**
 * ReactBits-style chrome (single DOM layer — no ghost hit targets):
 * - Page top: solid pills on left / right only (NOT liquid glass)
 * - Scrolled: one liquid-glass bar; same buttons, layout merges
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
  const [merged, setMerged] = useState(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      // Stay solid until user scrolls a bit, then merge to glass
      setMerged(window.scrollY > 56)
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

  const shell = (
    <div className="landing-header__shell">
      <div className="landing-header__cluster is-left">
        {brand}
        {nav}
      </div>
      <div className="landing-header__cluster is-right">{actions}</div>
    </div>
  )

  return (
    <header className={cn('landing-header', merged ? 'is-merged' : 'is-split')}>
      {merged ? (
        <GlassSurface
          className="landing-header__glass"
          height={66}
          backgroundOpacity={0.42}
          blur={22}
          borderRadius={20}
        >
          {shell}
        </GlassSurface>
      ) : (
        // Solid split pills — no GlassSurface / no full-width hit area
        shell
      )}
    </header>
  )
}
