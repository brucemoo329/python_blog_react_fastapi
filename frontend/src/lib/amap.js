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

/** Campus landmark offsets around 南通理工主校区 (lng, lat). */
const CAMPUS_LANDMARKS = [
  { keys: ['北门'], point: [120.8098, 32.0438] },
  { keys: ['南门'], point: [120.8091, 32.0386] },
  { keys: ['东门'], point: [120.8122, 32.0412] },
  { keys: ['西门'], point: [120.8064, 32.0410] },
  { keys: ['图书馆'], point: [120.8096, 32.0418] },
  { keys: ['食堂', '一食堂'], point: [120.8084, 32.0415] },
  { keys: ['快递', '菜鸟', '驿站'], point: [120.8078, 32.0406] },
  { keys: ['男1', '男生1', '1栋'], point: [120.8076, 32.0398] },
  { keys: ['男2', '男生2', '2栋'], point: [120.8079, 32.0399] },
  { keys: ['男3', '男生3', '3栋'], point: [120.8082, 32.0400] },
  { keys: ['男4', '男生4', '4栋', '本部男4'], point: [120.8085, 32.0401] },
  { keys: ['男5', '男生5', '5栋'], point: [120.8088, 32.0402] },
  { keys: ['女1', '女生1'], point: [120.8102, 32.0397] },
  { keys: ['女2', '女生2'], point: [120.8105, 32.0398] },
  { keys: ['教学楼', '教一'], point: [120.8099, 32.0414] },
  { keys: ['操场', '田径场'], point: [120.8108, 32.0424] },
  { keys: ['山姆'], point: [120.875, 32.02] },
]

export function schoolFallbackLngLat(schoolName) {
  if (!schoolName) return SCHOOL_FALLBACKS['南通理工学院']
  if (SCHOOL_FALLBACKS[schoolName]) return SCHOOL_FALLBACKS[schoolName]
  const hit = Object.keys(SCHOOL_FALLBACKS).find((key) => schoolName.includes(key) || key.includes(schoolName))
  return hit ? SCHOOL_FALLBACKS[hit] : SCHOOL_FALLBACKS['南通理工学院']
}

export function campusLandmarkLngLat(address) {
  if (!address) return null
  const text = String(address)
  for (const item of CAMPUS_LANDMARKS) {
    if (item.keys.some((k) => text.includes(k))) return item.point
  }
  // 南通理工 + 门牌
  if (/南通理工|理工学院|校区/.test(text)) {
    return schoolFallbackLngLat(text)
  }
  return null
}

