import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'

function pad(n) {
  return String(n).padStart(2, '0')
}

/** Build local datetime-local string: YYYY-MM-DDTHH:mm */
export function toLocalDateTimeValue(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function defaultDesiredTime(hoursAhead = 1) {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + hoursAhead)
  if (d.getHours() >= 23) {
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  }
  return toLocalDateTimeValue(d)
}

function parseValue(value) {
  if (!value) {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: 0 }
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: 0 }
  }
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  }
}

function WheelColumn({ items, value, onChange, label, className }) {
  const listRef = useRef(null)
  const itemH = 36

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const index = Math.max(0, items.findIndex((item) => item.value === value))
    el.scrollTop = index * itemH
  }, [value, items])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const index = Math.round(el.scrollTop / itemH)
    const item = items[Math.min(items.length - 1, Math.max(0, index))]
    if (item && item.value !== value) onChange(item.value)
  }

  return (
    <div className={cn('desired-wheel-col', className)}>
      <span className="desired-wheel-label">{label}</span>
      <div className="desired-wheel-window">
        <div className="desired-wheel-highlight" aria-hidden />
        <div
          ref={listRef}
          className="desired-wheel-list"
          onScroll={onScroll}
        >
          <div className="desired-wheel-spacer" />
          {items.map((item) => (
            <button
              key={`${label}-${item.value}`}
              type="button"
              className={cn('desired-wheel-item', item.value === value && 'is-active')}
              onClick={() => {
                onChange(item.value)
                if (listRef.current) {
                  const index = items.findIndex((x) => x.value === item.value)
                  listRef.current.scrollTo({ top: index * itemH, behavior: 'smooth' })
                }
              }}
            >
              {item.label}
            </button>
          ))}
          <div className="desired-wheel-spacer" />
        </div>
      </div>
    </div>
  )
}

/**
 * Wheel-style picker: year/month/day default to today; user scrolls hour & minute.
 * Emits datetime-local compatible string via onChange(value).
 */
export default function DesiredTimePicker({ value, onChange, className }) {
  const parts = parseValue(value || defaultDesiredTime())
  const today = useMemo(() => new Date(), [])

  const years = useMemo(() => {
    const y = today.getFullYear()
    return [y, y + 1].map((n) => ({ value: n, label: `${n}年` }))
  }, [today])

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
    [],
  )

  const daysInMonth = useMemo(() => new Date(parts.year, parts.month, 0).getDate(), [parts.year, parts.month])
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => ({ value: i + 1, label: `${i + 1}日` })),
    [daysInMonth],
  )
  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ value: i, label: pad(i) })),
    [],
  )
  const minutes = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: pad(i * 5) })),
    [],
  )

  const emit = (next) => {
    const day = Math.min(next.day, new Date(next.year, next.month, 0).getDate())
    const d = new Date(next.year, next.month - 1, day, next.hour, next.minute, 0, 0)
    onChange?.(toLocalDateTimeValue(d))
  }

  // Snap minute to 5-min grid for wheel
  const minuteValue = Math.round(parts.minute / 5) * 5 % 60

  return (
    <div className={cn('desired-time-picker', className)}>
      <div className="desired-time-today">
        默认今天：{today.getFullYear()}年{today.getMonth() + 1}月{today.getDate()}日 · 滚动选择期望送达时刻
      </div>
      <div className="desired-wheel-row">
        <WheelColumn
          label="年"
          items={years}
          value={parts.year}
          onChange={(year) => emit({ ...parts, year, minute: minuteValue })}
        />
        <WheelColumn
          label="月"
          items={months}
          value={parts.month}
          onChange={(month) => emit({ ...parts, month, minute: minuteValue })}
        />
        <WheelColumn
          label="日"
          items={days}
          value={Math.min(parts.day, daysInMonth)}
          onChange={(day) => emit({ ...parts, day, minute: minuteValue })}
        />
        <WheelColumn
          label="时"
          items={hours}
          value={parts.hour}
          onChange={(hour) => emit({ ...parts, hour, minute: minuteValue })}
        />
        <WheelColumn
          label="分"
          items={minutes}
          value={minuteValue}
          onChange={(minute) => emit({ ...parts, minute })}
        />
      </div>
    </div>
  )
}
