import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bike,
  Car,
  CheckCircle2,
  Clock3,
  Flag,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  PersonStanding,
  RefreshCw,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  completeServiceTask,
  complainLateTask,
  getTaskTracking,
  markTaskPickedUp,
  updateTaskDesiredTime,
  updateTaskRunnerLocation,
  updateTaskTravelMode,
} from '@/api/marketplace'
import {
  distanceMeters,
  getCurrentLngLat,
  loadAMap,
  MARKER_HTML,
  planRoute,
  geocodeAddress,
} from '@/lib/amap'
import DesiredTimePicker, { defaultDesiredTime } from '@/components/DesiredTimePicker'
import { cn } from '@/lib/utils'

const MODES = [
  { id: 'walk', label: '步行', icon: PersonStanding },
  { id: 'ride', label: '骑行', icon: Bike },
  { id: 'drive', label: '驾车', icon: Car },
]

function fmtEta(seconds) {
  if (seconds == null) return '计算中…'
  const m = Math.max(1, Math.round(Number(seconds) / 60))
  if (m < 60) return `约 ${m} 分钟`
  return `约 ${Math.floor(m / 60)} 小时 ${m % 60} 分`
}

function toLngLat(point) {
  if (!point) return null
  if (Array.isArray(point) && point.length >= 2) return [Number(point[0]), Number(point[1])]
  if (point.lng != null && point.lat != null) return [Number(point.lng), Number(point.lat)]
  return null
}

async function ensurePoint(label, existing) {
  const cur = toLngLat(existing)
  if (cur && Number.isFinite(cur[0]) && Number.isFinite(cur[1])) return cur
  if (!label) return null
  try {
    const geo = await geocodeAddress(label)
    return [geo.lng, geo.lat]
  } catch {
    return null
  }
}

/**
 * Full-screen Meituan-like errand navigation for runner & requester.
 */
