import AMapLoader from '@amap/amap-jsapi-loader'
import { getGeolocationBlockReason, geolocationErrorMessage } from '@/lib/geolocation'

let amapPromise

export function loadAMap() {
  const key = import.meta.env.VITE_AMAP_KEY
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_CODE

  if (!key || !securityJsCode) {
    return Promise.reject(new Error('缺少高德地图环境变量配置'))
  }

  window._AMapSecurityConfig = { securityJsCode }

  if (!amapPromise) {
    amapPromise = AMapLoader.load({
      key,
      version: '2.0',
      plugins: [
        'AMap.Geolocation',
        'AMap.CitySearch',
        'AMap.Geocoder',
        'AMap.Scale',
        'AMap.ToolBar',
      ],
    })
  }

  return amapPromise
}

/**
 * Create AMap.Geolocation with browser + IP fallback.
 * Precise GPS needs HTTPS; IP city-level may still work on HTTP.
 */
export function createAMapGeolocation(AMap, overrides = {}) {
  const insecure = getGeolocationBlockReason() === 'insecure'
  return new AMap.Geolocation({
    // Prefer browser GPS when secure; still allow IP fallback when it fails.
    enableHighAccuracy: !insecure,
    timeout: insecure ? 8000 : 12000,
    maximumAge: 0,
    convert: true,
    showButton: false,
    showMarker: false,
    showCircle: !insecure,
    panToLocation: true,
    zoomToAccuracy: true,
    // 0 = allow IP locate when browser geolocation fails / is blocked
    noIpLocate: 0,
    ...overrides,
  })
}

export function describeAMapLocateResult(status, result) {
  if (status === 'complete' && result?.position) {
    const address = result.formattedAddress
      || result.addressComponent?.district
      || result.addressComponent?.city
      || '当前位置'
    const viaIp = String(result.location_type || result.type || '').toLowerCase().includes('ip')
      || result.isConverted === false && getGeolocationBlockReason() === 'insecure'
    return {
      ok: true,
      position: [result.position.lng, result.position.lat],
      address,
      approximate: Boolean(viaIp) || getGeolocationBlockReason() === 'insecure',
      raw: result,
    }
  }

  const message = result?.message || result?.info || ''
  if (getGeolocationBlockReason() === 'insecure') {
    return {
      ok: false,
      message: geolocationErrorMessage('insecure'),
      raw: result,
    }
  }
  if (/denied|PERMISSION/i.test(message)) {
    return { ok: false, message: geolocationErrorMessage('denied'), raw: result }
  }
  if (/timeout|TIMEOUT/i.test(message)) {
    return { ok: false, message: geolocationErrorMessage('timeout'), raw: result }
  }
  return {
    ok: false,
    message: message ? `定位失败：${message}` : geolocationErrorMessage('failed'),
    raw: result,
  }
}
