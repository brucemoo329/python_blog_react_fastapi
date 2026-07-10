import { useEffect, useRef, useState } from 'react'
import {
  Bike,
  CheckCircle2,
  Clock3,
  Flag,
  MapPin,
  Navigation,
  PackageCheck,
  PersonStanding,
  Car,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  completeServiceTask,
  complainLateTask,
  getTaskTracking,
  markTaskPickedUp,
  updateTaskDesiredTime,
  updateTaskRunnerLocation,
} from '@/api/marketplace'
import { loadAMap, MARKER_HTML, planRoute } from '@/lib/amap'
import { cn } from '@/lib/utils'

const MODE_ICON = {
  walk: PersonStanding,
  ride: Bike,
  drive: Car,
  auto: Navigation,
}

function fmtEta(seconds) {
  if (seconds == null) return '计算中'
  const m = Math.max(1, Math.round(Number(seconds) / 60))
  if (m < 60) return `约 ${m} 分钟`
  return `约 ${Math.floor(m / 60)} 小时 ${m % 60} 分`
}

function toLngLat(point) {
  if (!point) return null
  if (Array.isArray(point)) return point
  if (point.lng != null && point.lat != null) return [Number(point.lng), Number(point.lat)]
  return null
}

export default function ErrandTrackingMap({
  taskId,
  initialTracking,
  currentUserId,
  onNotice,
  onMessageRequester,
  onOpenTask,
  compact = false,
}) {
  const [tracking, setTracking] = useState(initialTracking || null)
  const [busy, setBusy] = useState(false)
  const [desiredLocal, setDesiredLocal] = useState('')
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const amapRef = useRef(null)
  const overlays = useRef([])
  const routeLine = useRef(null)
  const pollRef = useRef(null)

  const role = tracking?.role
  const phase = tracking?.delivery_phase || 'pending'
  const ModeIcon = MODE_ICON[tracking?.travel_mode] || Navigation

  const refresh = async () => {
    if (!taskId) return
    try {
      const response = await getTaskTracking(taskId)
      setTracking(response.item)
    } catch {
      /* keep last */
    }
  }

  useEffect(() => {
    if (initialTracking) setTracking(initialTracking)
  }, [initialTracking])

  useEffect(() => {
    if (!taskId) return undefined
    refresh()
    pollRef.current = window.setInterval(refresh, 12000)
    return () => window.clearInterval(pollRef.current)
  }, [taskId])

  // Runner: push live location + route ETA
  useEffect(() => {
    if (role !== 'runner' || !['to_pickup', 'delivering'].includes(phase)) return undefined
    let cancelled = false
    const push = async () => {
      try {
        const { getCurrentLngLat } = await import('@/lib/amap')
        const pos = await getCurrentLngLat()
        if (cancelled) return
        const origin = [pos.lng, pos.lat]
        const target = phase === 'to_pickup'
          ? toLngLat(tracking?.pickup)
          : toLngLat(tracking?.delivery)
        let eta = null
        let dist = null
        let mode = tracking?.travel_mode || 'auto'
        if (target) {
          const route = await planRoute(origin, target, mode)
          eta = route.duration
          dist = route.distance
          mode = route.mode
        }
        const response = await updateTaskRunnerLocation(taskId, {
          latitude: pos.lat,
          longitude: pos.lng,
          eta_seconds: eta,
          distance_meters: dist,
          travel_mode: mode,
        })
        if (!cancelled) setTracking(response.tracking)
      } catch {
        /* permission / network */
      }
    }
    push()
    const timer = window.setInterval(push, 20000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [role, phase, taskId])

  useEffect(() => {
    let disposed = false
    if (!mapRef.current) return undefined

    loadAMap()
      .then(async (AMap) => {
        if (disposed || !mapRef.current) return
        amapRef.current = AMap
        if (!mapInst.current) {
          mapInst.current = new AMap.Map(mapRef.current, {
            zoom: 15,
            viewMode: '2D',
            mapStyle: 'amap://styles/darkblue',
            resizeEnable: true,
          })
          mapInst.current.addControl(new AMap.Scale())
        }
        const map = mapInst.current
        overlays.current.forEach((item) => map.remove(item))
        overlays.current = []
        if (routeLine.current) {
          map.remove(routeLine.current)
          routeLine.current = null
        }

        const pickup = toLngLat(tracking?.pickup)
        const delivery = toLngLat(tracking?.delivery)
        const runner = tracking?.runner?.lat != null
          ? [Number(tracking.runner.lng), Number(tracking.runner.lat)]
          : null

        const addMarker = (position, html, title) => {
          if (!position) return null
          const marker = new AMap.Marker({
            position,
            content: html,
            offset: new AMap.Pixel(-18, -18),
            title,
            zIndex: 120,
          })
          map.add(marker)
          overlays.current.push(marker)
          return marker
        }

        addMarker(pickup, MARKER_HTML.pickup, tracking?.pickup?.label || '取货点')
        addMarker(delivery, MARKER_HTML.delivery, tracking?.delivery?.label || '送达点')
        addMarker(runner, MARKER_HTML.runner, '跑手位置')

        const origin = runner || pickup
        const dest = phase === 'delivering' || phase === 'picked_up' ? delivery : pickup
        if (origin && dest && ['to_pickup', 'delivering', 'picked_up'].includes(phase)) {
          try {
            const route = await planRoute(origin, dest, tracking?.travel_mode || 'auto')
            if (!disposed && route.path?.length) {
              routeLine.current = new AMap.Polyline({
                path: route.path,
                strokeColor: phase === 'delivering' ? '#34d399' : '#a78bfa',
                strokeWeight: 6,
                strokeOpacity: 0.9,
                lineJoin: 'round',
              })
              map.add(routeLine.current)
              overlays.current.push(routeLine.current)
            }
          } catch {
            /* ignore */
          }
        }

        const points = [pickup, delivery, runner].filter(Boolean)
        if (points.length) map.setFitView(null, false, [48, 48, 48, 48])
      })
      .catch(() => {})

    return () => {
      disposed = true
    }
  }, [tracking, phase])

  useEffect(() => () => {
    if (mapInst.current) {
      mapInst.current.destroy()
      mapInst.current = null
    }
  }, [])

  if (!tracking) {
    return <div className="errand-track-empty">配送轨迹加载中…</div>
  }

  const onPickedUp = async () => {
    setBusy(true)
    try {
      const response = await markTaskPickedUp(taskId)
      setTracking(response.tracking)
      onNotice?.(response.message)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '确认取货失败')
    } finally {
      setBusy(false)
    }
  }

  const onComplete = async () => {
    setBusy(true)
    try {
      const response = await completeServiceTask(taskId)
      setTracking(response.tracking)
      onNotice?.(response.message)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '完成失败')
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
      refresh()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '投诉失败')
    } finally {
      setBusy(false)
    }
  }

  const onSaveTime = async () => {
    if (!desiredLocal) return
    setBusy(true)
    try {
      const iso = new Date(desiredLocal).toISOString()
      const response = await updateTaskDesiredTime(taskId, iso)
      onNotice?.(response.message)
      refresh()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '修改时间失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('errand-track-panel', compact && 'is-compact')}>
      <header className="errand-track-header">
        <div>
          <Badge variant="secondary">{tracking.phase_label}</Badge>
          <h3>{tracking.title}</h3>
          <p>{tracking.progress_text}</p>
        </div>
        <div className="errand-track-eta">
          <ModeIcon />
          <strong>{fmtEta(tracking.eta_seconds)}</strong>
          <small>{tracking.travel_mode_label}</small>
        </div>
      </header>

      <div className="errand-track-steps">
        <div className={cn(phase !== 'pending' && 'is-done')}><Navigation /> 接单</div>
        <div className={cn(['to_pickup'].includes(phase) && 'is-active', ['picked_up', 'delivering', 'delivered'].includes(phase) && 'is-done')}><PackageCheck /> 取货</div>
        <div className={cn(phase === 'delivering' && 'is-active', phase === 'delivered' && 'is-done')}><Bike /> 配送</div>
        <div className={cn(phase === 'delivered' && 'is-done')}><CheckCircle2 /> 送达</div>
      </div>

      <div className="errand-track-points">
        <span><i className="dot pickup" /> {tracking.pickup_location || '取货点'}</span>
        <span><i className="dot delivery" /> {tracking.delivery_location || '送达点'}</span>
      </div>

      <div ref={mapRef} className="errand-track-map" aria-label="跑腿配送地图" />

      <div className="errand-track-meta">
        <span><MapPin /> 赏金 ¥{Number(tracking.reward || 0).toFixed(2)}</span>
        {tracking.desired_delivery_at ? (
          <span><Clock3 /> 期望 {new Date(tracking.desired_delivery_at).toLocaleString()}</span>
        ) : null}
        {tracking.distance_meters != null ? <span><Flag /> {tracking.distance_meters} 米</span> : null}
      </div>

      <div className="errand-track-actions">
        {role === 'runner' && phase === 'to_pickup' ? (
          <Button size="sm" disabled={busy} onClick={onPickedUp}><PackageCheck /> 已取到货</Button>
        ) : null}
        {role === 'runner' && ['delivering', 'picked_up'].includes(phase) ? (
          <Button size="sm" disabled={busy} onClick={onComplete}><CheckCircle2 /> 确认送达</Button>
        ) : null}
        {role === 'requester' && phase !== 'delivered' ? (
          <>
            <input
              type="datetime-local"
              value={desiredLocal}
              onChange={(e) => setDesiredLocal(e.target.value)}
              className="errand-time-input"
            />
            <Button size="sm" variant="outline" disabled={busy || !desiredLocal} onClick={onSaveTime}>修改期望时间</Button>
          </>
        ) : null}
        {role === 'requester' && tracking.can_complain_late ? (
          <Button size="sm" variant="destructive" disabled={busy} onClick={onComplain}>超时投诉 -20</Button>
        ) : null}
        {tracking.requester && role !== 'requester' ? (
          <Button size="sm" variant="outline" onClick={() => onMessageRequester?.(tracking)}>联系买家</Button>
        ) : null}
        {onOpenTask ? (
          <Button size="sm" variant="ghost" onClick={() => onOpenTask({ type: 'service', id: taskId })}>详情</Button>
        ) : null}
      </div>
    </div>
  )
}
