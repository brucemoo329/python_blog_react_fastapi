import { Globe2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LANGUAGES,
  getLanguageMeta,
  normalizeLang,
  t as translate,
  writeStoredLanguage,
} from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Compact globe language control: 🌐 EN / 中
 * @param {'ghost'|'outline'|'solid'} variant
 * @param {'login'|'topbar'} appearance
 */
export default function LanguageSwitcher({
  language,
  onChange,
  className,
  appearance = 'topbar',
  align = 'end',
}) {
  const lang = normalizeLang(language)
  const meta = getLanguageMeta(lang)
  const t = (key, fallback = '') => translate(lang, key, fallback)

  const pick = (value) => {
    const next = writeStoredLanguage(value)
    onChange?.(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={appearance === 'login' ? 'outline' : 'ghost'}
          size="sm"
          className={cn(
            'lang-switcher',
            appearance === 'login' && 'lang-switcher--login',
            appearance === 'topbar' && 'lang-switcher--topbar',
            className,
          )}
          aria-label={t('lang.switch')}
        >
          <Globe2 className="lang-switcher-globe" />
          <span className="lang-switcher-code">{meta.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="lang-switcher-menu min-w-[11rem]">
        <DropdownMenuLabel>{t('lang.switch')}</DropdownMenuLabel>
        {LANGUAGES.map((item) => (
          <DropdownMenuItem
            key={item.value}
            className={cn(lang === item.value && 'is-active')}
            onClick={() => pick(item.value)}
          >
            <span className="lang-switcher-item-code">{item.short}</span>
            <span>{item.native || item.label}</span>
            {lang === item.value ? <em className="lang-switcher-current">{t('profile.current')}</em> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
