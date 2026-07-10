import * as React from 'react'
import { cva } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

export const liquidbuttonVariants = cva(
  'inline-flex items-center transition-colors justify-center cursor-pointer gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[color,box-shadow,transform] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40',
  {
    variants: {
      variant: {
        default: 'bg-transparent hover:scale-105 duration-300 transition text-primary',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 text-xs gap-1.5 px-4 has-[>svg]:px-4',
        lg: 'h-10 rounded-full px-6 has-[>svg]:px-4',
        xl: 'h-12 rounded-full px-8 has-[>svg]:px-6',
        xxl: 'h-14 rounded-full px-10 has-[>svg]:px-8',
        icon: 'size-9',
        nav: 'h-auto min-h-0 w-full flex-col gap-1 rounded-2xl px-1 py-2 text-[10px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export function GlassFilter({ id = 'container-glass' }) {
  return (
    <svg className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden="true">
      <defs>
        <filter
          id={id}
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="1"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="70"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  )
}

export function LiquidButton({
  className,
  variant,
  size,
  asChild = false,
  children,
  filterId = 'container-glass',
  ...props
}) {
  const Comp = asChild ? (Slot.Root || Slot) : 'button'

  return (
    <Comp
      data-slot="liquid-button"
      className={cn('relative isolate', liquidbuttonVariants({ variant, size, className }))}
      {...props}
    >
      <div
        className="absolute inset-0 z-0 rounded-[inherit] shadow-[0_0_6px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3px_rgba(0,0,0,0.9),inset_-3px_-3px_0.5px_-3px_rgba(0,0,0,0.85),inset_1px_1px_1px_-0.5px_rgba(0,0,0,0.6),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.6),inset_0_0_6px_6px_rgba(0,0,0,0.12),inset_0_0_2px_2px_rgba(0,0,0,0.06),0_0_12px_rgba(255,255,255,0.15)] transition-all dark:shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_-3px_-3px_0.5px_-3.5px_rgba(255,255,255,0.85),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.6),inset_-1px_-1px_1px_-0.5px_rgba(255,255,255,0.6),inset_0_0_6px_6px_rgba(255,255,255,0.12),inset_0_0_2px_2px_rgba(255,255,255,0.06),0_0_12px_rgba(0,0,0,0.15)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit] bg-white/5 dark:bg-white/8"
        style={{ backdropFilter: `url(#${filterId})` }}
        aria-hidden="true"
      />
      <div className="pointer-events-none relative z-10 flex flex-col items-center justify-center gap-1">
        {children}
      </div>
      <GlassFilter id={filterId} />
    </Comp>
  )
}

/** Full-width liquid glass shell for mobile bottom navigation. */
export function LiquidGlassBar({ className, children, filterId = 'mobile-nav-glass' }) {
  return (
    <div
      data-slot="liquid-glass-bar"
      className={cn(
        'relative isolate overflow-hidden rounded-t-[28px] border border-white/10 border-b-0 bg-white/8 shadow-[0_-8px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl dark:bg-zinc-950/35',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-90"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 28%, rgba(124,92,255,0.08) 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backdropFilter: `url(#${filterId})` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent"
        aria-hidden="true"
      />
      <div className="relative z-10">{children}</div>
      <GlassFilter id={filterId} />
    </div>
  )
}

export default LiquidButton
