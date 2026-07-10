import AMapLoader from '@amap/amap-jsapi-loader'
import { getGeolocationBlockReason, geolocationErrorMessage } from '@/lib/geolocation'

let amapPromise

export function loadAMap() {
  const key = import.meta.env.VITE_AMAP_KEY
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_CODE

  if (!key || !securityJsCode) {
    return Promise.reject(new Error('缺少高德地图环境变量配置（VITE_AMAP_KEY / VITE_AMAP_SECURITY_CODE）'))
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
        'AMap.Driving',
        'AMap.Walking',
        'AMap.Riding',
        'AMap.PlaceSearch',
      ],
    })
  }

  return amapPromise
}

export function createAMapGeolocation(AMap, overrides = {}) {
  const insecure = getGeolocationBlockReason() === 'insecure'
  return new AMap.Geolocation({
    enableHighAccuracy: !insecure,
    timeout: insecure ? 8000 : 12000,
    maximumAge: 0,
    convert: true,
    showButton: false,
    showMarker: false,
    showCircle: !insecure,
    panToLocation: true,
    zoomToAccuracy: true,
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
    return {
      ok: true,
      position: [result.position.lng, result.position.lat],
      address,
      approximate: getGeolocationBlockReason() === 'insecure',
      raw: result,
    }
  }
  const message = result?.message || result?.info || ''
  if (getGeolocationBlockReason() === 'insecure') {
    return { ok: false, message: geolocationErrorMessage('insecure'), raw: result }
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

/** Haversine distance in meters */
export function distanceMeters(a, b) {
  if (!a || !b || a[0] == null || b[0] == null) return null
  const toRad = (d) => (d * Math.PI) / 180
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(x)))
}

export function suggestTravelMode(meters) {
  if (meters == null) return 'ride'
  if (meters < 1200) return 'walk'
  if (meters < 6000) return 'ride'
  return 'drive'
}

function withTimeout(promise, ms, label = '操作') {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`${label}超时，请检查网络后重试`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer))
}

/** Known campus coords fallback when geocode is slow/unavailable. */
const SCHOOL_FALLBACKS = {
  南通理工学院: [120.809261, 32.041042],
  南通理工学院南通校区: [120.809261, 32.041042],
  南通理工学院海安校区: [120.4675, 32.5458],
}

export function schoolFallbackLngLat(schoolName) {
  if (!schoolName) return SCHOOL_FALLBACKS['南通理工学院']
  if (SCHOOL_FALLBACKS[schoolName]) return SCHOOL_FALLBACKS[schoolName]
  const hit = Object.keys(SCHOOL_FALLBACKS).find((key) => schoolName.includes(key) || key.includes(schoolName))
  return hit ? SCHOOL_FALLBACKS[hit] : SCHOOL_FALLBACKS['南通理工学院']
}

export function geocodeAddress(address, city = '南通', timeoutMs = 6000) {
  const work = loadAMap().then((AMap) => new Promise((resolve, reject) => {
    if (!address?.trim()) {
      reject(new Error('地址为空'))
      return
    }
    let settled = false
    const done = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }

    const geocoder = new AMap.Geocoder({ city, radius: 5000 })
    geocoder.getLocation(address, (status, result) => {
      if (status === 'complete' && result?.geocodes?.length) {
        const g = result.geocodes[0]
        const location = g.location
        done(resolve, {
          lng: location.lng,
          lat: location.lat,
          formatted: g.formattedAddress || address,
          raw: g,
        })
        return
      }
      // Place search fallback for short names like "山姆"
      try {
        const place = new AMap.PlaceSearch({ city, pageSize: 1 })
        place.search(address, (pStatus, pResult) => {
          const poi = pResult?.poiList?.pois?.[0]
          if (pStatus === 'complete' && poi?.location) {
            done(resolve, {
              lng: poi.location.lng,
              lat: poi.location.lat,
              formatted: poi.name || address,
              raw: poi,
            })
            return
          }
          // School name fallback
          const fb = schoolFallbackLngLat(address)
          if (fb && /学院|大学|学校|校区/.test(address)) {
            done(resolve, { lng: fb[0], lat: fb[1], formatted: address, approximate: true })
            return
          }
          done(reject, new Error(`无法解析地址：${address}`))
        })
      } catch (error) {
        done(reject, error)
      }
    })
  }))

  return withTimeout(work, timeoutMs, '地址解析').catch((error) => {
    const fb = schoolFallbackLngLat(address)
    if (fb && /学院|大学|学校|校区|山姆|快递|食堂/.test(address || '')) {
      return { lng: fb[0], lat: fb[1], formatted: address, approximate: true, fallback: true }
    }
    throw error
  })
}