export default function ErrandNavPage({
  taskId,
  initialTracking,
  currentUser,
  onBack,
  onNotice,
  onMessage,
  onFinished,
}) {
  const [tracking, setTracking] = useState(initialTracking || null)
  const [mode, setMode] = useState(initialTracking?.travel_mode || 'ride')
  const [busy, setBusy] = useState(false)
  const [routeInfo, setRouteInfo] = useState(null)
  const [myPos, setMyPos] = useState(null)
  const [desiredOpen, setDesiredOpen] = useState(false)
  const [desiredLocal, setDesiredLocal] = useState(defaultDesiredTime(1))
  const [statusText, setStatusText] = useState('正在规划路线…')

  const mapBoxRef = useRef(null)
  const mapRef = useRef(null)
  const AMapRef = useRef(null)
  const markersRef = useRef([])
  const polyRef = useRef(null)
  const plannerRef = useRef(null)

  const role = tracking?.role
  const phase = tracking?.delivery_phase || 'pending'
  const isRunner = role === 'runner'
  const isRequester = role === 'requester'

  const stageTitle = useMemo(() => {
    if (phase === 'to_pickup') return isRunner ? '前往取货点' : '跑手正在取货路上'
    if (phase === 'delivering' || phase === 'picked_up') return isRunner ? '送往目的地' : '跑手正在配送中'
    if (phase === 'delivered') return '已送达完成'
    return tracking?.phase_label || '配送导航'
  }, [phase, isRunner, tracking?.phase_label])

  const refresh = useCallback(async () => {
    if (!taskId) return null
    const response = await getTaskTracking(taskId)
    setTracking(response.item)
    if (response.item?.travel_mode && response.item.travel_mode !== 'auto') {
      setMode(response.item.travel_mode)
    }
    return response.item
  }, [taskId])

  const clearOverlays = () => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => map.remove(m))
    markersRef.current = []
    if (polyRef.current) {
      map.remove(polyRef.current)
      polyRef.current = null
    }
    if (plannerRef.current?.clear) {
      try { plannerRef.current.clear() } catch { /* ignore */ }
      plannerRef.current = null
    }
  }

  const drawMap = useCallback(async (track, livePos, travelMode) => {
    const map = mapRef.current
    const AMap = AMapRef.current
    if (!map || !AMap || !track) return

    clearOverlays()

    let pickup = toLngLat(track.pickup)
    let delivery = toLngLat(track.delivery)
    if (!pickup) pickup = await ensurePoint(track.pickup_location || track.pickup?.label, track.pickup)
    if (!delivery) delivery = await ensurePoint(track.delivery_location || track.delivery?.label, track.delivery)

    const runner = livePos
      || (track.runner?.lat != null ? [Number(track.runner.lng), Number(track.runner.lat)] : null)

    const addMarker = (position, html, title) => {
      if (!position) return
      const marker = new AMap.Marker({
        position,
        content: html,
        offset: new AMap.Pixel(-18, -18),
        title,
        zIndex: 150,
      })
      map.add(marker)
      markersRef.current.push(marker)
    }

    // Always show pickup + delivery for both roles
    addMarker(pickup, MARKER_HTML.pickup, track.pickup_location || '取货点')
    addMarker(delivery, MARKER_HTML.delivery, track.delivery_location || '送达点')

    if (isRunner && runner) {
      addMarker(runner, MARKER_HTML.me, '我（跑手）')
    } else if (runner) {
      addMarker(runner, MARKER_HTML.runner, '跑手位置')
    }

    // Requester also sees "送达点=我的收货地址" label already; optional self marker at delivery
    if (isRequester && delivery) {
      addMarker(delivery, MARKER_HTML.me, '我的收货地址')
    }

    const origin = phase === 'delivering' || phase === 'picked_up'
      ? (runner || pickup)
      : (runner || pickup)
    const dest = phase === 'delivering' || phase === 'picked_up' ? delivery : pickup

    if (origin && dest && ['to_pickup', 'delivering', 'picked_up'].includes(phase)) {
      setStatusText(phase === 'to_pickup' ? '规划：当前位置 → 取货点' : '规划：取货点 → 送达点')
      try {
        const route = await planRoute(origin, dest, travelMode || mode || 'ride', { map: null })
        plannerRef.current = route.planner
        if (route.path?.length) {
          polyRef.current = new AMap.Polyline({
            path: route.path,
            strokeColor: phase === 'to_pickup' ? '#a78bfa' : '#34d399',
            strokeWeight: 7,
            strokeOpacity: 0.95,
            lineJoin: 'round',
            showDir: true,
          })
          map.add(polyRef.current)
          markersRef.current.push(polyRef.current)
        }
        setRouteInfo(route)
        setStatusText(
          phase === 'to_pickup'
            ? `去取货 · ${route.mode === 'walk' ? '步行' : route.mode === 'drive' ? '驾车' : '骑行'} · ${fmtEta(route.duration)} · ${route.distance}米`
            : `配送中 · ${route.mode === 'walk' ? '步行' : route.mode === 'drive' ? '驾车' : '骑行'} · ${fmtEta(route.duration)} · ${route.distance}米`,
        )
        map.setFitView(null, false, [60, 60, 60, 60])
      } catch (error) {
        setStatusText(error.message || '路线规划失败')
      }
    } else if (phase === 'delivered') {
      setStatusText('订单已完成')
      map.setFitView(null, false, [60, 60, 60, 60])
    } else {
      const pts = [pickup, delivery, runner].filter(Boolean)
      if (pts.length) map.setFitView(null, false, [60, 60, 60, 60])
    }
  }, [isRunner, isRequester, mode, phase])

  // Init map
  useEffect(() => {
    let disposed = false
    loadAMap().then((AMap) => {
      if (disposed || !mapBoxRef.current) return
      AMapRef.current = AMap
      mapRef.current = new AMap.Map(mapBoxRef.current, {
        zoom: 16,
        viewMode: '2D',
        mapStyle: 'amap://styles/darkblue',
        resizeEnable: true,
      })
      mapRef.current.addControl(new AMap.Scale())
      mapRef.current.addControl(new AMap.ToolBar({ position: { right: '12px', bottom: '80px' } }))
    }).catch(() => setStatusText('地图加载失败，请检查高德 Key / HTTPS'))
    return () => {
      disposed = true
      clearOverlays()
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [])

  // Poll tracking + runner location push
  useEffect(() => {
    if (!taskId) return undefined
    let cancelled = false

    const tick = async () => {
      try {
        const item = await refresh()
        if (cancelled) return
        let live = null
        if (item?.role === 'runner' && ['to_pickup', 'delivering', 'picked_up'].includes(item.delivery_phase)) {
          try {
            const pos = await getCurrentLngLat()
            live = [pos.lng, pos.lat]
            setMyPos(live)
            const target = item.delivery_phase === 'to_pickup'
              ? toLngLat(item.pickup)
              : toLngLat(item.delivery)
            let eta = null
            let dist = null
            const useMode = mode || item.travel_mode || 'ride'
            if (target && live) {
              const route = await planRoute(live, target, useMode)
              eta = route.duration
              dist = route.distance
            }
            const response = await updateTaskRunnerLocation(taskId, {
              latitude: pos.lat,
              longitude: pos.lng,
              eta_seconds: eta,
              distance_meters: dist,
              travel_mode: useMode,
            })
            if (!cancelled) {
              setTracking(response.tracking)
              await drawMap(response.tracking, live, useMode)
            }
            return
          } catch {
            /* keep polling tracking only */
          }
        }
        if (!cancelled && item) await drawMap(item, live || myPos, mode || item.travel_mode)
      } catch {
        /* ignore */
      }
    }

    tick()
    const timer = window.setInterval(tick, 10000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [taskId, mode, refresh, drawMap])

  const onChangeMode = async (nextMode) => {
    setMode(nextMode)
    if (!isRunner || !taskId) return
    setBusy(true)
    try {
      let eta = null
      let dist = null
      const origin = myPos || (tracking?.runner?.lat != null ? [tracking.runner.lng, tracking.runner.lat] : null)
      const dest = phase === 'to_pickup' ? toLngLat(tracking?.pickup) : toLngLat(tracking?.delivery)
      if (origin && dest) {
        const route = await planRoute(origin, dest, nextMode)
        eta = route.duration
        dist = route.distance
        setRouteInfo(route)
      }
      const response = await updateTaskTravelMode(taskId, {
        travel_mode: nextMode,
        eta_seconds: eta,
        distance_meters: dist,
      })
      setTracking(response.tracking)
      onNotice?.(response.message)
      await drawMap(response.tracking, origin, nextMode)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || error.message || '切换出行方式失败')
    } finally {
      setBusy(false)
    }
  }

  const onPickedUp = async () => {
    setBusy(true)
    try {
      let pos = myPos
      if (!pos) {
        const cur = await getCurrentLngLat()
        pos = [cur.lng, cur.lat]
        setMyPos(pos)
      }
      const pickup = toLngLat(tracking?.pickup)
      const dist = pickup ? distanceMeters(pos, pickup) : null
      if (dist != null && dist > (tracking?.pickup_radius_m || 280)) {
        onNotice?.(`距离取货点约 ${dist} 米，请靠近后再点「已取到货」`)
        setBusy(false)
        return
      }
      const dest = toLngLat(tracking?.delivery)
      let eta = null
      let d = null
      if (pos && dest) {
        const route = await planRoute(pos, dest, mode)
        eta = route.duration
        d = route.distance
      }
      const response = await markTaskPickedUp(taskId, {
        latitude: pos[1],
        longitude: pos[0],
        eta_seconds: eta,
        distance_meters: d,
        travel_mode: mode,
      })
      setTracking(response.tracking)
      onNotice?.(response.message)
      await drawMap(response.tracking, pos, mode)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '确认取货失败')
    } finally {
      setBusy(false)
    }
  }

  const onComplete = async () => {
    setBusy(true)
    try {
      let pos = myPos
      if (!pos && isRunner) {
        const cur = await getCurrentLngLat()
        pos = [cur.lng, cur.lat]
      }
      const payload = pos ? { latitude: pos[1], longitude: pos[0] } : null
      const response = await completeServiceTask(taskId, payload)
      setTracking(response.tracking)
      onNotice?.(response.message)
      onFinished?.()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '确认送达失败')
    } finally {
      setBusy(false)
    }
  }

  const onComplain = async () => {
    if (!window.confirm('确认投诉超时？将扣除跑手 20 信任分。')) return
    setBusy(true)
    try {
      const response = await complainLateTask(taskId)
      onNotice?.(response.message)
      await refresh()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '投诉失败')
    } finally {
      setBusy(false)
    }
  }

  const onSaveTime = async () => {
    setBusy(true)
    try {
      const response = await updateTaskDesiredTime(taskId, new Date(desiredLocal).toISOString())
      onNotice?.(response.message)
      setDesiredOpen(false)
      await refresh()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '修改时间失败')
    } finally {
      setBusy(false)
    }
  }

  const peer = isRunner ? tracking?.requester : tracking?.runner?.user

  return (
    <section className="errand-nav-page">
      <header className="errand-nav-top">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回"><ArrowLeft /></Button>
        <div className="errand-nav-top-main">
          <Badge variant="secondary">{stageTitle}</Badge>
          <h1>{tracking?.title || '跑腿配送'}</h1>
          <p>{statusText}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refresh().then((item) => drawMap(item, myPos, mode))} aria-label="刷新">
          <RefreshCw />
        </Button>
      </header>

      <div className="errand-nav-steps">
        <div className={cn(phase !== 'pending' && 'is-done', phase === 'to_pickup' && 'is-active')}><Navigation /> 接单</div>
        <div className={cn(phase === 'to_pickup' && 'is-active', ['picked_up', 'delivering', 'delivered'].includes(phase) && 'is-done')}><PackageCheck /> 取货</div>
        <div className={cn(['delivering', 'picked_up'].includes(phase) && 'is-active', phase === 'delivered' && 'is-done')}><Bike /> 配送</div>
        <div className={cn(phase === 'delivered' && 'is-done')}><CheckCircle2 /> 送达</div>
      </div>

      <div className="errand-nav-legend">
        <span><i className="lg-pickup" />取货点</span>
        <span><i className="lg-delivery" />送达点</span>
        <span><i className="lg-runner" />跑手</span>
        <span><i className="lg-me" />我</span>
      </div>

      <div ref={mapBoxRef} className="errand-nav-map" aria-label="配送导航地图" />

      <div className="errand-nav-sheet">
        <div className="errand-nav-points">
          <div>
            <strong><MapPin /> 取货</strong>
            <p>{tracking?.pickup_location || '取货点'}</p>
            {tracking?.distance_to_pickup_m != null && phase === 'to_pickup' ? (
              <small>距你 {tracking.distance_to_pickup_m} 米{tracking.can_confirm_pickup ? ' · 可确认取货' : ` · 需进入 ${tracking.pickup_radius_m || 280} 米内`}</small>
            ) : null}
          </div>
          <div>
            <strong><Flag /> 送达</strong>
            <p>{tracking?.delivery_location || '送达点'}</p>
            {tracking?.distance_to_delivery_m != null && ['delivering', 'picked_up'].includes(phase) ? (
              <small>距你 {tracking.distance_to_delivery_m} 米</small>
            ) : null}
          </div>
        </div>

        <div className="errand-nav-eta-card">
          <div>
            <Clock3 />
            <div>
              <strong>{fmtEta(routeInfo?.duration ?? tracking?.eta_seconds)}</strong>
              <small>{routeInfo?.distance || tracking?.distance_meters || '—'} 米 · {tracking?.travel_mode_label || mode}</small>
            </div>
          </div>
          {tracking?.desired_delivery_at ? (
            <em>期望 {new Date(tracking.desired_delivery_at).toLocaleString()}</em>
          ) : null}
        </div>

        {isRunner && phase !== 'delivered' ? (
          <div className="errand-mode-row">
            {MODES.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(mode === item.id && 'is-active')}
                  disabled={busy}
                  onClick={() => onChangeMode(item.id)}
                >
                  <Icon /> {item.label}
                </button>
              )
            })}
          </div>
        ) : null}

        {peer ? (
          <div className="errand-nav-peer">
            <Avatar className="size-9">
              <AvatarImage src={peer.avatar_url || undefined} alt="" />
              <AvatarFallback>{(peer.nickname || peer.username || '同').slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <strong>{peer.nickname || peer.username}</strong>
              <small>{isRunner ? '发布者 / 买家' : '跑手'}</small>
            </div>
            <Button size="sm" variant="outline" onClick={() => onMessage?.({ user: peer, type: 'service', id: taskId })}>
              <MessageCircle /> 联系
            </Button>
          </div>
        ) : null}

        <div className="errand-nav-actions">
          {isRunner && phase === 'to_pickup' ? (
            <Button
              className="flex-1"
              disabled={busy || (tracking && tracking.can_confirm_pickup === false && tracking.distance_to_pickup_m != null)}
              onClick={onPickedUp}
            >
              <PackageCheck /> 已取到货
            </Button>
          ) : null}
          {isRunner && ['delivering', 'picked_up'].includes(phase) ? (
            <Button className="flex-1" disabled={busy} onClick={onComplete}>
              <CheckCircle2 /> 确认送达
            </Button>
          ) : null}
          {isRequester && phase !== 'delivered' ? (
            <>
              <Button variant="outline" onClick={() => setDesiredOpen((v) => !v)}>修改期望时间</Button>
              {tracking?.can_complain_late ? (
                <Button variant="destructive" disabled={busy} onClick={onComplain}>超时投诉 -20</Button>
              ) : null}
            </>
          ) : null}
          {isRequester && phase === 'delivered' ? (
            <Button className="flex-1" onClick={onBack}>返回</Button>
          ) : null}
        </div>

        {desiredOpen ? (
          <div className="errand-desired-box">
            <DesiredTimePicker value={desiredLocal} onChange={setDesiredLocal} />
            <Button size="sm" disabled={busy} onClick={onSaveTime}>保存期望时间</Button>
          </div>
        ) : null}

        {isRunner && phase === 'to_pickup' && tracking?.distance_to_pickup_m != null && !tracking.can_confirm_pickup ? (
          <p className="errand-nav-hint">靠近取货点（约 {tracking.pickup_radius_m || 280} 米内）后，「已取到货」才会生效；发布者将实时看到你的位置与路线。</p>
        ) : null}
        {isRequester ? (
          <p className="errand-nav-hint">地图：橙色=取货点，蓝色=你的送达地址，紫色=跑手实时位置。跑手确认取货后会自动改规划「取货点→你」的路线。</p>
        ) : null}
      </div>
    </section>
  )
}
