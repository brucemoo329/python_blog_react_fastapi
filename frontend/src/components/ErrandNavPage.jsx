import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bike,
  Car,
  CheckCircle2,
  Clock3,
  ExternalLink,
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
  cancelOrder,
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
  openAmapAppNavigation,
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

const MODE_LABEL = { walk: '步行', ride: '骑行', drive: '驾车', auto: '智能' }

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

function normalizeMode(value, fallback = 'ride') {
  if (value === 'walk' || value === 'ride' || value === 'drive') return value
  return fallback
}

/**
 * Full-screen errand navigation for runner & requester.
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
  const initialMode = normalizeMode(initialTracking?.travel_mode, 'ride')
  const [tracking, setTracking] = useState(initialTracking || null)
  const [mode, setMode] = useState(initialMode)
  const [busy, setBusy] = useState(false)
  const [routeInfo, setRouteInfo] = useState(null)
  const [myPos, setMyPos] = useState(null)
  const [desiredOpen, setDesiredOpen] = useState(false)
  const [desiredLocal, setDesiredLocal] = useState(defaultDesiredTime(1))
  const [statusText, setStatusText] = useState('正在规划路线…')
  const [mapReady, setMapReady] = useState(false)

  const modeRef = useRef(initialMode)
  const myPosRef = useRef(null)
  const mapBoxRef = useRef(null)
  const mapRef = useRef(null)
  const AMapRef = useRef(null)
  const markersRef = useRef([])
  const polyRef = useRef(null)
  const drawSeq = useRef(0)

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

  const setTravelMode = (next) => {
    const m = normalizeMode(next, 'ride')
    modeRef.current = m
    setMode(m)
  }

  const refresh = useCallback(async () => {
    if (!taskId) return null
    const response = await getTaskTracking(taskId)
    setTracking(response.item)
    // Sync mode from server only if server has an explicit mode (do not force ride)
    const serverMode = normalizeMode(response.item?.travel_mode, null)
    if (serverMode) {
      modeRef.current = serverMode
      setMode(serverMode)
    }
    return response.item
  }, [taskId])

  const clearOverlays = () => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => {
      try { map.remove(m) } catch { /* ignore */ }
    })
    markersRef.current = []
    if (polyRef.current) {
      try { map.remove(polyRef.current) } catch { /* ignore */ }
      polyRef.current = null
    }
  }

  const drawMap = useCallback(async (track, livePos, travelMode) => {
    const map = mapRef.current
    const AMap = AMapRef.current
    if (!map || !AMap || !track) return
    const seq = ++drawSeq.current

    clearOverlays()

    let pickup = toLngLat(track.pickup)
    let delivery = toLngLat(track.delivery)
    if (!pickup) pickup = await ensurePoint(track.pickup_location || track.pickup?.label, track.pickup)
    if (!delivery) delivery = await ensurePoint(track.delivery_location || track.delivery?.label, track.delivery)
    if (seq !== drawSeq.current) return

    const runner = livePos
      || (track.runner?.lat != null ? [Number(track.runner.lng), Number(track.runner.lat)] : null)

    const addMarker = (position, html, title, zIndex = 150) => {
      if (!position) return
      const marker = new AMap.Marker({
        position,
        content: html,
        offset: new AMap.Pixel(-18, -18),
        title,
        zIndex,
      })
      map.add(marker)
      markersRef.current.push(marker)
    }

    addMarker(pickup, MARKER_HTML.pickup, track.pickup_location || '取货点', 140)
    addMarker(delivery, MARKER_HTML.delivery, track.delivery_location || '送达点', 140)

    if (isRunner && runner) addMarker(runner, MARKER_HTML.me, '我（跑手）', 160)
    else if (runner) addMarker(runner, MARKER_HTML.runner, '跑手位置', 160)

    if (isRequester && delivery) {
      // 发布者自己的送达点强调
      addMarker(delivery, MARKER_HTML.me, '我的收货地址', 155)
    }

    const currentPhase = track.delivery_phase || phase
    // 取货阶段：当前位置 → 取货点；配送阶段：当前位置 → 送达点
    const origin = runner || (currentPhase === 'to_pickup' ? null : pickup)
    const dest = currentPhase === 'to_pickup' || currentPhase === 'pending'
      ? pickup
      : delivery

    if (origin && dest && ['to_pickup', 'delivering', 'picked_up'].includes(currentPhase)) {
      const useMode = normalizeMode(travelMode || modeRef.current, 'ride')
      setStatusText(currentPhase === 'to_pickup' ? '规划：当前位置 → 取货点' : '规划：当前位置 → 送达点')
      try {
        const route = await planRoute(origin, dest, useMode, { map: null })
        if (seq !== drawSeq.current) return
        if (route.path?.length >= 2) {
          polyRef.current = new AMap.Polyline({
            path: route.path,
            strokeColor: currentPhase === 'to_pickup' ? '#c084fc' : '#34d399',
            strokeWeight: 8,
            strokeOpacity: 0.95,
            lineJoin: 'round',
            lineCap: 'round',
            showDir: true,
            zIndex: 50,
          })
          map.add(polyRef.current)
          markersRef.current.push(polyRef.current)
        }
        setRouteInfo(route)
        const modeText = MODE_LABEL[useMode] || useMode
        const approx = route.approximate ? '（近似）' : ''
        setStatusText(
          currentPhase === 'to_pickup'
            ? `去取货 · ${modeText} · ${fmtEta(route.duration)} · ${route.distance}米${approx}`
            : `配送中 · ${modeText} · ${fmtEta(route.duration)} · ${route.distance}米${approx}`,
        )
        try {
          map.setFitView(null, false, [70, 70, 70, 70])
        } catch { /* ignore */ }
      } catch (error) {
        setStatusText(error.message || '路线规划失败')
      }
    } else if (currentPhase === 'delivered') {
      setStatusText('订单已完成')
      try { map.setFitView(null, false, [70, 70, 70, 70]) } catch { /* ignore */ }
    } else {
      try { map.setFitView(null, false, [70, 70, 70, 70]) } catch { /* ignore */ }
    }
  }, [isRunner, isRequester, phase])

  // Init map once
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
      mapRef.current.addControl(new AMap.ToolBar({ position: { right: '12px', bottom: '100px' } }))
      setMapReady(true)
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

  // Poll tracking + push runner location (mode from modeRef — never force ride)
  useEffect(() => {
    if (!taskId || !mapReady) return undefined
    let cancelled = false

    const tick = async () => {
      try {
        const item = await getTaskTracking(taskId).then((r) => r.item)
        if (cancelled || !item) return
        setTracking(item)

        // Only adopt server mode if valid; never overwrite local selection with auto
        const serverMode = normalizeMode(item.travel_mode, null)
        if (serverMode && serverMode !== modeRef.current) {
          // Prefer server as source of truth after location/mode API saves
          modeRef.current = serverMode
          setMode(serverMode)
        }

        const useMode = modeRef.current
        let live = myPosRef.current

        if (item.role === 'runner' && ['to_pickup', 'delivering', 'picked_up'].includes(item.delivery_phase)) {
          try {
            const pos = await getCurrentLngLat()
            live = [pos.lng, pos.lat]
            myPosRef.current = live
            setMyPos(live)

            let pickup = toLngLat(item.pickup)
            let delivery = toLngLat(item.delivery)
            if (!pickup && item.pickup_location) pickup = await ensurePoint(item.pickup_location, item.pickup)
            if (!delivery && item.delivery_location) delivery = await ensurePoint(item.delivery_location, item.delivery)

            const target = item.delivery_phase === 'to_pickup' ? pickup : delivery
            let eta = null
            let dist = null
            if (target && live) {
              const route = await planRoute(live, target, useMode)
              eta = route.duration
              dist = route.distance
              if (!cancelled) setRouteInfo(route)
            }

            const response = await updateTaskRunnerLocation(taskId, {
              latitude: pos.lat,
              longitude: pos.lng,
              eta_seconds: eta,
              distance_meters: dist,
              travel_mode: useMode,
            })
            if (cancelled) return
            setTracking(response.tracking)
            await drawMap(response.tracking, live, useMode)
            return
          } catch {
            /* fall through to draw only */
          }
        }

        if (!cancelled) await drawMap(item, live, useMode)
      } catch {
        /* ignore poll errors */
      }
    }

    tick()
    const timer = window.setInterval(tick, 12000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [taskId, mapReady, drawMap])

  const onChangeMode = async (nextMode) => {
    const m = normalizeMode(nextMode, 'ride')
    setTravelMode(m)
    if (!isRunner || !taskId) return
    setBusy(true)
    setStatusText(`已选择${MODE_LABEL[m]}，正在重算路线…`)
    try {
      let origin = myPosRef.current
      if (!origin) {
        try {
          const pos = await getCurrentLngLat()
          origin = [pos.lng, pos.lat]
          myPosRef.current = origin
          setMyPos(origin)
        } catch { /* ignore */ }
      }
      if (!origin && tracking?.runner?.lat != null) {
        origin = [Number(tracking.runner.lng), Number(tracking.runner.lat)]
      }

      let pickup = toLngLat(tracking?.pickup)
      let delivery = toLngLat(tracking?.delivery)
      if (!pickup) pickup = await ensurePoint(tracking?.pickup_location, tracking?.pickup)
      if (!delivery) delivery = await ensurePoint(tracking?.delivery_location, tracking?.delivery)

      const dest = phase === 'to_pickup' ? pickup : delivery
      let eta = null
      let dist = null
      if (origin && dest) {
        const route = await planRoute(origin, dest, m)
        eta = route.duration
        dist = route.distance
        setRouteInfo(route)
      }

      const response = await updateTaskTravelMode(taskId, {
        travel_mode: m,
        eta_seconds: eta,
        distance_meters: dist,
      })
      // Force local mode to selected (server might echo)
      setTravelMode(m)
      setTracking({ ...response.tracking, travel_mode: m, travel_mode_label: MODE_LABEL[m] })
      onNotice?.(`已切换为${MODE_LABEL[m]}`)
      await drawMap({ ...response.tracking, travel_mode: m }, origin, m)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || error.message || '切换出行方式失败')
    } finally {
      setBusy(false)
    }
  }

  const openExternalNav = async () => {
    try {
      let origin = myPosRef.current
      if (!origin) {
        try {
          const pos = await getCurrentLngLat()
          origin = [pos.lng, pos.lat]
          myPosRef.current = origin
          setMyPos(origin)
        } catch { /* optional */ }
      }
      let pickup = toLngLat(tracking?.pickup)
      let delivery = toLngLat(tracking?.delivery)
      if (!pickup) pickup = await ensurePoint(tracking?.pickup_location, tracking?.pickup)
      if (!delivery) delivery = await ensurePoint(tracking?.delivery_location, tracking?.delivery)

      const dest = phase === 'to_pickup' || phase === 'pending' ? pickup : delivery
      const destName = phase === 'to_pickup' || phase === 'pending'
        ? (tracking?.pickup_location || '取货点')
        : (tracking?.delivery_location || '送达点')

      if (!dest) {
        onNotice?.('暂无目的地坐标，请稍后重试')
        return
      }

      openAmapAppNavigation({
        fromLng: origin?.[0],
        fromLat: origin?.[1],
        fromName: '我的位置',
        toLng: dest[0],
        toLat: dest[1],
        toName: destName,
        mode: modeRef.current,
      })
      onNotice?.(`正在打开高德地图导航到「${destName}」`)
    } catch (error) {
      onNotice?.(error.message || '打开高德导航失败')
    }
  }

  const onPickedUp = async () => {
    setBusy(true)
    try {
      let pos = myPosRef.current
      if (!pos) {
        const cur = await getCurrentLngLat()
        pos = [cur.lng, cur.lat]
        myPosRef.current = pos
        setMyPos(pos)
      }
      let pickup = toLngLat(tracking?.pickup)
      if (!pickup) pickup = await ensurePoint(tracking?.pickup_location, tracking?.pickup)
      const dist = pickup ? distanceMeters(pos, pickup) : null
      if (dist != null && dist > (tracking?.pickup_radius_m || 280)) {
        onNotice?.(`距离取货点约 ${dist} 米，请靠近后再点「已取到货」`)
        setBusy(false)
        return
      }
      let delivery = toLngLat(tracking?.delivery)
      if (!delivery) delivery = await ensurePoint(tracking?.delivery_location, tracking?.delivery)
      let eta = null
      let d = null
      if (pos && delivery) {
        const route = await planRoute(pos, delivery, modeRef.current)
        eta = route.duration
        d = route.distance
        setRouteInfo(route)
      }
      const response = await markTaskPickedUp(taskId, {
        latitude: pos[1],
        longitude: pos[0],
        eta_seconds: eta,
        distance_meters: d,
        travel_mode: modeRef.current,
      })
      setTracking(response.tracking)
      onNotice?.('已取货，正在规划到送达点的路线')
      await drawMap(response.tracking, pos, modeRef.current)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '确认取货失败')
    } finally {
      setBusy(false)
    }
  }

  const onComplete = async () => {
    setBusy(true)
    try {
      let pos = myPosRef.current
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

  const onCancelOrder = async () => {
    const orderId = tracking?.order_id
    if (!orderId) {
      onNotice?.('订单尚未生成，请稍后在「我的订单」中取消')
      return
    }
    const reason = window.prompt('请填写取消原因', '临时有事，无法继续')
    if (!reason?.trim()) return
    if (!window.confirm('确认取消该跑腿订单？对方可选择投诉。')) return
    setBusy(true)
    try {
      const response = await cancelOrder(orderId, reason.trim())
      onNotice?.(response.message || '订单已取消')
      onFinished?.()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '取消失败')
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
  const displayMode = MODE_LABEL[mode] || mode

  return (
    <section className="errand-nav-page">
      <header className="errand-nav-top">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回"><ArrowLeft /></Button>
        <div className="errand-nav-top-main">
          <Badge variant="secondary">{stageTitle}</Badge>
          <h1>{tracking?.title || '跑腿配送'}</h1>
          <p>{statusText}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refresh().then((item) => drawMap(item, myPosRef.current, modeRef.current))}
          aria-label="刷新"
        >
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
        <span className="errand-mode-pill">当前：{displayMode}</span>
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
              <small>
                {routeInfo?.distance || tracking?.distance_meters || '—'} 米 · {displayMode}
                {routeInfo?.approximate ? ' · 近似路径' : ' · 道路路径'}
              </small>
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

        {/* 高德 App 导航跳转 */}
        {phase !== 'delivered' && phase !== 'pending' ? (
          <Button className="errand-amap-btn" variant="secondary" disabled={busy} onClick={openExternalNav}>
            <ExternalLink /> 打开高德 App 导航到{phase === 'to_pickup' ? '取货点' : '送达点'}
          </Button>
        ) : null}

        {peer ? (
          <div className="errand-nav-peer">
            <Avatar className="size-9">
              <AvatarImage src={peer.avatar_url || undefined} alt="" />
              <AvatarFallback>{(peer.nickname || peer.username || '同').slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <strong>{peer.nickname || peer.username}</strong>
              <small>{isRunner ? '发布者 / 买家' : `跑手 · ${displayMode}`}</small>
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
          {isRequester && phase !== 'delivered' && phase !== 'pending' ? (
            <>
              <Button variant="outline" onClick={() => setDesiredOpen((v) => !v)}>修改期望时间</Button>
              {tracking?.can_complain_late ? (
                <Button variant="destructive" disabled={busy} onClick={onComplain}>超时投诉 -20</Button>
              ) : null}
            </>
          ) : null}
          {(isRunner || isRequester) && phase !== 'delivered' && phase !== 'pending' ? (
            <Button variant="ghost" disabled={busy} onClick={onCancelOrder}>取消订单</Button>
          ) : null}
          {phase === 'delivered' || tracking?.status === 'cancelled' ? (
            <Button className="flex-1" onClick={onBack}>返回（可在我的订单评价）</Button>
          ) : null}
        </div>

        {desiredOpen ? (
          <div className="errand-desired-box">
            <DesiredTimePicker value={desiredLocal} onChange={setDesiredLocal} />
            <Button size="sm" disabled={busy} onClick={onSaveTime}>保存期望时间</Button>
          </div>
        ) : null}

        {isRunner && phase === 'to_pickup' ? (
          <p className="errand-nav-hint">
            ① 选择步行/骑行/驾车 ② 点「打开高德 App」开始真实导航到取货点 ③ 靠近后点「已取到货」④ 再导航到送达点。
          </p>
        ) : null}
        {isRequester ? (
          <p className="errand-nav-hint">
            地图：橙=取货点，蓝=你的送达地址，紫/绿=跑手。跑手切换驾车/步行后会同步到这里；取货后自动改规划到你。
          </p>
        ) : null}
      </div>
    </section>
  )
}