/** Geocode school and never hang — always resolves with a lng/lat. */
export function resolveSchoolLocation(schoolName, timeoutMs = 5000) {
  const name = schoolName || '南通理工学院'
  const fallback = schoolFallbackLngLat(name)
  return geocodeAddress(name, '南通', timeoutMs)
    .then((geo) => ({
      lng: geo.lng,
      lat: geo.lat,
      name,
      approximate: Boolean(geo.approximate || geo.fallback),
    }))
    .catch(() => ({
      lng: fallback[0],
      lat: fallback[1],
      name,
      approximate: true,
    }))
}

/**
 * Plan route with AMap Walking / Riding / Driving.
 * @returns {{ mode, distance, duration, path, steps }}
 */
export function planRoute(origin, destination, preferredMode = 'auto') {
  return loadAMap().then((AMap) => {
    const meters = distanceMeters(origin, destination)
    const mode = preferredMode === 'auto' ? suggestTravelMode(meters) : preferredMode
    const policyMap = {
      walk: () => new AMap.Walking({ map: null, hideMarkers: true }),
      ride: () => new AMap.Riding({ map: null, hideMarkers: true }),
      drive: () => new AMap.Driving({ policy: AMap.DrivingPolicy?.LEAST_TIME, map: null, hideMarkers: true }),
    }
    const planner = (policyMap[mode] || policyMap.ride)()

    return new Promise((resolve, reject) => {
      planner.search(origin, destination, (status, result) => {
        if (status !== 'complete' || !result) {
          // Fallback synthetic ETA from straight-line distance
          const dist = meters || 800
          const speed = mode === 'walk' ? 1.3 : mode === 'drive' ? 8 : 4
          resolve({
            mode,
            distance: dist,
            duration: Math.max(60, Math.round(dist / speed)),
            path: [origin, destination],
            approximate: true,
            raw: result,
          })
          return
        }
        const route = result.routes?.[0] || result.route
        if (!route) {
          reject(new Error('未找到可行路线'))
          return
        }
        let path = []
        if (route.steps?.length) {
          route.steps.forEach((step) => {
            if (step.path?.length) path = path.concat(step.path.map((p) => [p.lng, p.lat]))
            else if (typeof step.path === 'string') {
              // encoded sometimes
            }
          })
        }
        if (!path.length && origin && destination) path = [origin, destination]
        resolve({
          mode,
          distance: Number(route.distance) || meters || 0,
          duration: Number(route.time) || Number(route.duration) || 0,
          path,
          approximate: false,
          raw: result,
        })
      })
    })
  })
}

export function getCurrentLngLat() {
  return loadAMap().then((AMap) => new Promise((resolve, reject) => {
    const geo = createAMapGeolocation(AMap)
    geo.getCurrentPosition((status, result) => {
      const parsed = describeAMapLocateResult(status, result)
      if (parsed.ok) resolve({ lng: parsed.position[0], lat: parsed.position[1], address: parsed.address, approximate: parsed.approximate })
      else reject(new Error(parsed.message))
    })
  }))
}

export const MARKER_HTML = {
  pickup: '<div class="errand-marker errand-marker-pickup"><i></i><span>取</span></div>',
  delivery: '<div class="errand-marker errand-marker-delivery"><i></i><span>送</span></div>',
  runner: '<div class="errand-marker errand-marker-runner"><i></i><span>跑</span></div>',
  me: '<div class="errand-marker errand-marker-me"><i></i><span>我</span></div>',
  openTask: (reward) => `<button type="button" class="amap-task-marker errand-open-marker">¥${Number(reward || 0).toFixed(0)}<small>待接</small></button>`,
}
