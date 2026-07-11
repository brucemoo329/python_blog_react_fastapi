import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bike,
  Box,
  Clock3,
  LocateFixed,
  Navigation,
  PackageCheck,
  ShoppingBasket,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  createAMapGeolocation,
  describeAMapLocateResult,
  loadAMap,
  MARKER_HTML,
  resolveSchoolLocation,
  schoolFallbackLngLat,
} from '@/lib/amap'
import { getGeolocationBlockReason, geolocationErrorMessage, isSecureGeolocationContext } from '@/lib/geolocation'

const TASK_META = {
  express: { label: '帮拿快递', icon: PackageCheck },
  takeout: { label: '帮拿外卖', icon: ShoppingBasket },
  errand: { label: '跑腿代办', icon: Bike },
  purchase: { label: '代购', icon: Box },
}

export default function CampusRadar({ tasks, school = '南通理工学院', onAcceptTask, onOpenTask, onLocate }) {
  const [filter, setFilter] = useState('all')
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id)
  const [mapStatus, setMapStatus] = useState('地图加载中...')
  const [isLocating, setIsLocating] = useState(false)
  const [schoolPoint, setSchoolPoint] = useState(() => {
    // Prefer known coords for this school only — never force another university's campus
    const fb = schoolFallbackLngLat(school) || [116.397, 39.908]
    return { lng: fb[0], lat: fb[1], name: school }
  })
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const amapRef = useRef(null)
  const geolocationRef = useRef(null)
  const taskMarkersRef = useRef([])
  const userMarkerRef = useRef(null)
  const schoolMarkerRef = useRef(null)
  const visibleTasks = useMemo(
    () => tasks.filter((task) => filter === 'all' || task.task_type === filter),
    [filter, tasks],
  )

  const schoolCenter = useMemo(
    () => [schoolPoint.lng, schoolPoint.lat],
    [schoolPoint.lng, schoolPoint.lat],
  )

  const locateUser = useCallback(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    const geolocation = geolocationRef.current
    if (!map || !AMap || !geolocation) {
      setMapStatus('地图仍在初始化，请稍后重试')
      return
    }

    setIsLocating(true)
    if (!isSecureGeolocationContext()) {
      setMapStatus('当前为 HTTP，浏览器不会弹位置权限；正在尝试粗定位…')
    } else {
      setMapStatus('正在获取实时位置，请允许浏览器位置权限…')
    }

    geolocation.getCurrentPosition((status, result) => {
      setIsLocating(false)
      const parsed = describeAMapLocateResult(status, result)
      if (parsed.ok) {
        const position = parsed.position
        map.setZoomAndCenter(parsed.approximate ? 14 : 17, position)
        if (userMarkerRef.current) map.remove(userMarkerRef.current)
        userMarkerRef.current = new AMap.Marker({
          position,
          anchor: 'center',
          title: '我的位置',
          content: MARKER_HTML.me,
          zIndex: 200,
        })
        map.add(userMarkerRef.current)
        const note = parsed.approximate
          ? `粗定位：${parsed.address}`
          : `已定位：${parsed.address}`
        setMapStatus(note)
        onLocate?.(parsed.address)
        return
      }

      const block = getGeolocationBlockReason()
      setMapStatus(block === 'insecure' ? geolocationErrorMessage('insecure') : parsed.message)
      map.setZoomAndCenter(16, schoolCenter)
    })
  }, [onLocate, schoolCenter])

  // Resolve school location via AMap when profile school changes
  useEffect(() => {
    let cancelled = false
    const instant = schoolFallbackLngLat(school)
    if (instant) {
      setSchoolPoint({ lng: instant[0], lat: instant[1], name: school, approximate: true })
    }
    resolveSchoolLocation(school).then((point) => {
      if (cancelled) return
      setSchoolPoint(point)
      setMapStatus(`已标注学校：${point.name}${point.approximate ? '（近似）' : ''} · 待接任务可点`)
      // Pan map immediately when school changes
      if (mapRef.current) {
        try {
          mapRef.current.setZoomAndCenter(16, [point.lng, point.lat])
        } catch { /* ignore */ }
      }
    })
    return () => { cancelled = true }
  }, [school])

  useEffect(() => {
    let disposed = false
    const center = schoolFallbackLngLat(school) || [schoolPoint.lng, schoolPoint.lat]

    loadAMap()
      .then((AMap) => {
        if (disposed || !mapContainerRef.current) return
        amapRef.current = AMap
        // Reuse map if exists; only create once
        if (!mapRef.current) {
          const map = new AMap.Map(mapContainerRef.current, {
            center,
            zoom: 16,
            viewMode: '2D',
            mapStyle: 'amap://styles/whitesmoke',
            resizeEnable: true,
          })
          map.addControl(new AMap.Scale())
          map.addControl(new AMap.ToolBar({ position: { right: '12px', bottom: '18px' } }))
          mapRef.current = map
          geolocationRef.current = createAMapGeolocation(AMap)
          map.addControl(geolocationRef.current)
          try {
            map.setZoomAndCenter(16, center)
          } catch { /* ignore */ }
        } else {
          mapRef.current.setZoomAndCenter(16, center)
        }
        setMapStatus(`校园雷达 · ${school || '本校'} 待接任务`)
      })
      .catch((error) => {
        console.error('AMap load error:', error)
        setMapStatus('高德地图加载失败，请检查 Key、域名白名单和网络')
      })

    return () => {
      disposed = true
      // Do not destroy map on school change — only on unmount handled below
    }
  }, [school])

  useEffect(() => () => {
    taskMarkersRef.current = []
    userMarkerRef.current = null
    schoolMarkerRef.current = null
    geolocationRef.current = null
    if (mapRef.current) {
      mapRef.current.destroy()
      mapRef.current = null
    }
  }, [])

  // Update school marker when geocoded school point is ready
  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!map || !AMap || !schoolPoint) return
    const position = [schoolPoint.lng, schoolPoint.lat]
    if (schoolMarkerRef.current) {
      map.remove(schoolMarkerRef.current)
      schoolMarkerRef.current = null
    }
    schoolMarkerRef.current = new AMap.Marker({
      position,
      title: schoolPoint.name,
      zIndex: 80,
      content: `<div class="errand-marker errand-marker-school"><span>校</span></div>`,
      label: {
        content: schoolPoint.name,
        direction: 'top',
        offset: new AMap.Pixel(0, -4),
      },
    })
    map.add(schoolMarkerRef.current)
    map.setZoomAndCenter(16, position)
  }, [schoolPoint])

  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!map || !AMap) return

    if (taskMarkersRef.current.length) {
      map.remove(taskMarkersRef.current)
    }

    taskMarkersRef.current = visibleTasks
      .filter((task) => Number.isFinite(Number(task.longitude ?? task.pickup_longitude)) && Number.isFinite(Number(task.latitude ?? task.pickup_latitude)))
      .map((task) => {
        const position = [
          Number(task.longitude ?? task.pickup_longitude),
          Number(task.latitude ?? task.pickup_latitude),
        ]
        const marker = new AMap.Marker({
          position,
          anchor: 'bottom-center',
          title: task.title,
          content: MARKER_HTML.openTask(task.reward),
          zIndex: selectedTaskId === task.id ? 160 : 100,
        })
        marker.on('click', () => {
          setSelectedTaskId(task.id)
          onOpenTask?.({ ...task, type: 'service', id: task.id })
        })
        return marker
      })

    if (taskMarkersRef.current.length) {
      map.add(taskMarkersRef.current)
    }
  }, [visibleTasks, selectedTaskId, mapStatus, onOpenTask])

  return (
    <section className="campus-radar-grid">
      <Card className="campus-map-card overflow-hidden py-0">
        <div className="campus-map-toolbar">
          <div>
            <p className="text-sm font-semibold">校园雷达 · 待接任务</p>
            <p className="text-xs text-muted-foreground">显示可接单的跑腿任务，点击标记进入详情</p>
          </div>
          <Button variant="secondary" size="sm" onClick={locateUser} disabled={isLocating}>
            <LocateFixed data-icon="inline-start" />
            {isLocating ? '定位中...' : '定位到我'}
          </Button>
        </div>
        <div className="campus-map-stage">
          <div ref={mapContainerRef} className="campus-amap" aria-label="待接跑腿任务地图" />
          <div className="campus-map-status">
            <span className="status-dot" />
            {mapStatus}
          </div>
        </div>
      </Card>

      <Card className="campus-task-panel">
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>待接任务</CardTitle>
            <Badge variant="secondary">{visibleTasks.length} 单</Badge>
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="w-full">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="express">快递</TabsTrigger>
              <TabsTrigger value="takeout">外卖</TabsTrigger>
              <TabsTrigger value="errand">跑腿</TabsTrigger>
              <TabsTrigger value="purchase">代购</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="campus-task-list">
          {!visibleTasks.length ? (
            <div className="radar-empty">暂时没有待接任务，去发布一个跑腿吧。</div>
          ) : null}
          {visibleTasks.map((task) => {
            const meta = TASK_META[task.task_type] || TASK_META.errand
            const Icon = meta.icon
            return (
              <article
                key={task.id}
                className={cn('radar-task-item', selectedTaskId === task.id && 'is-selected')}
                onMouseEnter={() => setSelectedTaskId(task.id)}
                onClick={() => onOpenTask?.({ ...task, type: 'service', id: task.id })}
                onKeyDown={(event) => { if (event.key === 'Enter') onOpenTask?.({ ...task, type: 'service', id: task.id }) }}
                tabIndex={0}
              >
                <div className="radar-task-icon">
                  <Icon />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="outline">{meta.label}</Badge>
                      <h3>{task.title}</h3>
                    </div>
                    <strong>¥{task.reward}</strong>
                  </div>
                  <p>
                    <Navigation /> {task.pickup_location || '取货点'} → {task.delivery_location || task.location}
                  </p>
                  <div className="radar-task-footer">
                    <span className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage src={task.requester?.avatar_url || undefined} alt={task.requester?.nickname || task.requester?.username} />
                        <AvatarFallback>{task.requester?.username?.slice(0, 1) || '同'}</AvatarFallback>
                      </Avatar>
                      {task.requester?.nickname || task.requester?.username || '校园同学'}
                    </span>
                    <span><Clock3 /> 待接单</span>
                    <Button
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        onAcceptTask({ ...task, type: 'service' })
                      }}
                    >
                      接单
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </CardContent>
      </Card>
    </section>
  )
}