export function geocodeAddress(address, city = '南通', timeoutMs = 6000) {
  if (!address?.trim()) {
    return Promise.reject(new Error('地址为空'))
  }
  // Prefer campus landmark map for 北门/男4 等
  const landmark = campusLandmarkLngLat(address)
  if (landmark && /理工|学院|校区|门|栋|食堂|快递|山姆|操场|图书馆|男|女/.test(address)) {
    return Promise.resolve({
      lng: landmark[0],
      lat: landmark[1],
      formatted: address,
      approximate: true,
      fallback: true,
    })
  }

  const work = loadAMap().then((AMap) => new Promise((resolve, reject) => {
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
    const landmark = campusLandmarkLngLat(address)
    if (landmark) {
      return { lng: landmark[0], lat: landmark[1], formatted: address, approximate: true, fallback: true }
    }
    const fb = schoolFallbackLngLat(address)
    if (fb && /学院|大学|学校|校区|山姆|快递|食堂|门|栋/.test(address || '')) {
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

function pushLngLat(path, point) {
  if (!point) return
  if (Array.isArray(point) && point.length >= 2) {
    const lng = Number(point[0])
    const lat = Number(point[1])
    if (Number.isFinite(lng) && Number.isFinite(lat)) path.push([lng, lat])
    return
  }
  if (typeof point.getLng === 'function') {
    path.push([point.getLng(), point.getLat()])
    return
  }
  if (point.lng != null && point.lat != null) {
    path.push([Number(point.lng), Number(point.lat)])
  }
}

/** Extract real road geometry from AMap Walking / Riding / Driving results. */
export function extractRoutePath(route) {
  const path = []
  if (!route) return path
  if (Array.isArray(route.path)) route.path.forEach((p) => pushLngLat(path, p))
  if (Array.isArray(route.steps)) {
    route.steps.forEach((step) => {
      if (Array.isArray(step.path) && step.path.length) {
        step.path.forEach((p) => pushLngLat(path, p))
      } else if (typeof step.path === 'string' && step.path.includes(',')) {
        // rare string form
        step.path.split(';').forEach((pair) => {
          const [lng, lat] = pair.split(',').map(Number)
          if (Number.isFinite(lng) && Number.isFinite(lat)) path.push([lng, lat])
        })
      }
      if (typeof step.polyline === 'string') {
        step.polyline.split(';').forEach((pair) => {
          const [lng, lat] = pair.split(',').map(Number)
          if (Number.isFinite(lng) && Number.isFinite(lat)) path.push([lng, lat])
        })
      }
    })
  }
  return path
}

/**
 * Plan route with real road path (not straight line when AMap succeeds).
 * @param {[lng,lat]} origin
 * @param {[lng,lat]} destination
 * @param {'walk'|'ride'|'drive'|'auto'} preferredMode
 * @param {{ map?: any }} options — if map is set, AMap also draws the route layer
 */
export function planRoute(origin, destination, preferredMode = 'auto', options = {}) {
  return loadAMap().then((AMap) => {
    if (!origin || !destination) {
      return Promise.reject(new Error('缺少起点或终点'))
    }
    const start = Array.isArray(origin) ? origin : [origin.lng, origin.lat]
    const end = Array.isArray(destination) ? destination : [destination.lng, destination.lat]
    const meters = distanceMeters(start, end)
    // Never force auto→ride after user picked a mode
    const mode = preferredMode === 'auto' || !preferredMode
      ? suggestTravelMode(meters)
      : preferredMode
    const map = options.map || null

    const createPlanner = (kind) => {
      if (kind === 'walk') return new AMap.Walking({ map, hideMarkers: true, autoFitView: false })
      if (kind === 'drive') {
        return new AMap.Driving({
          policy: AMap.DrivingPolicy?.LEAST_TIME ?? 0,
          map,
          hideMarkers: true,
          autoFitView: false,
          ferry: 1,
        })
      }
      return new AMap.Riding({ map, hideMarkers: true, autoFitView: false })
    }

    const straightFallback = () => {
      const dist = meters || 800
      const speed = mode === 'walk' ? 1.3 : mode === 'drive' ? 8 : 4
      return {
        mode,
        distance: dist,
        duration: Math.max(60, Math.round(dist / speed)),
        path: [start, end],
        approximate: true,
        planner: null,
      }
    }

    const searchOnce = (kind, timeoutMs = 3500) => {
      const work = new Promise((resolve) => {
        let planner
        try {
          planner = createPlanner(kind)
        } catch {
          resolve(null)
          return
        }
        try {
          planner.search(start, end, (status, result) => {
            if (status !== 'complete' || !result) {
              resolve(null)
              return
            }
            const route = result.routes?.[0] || result.route
            if (!route) {
              resolve(null)
              return
            }
            const path = extractRoutePath(route)
            const distance = Number(route.distance) || meters || 0
            const duration = Number(route.time) || Number(route.duration) || Math.max(60, Math.round(distance / 4))
            resolve({
              mode: kind,
              distance,
              duration,
              path: path.length >= 2 ? path : null,
              approximate: path.length < 2,
              planner,
              raw: result,
            })
          })
        } catch {
          resolve(null)
        }
      })
      return withTimeout(work, timeoutMs, '路线规划').catch(() => null)
    }

    return (async () => {
      // Prefer requested mode with short timeout; one fast fallback mode max
      let best = await searchOnce(mode, 3500)
      if (!best?.path || best.path.length < 2) {
        // Campus distances: drive is usually the most reliable path API
        const alt = mode === 'drive' ? 'ride' : 'drive'
        const tryAlt = await searchOnce(alt, 2500)
        if (tryAlt?.path && tryAlt.path.length >= 2) {
          const speed = mode === 'walk' ? 1.3 : mode === 'drive' ? 8 : 4
          best = {
            ...tryAlt,
            mode,
            duration: Math.max(60, Math.round((tryAlt.distance || meters || 800) / speed)),
            approximate: false,
            geometryMode: alt,
          }
        }
      }
      if (best?.path && best.path.length >= 2) return best
      // Instant approximate path so UI never sticks on "规划中"
      return straightFallback()
    })()
  })
}

/**
 * Open 高德地图 App (or H5) for turn-by-turn navigation.
 * mode: walk | ride | drive
 */
export function openAmapAppNavigation({
  fromLng,
  fromLat,
  fromName = '我的位置',
  toLng,
  toLat,
  toName = '目的地',
  mode = 'ride',
}) {
  if (toLng == null || toLat == null) {
    throw new Error('缺少目的地坐标，无法打开高德导航')
  }
  const modeMap = { walk: 'walk', ride: 'ride', drive: 'car', car: 'car', auto: 'ride' }
  const m = modeMap[mode] || 'ride'
  const hasFrom = fromLng != null && fromLat != null && Number.isFinite(Number(fromLng))
  const fromPart = hasFrom
    ? `${Number(fromLng)},${Number(fromLat)},${encodeURIComponent(fromName)}`
    : ''
  const toPart = `${Number(toLng)},${Number(toLat)},${encodeURIComponent(toName)}`
  // callnative=1 tries to open the installed Amap app
  const url = hasFrom
    ? `https://uri.amap.com/navigation?from=${fromPart}&to=${toPart}&mode=${m}&coordinate=gaode&callnative=1`
    : `https://uri.amap.com/navigation?to=${toPart}&mode=${m}&coordinate=gaode&callnative=1`
  const opened = window.open(url, '_blank')
  if (!opened) {
    window.location.href = url
  }
  return url
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
