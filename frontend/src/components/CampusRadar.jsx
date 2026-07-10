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
import { loadAMap } from '@/lib/amap'

const TASK_META = {
  express: { label: '代取快递', icon: PackageCheck },
  takeout: { label: '拿外卖', icon: ShoppingBasket },
  errand: { label: '跑腿代办', icon: Bike },
  purchase: { label: '帮买', icon: Box },
}

const SCHOOL_CENTER = [120.809261, 32.041042]

function getLocationErrorMessage(result) {
  const message = result?.message || result?.info || ''
  if (message.includes('denied') || message.includes('PERMISSION_DENIED')) {
    return '定位权限被拒绝，请在浏览器地址栏允许位置权限后重试'
  }
  if (message.includes('timeout') || message.includes('TIMEOUT')) {
    return '定位超时，请检查网络或到室外后重试'
  }
  return message ? `定位失败：${message}` : '暂时无法获取精确位置，已显示南通理工学院'
}

export default function CampusRadar({ tasks, onAcceptTask, onOpenTask, onLocate }) {
  const [filter, setFilter] = useState('all')
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id)
  const [mapStatus, setMapStatus] = useState('地图加载中...')
  const [isLocating, setIsLocating] = useState(false)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const amapRef = useRef(null)
  const geolocationRef = useRef(null)
  const taskMarkersRef = useRef([])
  const userMarkerRef = useRef(null)
  const visibleTasks = useMemo(
    () => tasks.filter((task) => filter === 'all' || task.task_type === filter),
    [filter, tasks],
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
    setMapStatus('正在获取实时位置...')
    geolocation.getCurrentPosition((status, result) => {
      setIsLocating(false)
      if (status === 'complete' && result?.position) {
        const position = [result.position.lng, result.position.lat]
        map.setZoomAndCenter(17, position)
        if (userMarkerRef.current) map.remove(userMarkerRef.current)
        userMarkerRef.current = new AMap.Marker({
          position,
          anchor: 'center',
          title: '我的实时位置',
          content: '<div class="amap-user-location"><span></span></div>',
          zIndex: 200,
        })
        map.add(userMarkerRef.current)
        const address = result.formattedAddress || result.addressComponent?.district || '当前位置'
        setMapStatus(`已定位：${address}`)
        onLocate?.(address)
        return
      }

      setMapStatus(getLocationErrorMessage(result))
      map.setZoomAndCenter(16, SCHOOL_CENTER)
    })
  }, [onLocate])

  useEffect(() => {
    let disposed = false

    loadAMap()
      .then((AMap) => {
        if (disposed || !mapContainerRef.current) return
        amapRef.current = AMap
        const map = new AMap.Map(mapContainerRef.current, {
          center: SCHOOL_CENTER,
          zoom: 16,
          viewMode: '2D',
          mapStyle: 'amap://styles/darkblue',
          resizeEnable: true,
        })
        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar({ position: { right: '12px', bottom: '18px' } }))
        map.add(new AMap.Marker({
          position: SCHOOL_CENTER,
          title: '南通理工学院',
          label: {
            content: '南通理工学院',
            direction: 'top',
          },
        }))
        mapRef.current = map
        geolocationRef.current = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 12000,
          convert: true,
          showButton: false,
          showMarker: false,
          showCircle: true,
          panToLocation: true,
          zoomToAccuracy: true,
        })
        map.addControl(geolocationRef.current)
        setMapStatus('南通理工学院 · 点击“定位到我”获取实时位置')
      })
      .catch((error) => {
        console.error('AMap load error:', error)
        setMapStatus('高德地图加载失败，请检查 Key、域名白名单和网络')
      })

    return () => {
      disposed = true
      taskMarkersRef.current = []
      userMarkerRef.current = null
      geolocationRef.current = null
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!map || !AMap) return

    if (taskMarkersRef.current.length) {
      map.remove(taskMarkersRef.current)
    }

    taskMarkersRef.current = visibleTasks
      .filter((task) => Number.isFinite(Number(task.longitude)) && Number.isFinite(Number(task.latitude)))
      .map((task) => {
        const marker = new AMap.Marker({
          position: [Number(task.longitude), Number(task.latitude)],
          anchor: 'bottom-center',
          title: task.title,
          content: `<button class="amap-task-marker">¥${Number(task.reward)}</button>`,
        })
        marker.on('click', () => setSelectedTaskId(task.id))
        return marker
      })

    if (taskMarkersRef.current.length) {
      map.add(taskMarkersRef.current)
    }
  }, [visibleTasks, mapStatus])

  return (
    <section className="campus-radar-grid">
      <Card className="campus-map-card overflow-hidden py-0">
        <div className="campus-map-toolbar">
          <div>
            <p className="text-sm font-semibold">校园雷达</p>
            <p className="text-xs text-muted-foreground">发现附近正在发生的任务</p>
          </div>
          <Button variant="secondary" size="sm" onClick={locateUser} disabled={isLocating}>
            <LocateFixed data-icon="inline-start" />
            {isLocating ? '定位中...' : '定位到我'}
          </Button>
        </div>
        <div className="campus-map-stage">
          <div ref={mapContainerRef} className="campus-amap" aria-label="南通理工学院校园任务地图" />
          <div className="campus-map-status">
            <span className="status-dot" />
            {mapStatus}
          </div>
        </div>
      </Card>

      <Card className="campus-task-panel">
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>附近任务</CardTitle>
            <Badge variant="secondary">实时更新</Badge>
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="w-full">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="express">快递</TabsTrigger>
              <TabsTrigger value="takeout">外卖</TabsTrigger>
              <TabsTrigger value="errand">跑腿</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="campus-task-list">
          {visibleTasks.map((task) => {
            const meta = TASK_META[task.task_type] || TASK_META.errand
            const Icon = meta.icon
            return (
              <article
                key={task.id}
                className={cn('radar-task-item', selectedTaskId === task.id && 'is-selected')}
                onMouseEnter={() => setSelectedTaskId(task.id)}
                onClick={() => onOpenTask?.({ ...task, type: 'service' })}
                onKeyDown={(event) => { if (event.key === 'Enter') onOpenTask?.({ ...task, type: 'service' }) }}
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
                    <Navigation /> {task.pickup_location || '校内'} → {task.delivery_location}
                  </p>
                  <div className="radar-task-footer">
                    <span className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage src={task.requester?.avatar_url || undefined} alt={task.requester?.nickname || task.requester?.username} />
                        <AvatarFallback>{task.requester?.username?.slice(0, 1) || '同'}</AvatarFallback>
                      </Avatar>
                      {task.requester?.nickname || task.requester?.username || '校园同学'}
                    </span>
                    <span><Clock3 /> 12 分钟内</span>
                    <Button size="sm" onClick={(event) => { event.stopPropagation(); onAcceptTask({ ...task, type: 'service' }) }}>接单</Button>
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
