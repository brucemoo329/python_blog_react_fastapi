/**
 * Browser Geolocation only works in a secure context:
 * - https:// (any host, after cert is accepted)
 * - http://localhost / http://127.0.0.1
 * Plain http://public-ip will never show the permission dialog.
 */

export function isSecureGeolocationContext() {
  if (typeof window === 'undefined') return false
  if (window.isSecureContext) return true
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

export function getGeolocationBlockReason() {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('geolocation' in navigator)) return 'unsupported'
  if (!isSecureGeolocationContext()) return 'insecure'
  return null
}

export function geolocationErrorMessage(reasonOrError, languageHint = 'zh') {
  const isEn = typeof languageHint === 'string' && languageHint.startsWith('en')
  const reason = typeof reasonOrError === 'string'
    ? reasonOrError
    : reasonOrError?.code === 1
      ? 'denied'
      : reasonOrError?.code === 2
        ? 'unavailable'
        : reasonOrError?.code === 3
          ? 'timeout'
          : getGeolocationBlockReason() || 'failed'

  if (reason === 'insecure') {
    return isEn
      ? 'Location needs HTTPS. Open https://this-site (not http) and allow location. Localhost works without HTTPS.'
      : '定位需要 HTTPS 安全连接。请用 https:// 打开本站（不要用 http），并允许位置权限。本地 localhost 可不依赖 HTTPS。'
  }
  if (reason === 'unsupported') {
    return isEn ? 'This browser does not support geolocation.' : '当前浏览器不支持定位功能。'
  }
  if (reason === 'denied') {
    return isEn
      ? 'Location permission denied. Allow it in the browser address bar / site settings.'
      : '定位权限被拒绝。请在浏览器地址栏或站点设置中允许位置权限后重试。'
  }
  if (reason === 'timeout') {
    return isEn ? 'Location timed out. Try outdoors or check network.' : '定位超时，请到信号更好的地方后重试。'
  }
  if (reason === 'unavailable') {
    return isEn ? 'Location unavailable right now.' : '暂时无法获取位置信息。'
  }
  return isEn ? 'Failed to get location.' : '定位失败，请检查权限与网络后重试。'
}

/**
 * Promise wrapper around navigator.geolocation.getCurrentPosition
 * Rejects with { code, message, reason } where reason is insecure|denied|...
 */
export function getBrowserPosition(options = {}) {
  const block = getGeolocationBlockReason()
  if (block) {
    return Promise.reject({ code: 0, reason: block, message: geolocationErrorMessage(block) })
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        const reason = error?.code === 1 ? 'denied' : error?.code === 2 ? 'unavailable' : error?.code === 3 ? 'timeout' : 'failed'
        reject({
          code: error?.code,
          reason,
          message: geolocationErrorMessage(reason),
          original: error,
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
        ...options,
      },
    )
  })
}
