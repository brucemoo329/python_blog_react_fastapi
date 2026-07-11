/**
 * In-app message / notification alerts: chime + browser Notification API.
 * Works on desktop and mobile browsers over HTTPS after user grants permission.
 * Note: true background push (app closed) needs Service Worker + Web Push / FCM later.
 */

const PREFS_KEY = 'campus_message_alerts'
const COOLDOWN_MS = 1800

let lastAlertAt = 0
let audioCtx = null

export function getAlertPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      sound: parsed.sound !== false,
      desktop: parsed.desktop !== false,
      vibrate: parsed.vibrate !== false,
    }
  } catch {
    return { sound: true, desktop: true, vibrate: true }
  }
}

export function setAlertPrefs(patch) {
  const next = { ...getAlertPrefs(), ...patch }
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/** Must be called from a user gesture the first time on many browsers. */
export async function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

/** Soft two-tone chime (no external asset). */
export function playMessageSound() {
  if (!getAlertPrefs().sound) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const now = ctx.currentTime
    const tones = [
      { f: 880, t: 0, d: 0.12 },
      { f: 1174.66, t: 0.1, d: 0.18 },
    ]
    tones.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      gain.gain.setValueAtTime(0.0001, now + t)
      gain.gain.exponentialRampToValueAtTime(0.12, now + t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + t)
      osc.stop(now + t + d + 0.02)
    })
  } catch {
    /* ignore autoplay / audio errors */
  }
}

export function vibrateDevice(pattern = [40, 60, 40]) {
  if (!getAlertPrefs().vibrate) return
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {
    /* ignore */
  }
}

/**
 * Show OS / browser notification when permitted.
 * silent:true so we use our own chime (avoids double sound).
 */
export function showDesktopNotification({ title, body, tag, onClick } = {}) {
  if (!getAlertPrefs().desktop) return null
  if (typeof window === 'undefined' || !('Notification' in window)) return null
  if (Notification.permission !== 'granted') return null
  try {
    const notification = new Notification(title || '校园集市', {
      body: body || '你收到一条新消息',
      tag: tag || 'campus-message',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      renotify: true,
      silent: true,
    })
    notification.onclick = () => {
      try {
        window.focus()
      } catch {
        /* ignore */
      }
      onClick?.()
      notification.close()
    }
    window.setTimeout(() => {
      try {
        notification.close()
      } catch {
        /* ignore */
      }
    }, 8000)
    return notification
  } catch {
    return null
  }
}

/**
 * Unified incoming alert: sound + vibrate + desktop notification.
 * @param {{ title?: string, body?: string, tag?: string, onClick?: () => void }} payload
 * @param {{ force?: boolean, skipDesktopWhenFocused?: boolean, skipSoundWhenFocused?: boolean }} options
 */
export function alertIncoming(payload = {}, options = {}) {
  const {
    force = false,
    skipDesktopWhenFocused = true,
    skipSoundWhenFocused = false,
  } = options

  const now = Date.now()
  if (!force && now - lastAlertAt < COOLDOWN_MS) return false
  lastAlertAt = now

  const focused = typeof document !== 'undefined'
    && document.visibilityState === 'visible'
    && (typeof document.hasFocus !== 'function' || document.hasFocus())

  if (!skipSoundWhenFocused || !focused) {
    playMessageSound()
    vibrateDevice()
  } else if (!focused) {
    playMessageSound()
    vibrateDevice()
  }

  if (!(skipDesktopWhenFocused && focused)) {
    showDesktopNotification(payload)
  } else if (!focused) {
    showDesktopNotification(payload)
  }

  return true
}

/** Unlock audio context after first user click (required by browsers). */
export function unlockAudioOnGesture() {
  const unlock = () => {
    try {
      const ctx = getAudioContext()
      if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
    } catch {
      /* ignore */
    }
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock, { once: true, passive: true })
  window.addEventListener('keydown', unlock, { once: true })
}
