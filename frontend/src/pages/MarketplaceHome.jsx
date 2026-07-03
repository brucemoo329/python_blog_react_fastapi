import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Bike,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Compass,
  Gamepad2,
  Heart,
  Home,
  LogOut,
  Map,
  MapPin,
  MessageCircle,
  Package,
  PenLine,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CampusRadar from '@/components/CampusRadar'
import PublishDialog from '@/components/PublishDialog'
import {
  acceptServiceTask,
  getMapTasks,
  getMarketplaceFeed,
  getMarketplaceSummary,
  toggleFavorite,
} from '@/api/marketplace'
import { cn } from '@/lib/utils'
import '@/styles/marketplace.css'

const NAV_ITEMS = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'listing', label: '二手市场', icon: ShoppingBag },
  { id: 'service', label: '跑腿代取', icon: Bike },
  { id: 'game', label: '游戏交易', icon: Gamepad2 },
  { id: 'wanted', label: '求购广场', icon: Search },
  { id: 'community', label: '校园社区', icon: MessageCircle },
  { id: 'orders', label: '我的订单', icon: Package },
]

const DEMO_FEED = [
  {
    id: 101,
    type: 'listing',
    title: '平板电脑 11 英寸 深空灰 99 新',
    description: '自用国行，保护到位，带键盘保护套和手写笔，图书馆门口可验机。',
    price: 2499,
    original_price: 3299,
    location: '西区宿舍',
    image_url: '/marketplace/tablet.png',
    seller: { username: 'Starry.' },
    created_at: '刚刚',
  },
  {
    id: 102,
    type: 'service',
    task_type: 'express',
    title: '急！图书馆帮取快递',
    description: '西区快递点取一个小件，送到北区宿舍 12 栋。',
    reward: 8,
    pickup_location: '西区快递点',
    location: '北区宿舍 12 栋',
    author: { username: '小熊软糖' },
    created_at: '12 分钟前',
  },
  {
    id: 103,
    type: 'game',
    title: '机械键盘 68 键 热插拔',
    description: '宿舍升级留下，轴体顺滑无连击，支持当面试用。',
    price: 168,
    location: '东区 3 栋',
    image_url: '/marketplace/keyboard.png',
    seller: { username: 'Neon.' },
    created_at: '18 分钟前',
  },
  {
    id: 104,
    type: 'wanted',
    title: '求购《微观经济学》高鸿业第七版',
    description: '最好有笔记，不要太旧，价格可聊，本周课程急用。',
    budget_max: 30,
    location: '南通理工学院南通校区',
    image_url: '/marketplace/textbook.png',
    author: { username: '经济学小白' },
    created_at: '25 分钟前',
  },
  {
    id: 105,
    type: 'community',
    title: '分享一次超治愈的校园日落',
    description: '今天操场的晚霞也太美了吧，和室友绕场散步刚好遇见。',
    topic: '校园生活',
    image_url: '/marketplace/campus-sunset.png',
    like_count: 48,
    comment_count: 12,
    author: { username: '晚风与你' },
    created_at: '35 分钟前',
  },
]

const DEMO_TASKS = [
  { id: 201, task_type: 'express', title: '菜鸟驿站取两个小件', reward: 5, pickup_location: '菜鸟驿站', delivery_location: '北区宿舍 12 栋', requester: { username: '张同学' } },
  { id: 202, task_type: 'takeout', title: '西区饭堂三楼拿外卖', reward: 4, pickup_location: '西区饭堂', delivery_location: '东区宿舍 7 栋', requester: { username: '李同学' } },
  { id: 203, task_type: 'errand', title: '帮买感冒药', reward: 8, pickup_location: '校医院', delivery_location: '同仁堂', requester: { username: '王同学' } },
  { id: 204, task_type: 'purchase', title: '顺路带一杯冰美式', reward: 3, pickup_location: '校园咖啡厅', delivery_location: '图书馆 A 区', requester: { username: '陈同学' } },
]

const TYPE_META = {
  listing: { label: '二手', icon: ShoppingBag, tone: 'violet' },
  service: { label: '跑腿', icon: Bike, tone: 'coral' },
  game: { label: '游戏', icon: Gamepad2, tone: 'teal' },
  wanted: { label: '求购', icon: Search, tone: 'yellow' },
  community: { label: '社区', icon: MessageCircle, tone: 'blue' },
}

const INITIAL_SUMMARY = {
  active_listings: 2439,
  open_tasks: 286,
  community_posts: 1287,
  my_orders: 1,
  unread_messages: 3,
}

const PAGE_LOADED_AT = Date.now()

function FeedCard({ item, saved, onSave, onAction, onMessage }) {
  const meta = TYPE_META[item.type] || TYPE_META.listing
  const Icon = meta.icon
  const author = item.seller || item.author || { username: '校园同学' }
  const price = item.type === 'service'
    ? item.reward
    : item.type === 'wanted'
      ? item.budget_max
      : item.price
  const timeLabel = useMemo(() => {
    if (!item.created_at || item.created_at.includes('前') || item.created_at === '刚刚') {
      return item.created_at || '刚刚'
    }
    const createdAt = new Date(item.created_at)
    if (Number.isNaN(createdAt.getTime())) return '刚刚'
    const minutes = Math.max(0, Math.round((PAGE_LOADED_AT - createdAt.getTime()) / 60000))
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`
    return `${Math.floor(minutes / 1440)} 天前`
  }, [item.created_at])

  return (
    <Card className="pulse-feed-card">
      <CardContent className="pulse-feed-content">
        {item.image_url ? (
          <img className="pulse-feed-image" src={item.image_url} alt="" loading="lazy" />
        ) : (
          <div className="pulse-feed-icon" data-tone={meta.tone}><Icon /></div>
        )}
        <div className="pulse-feed-main">
          <div className="pulse-feed-heading">
            <div className="min-w-0">
              <Badge className="feed-type-badge" data-tone={meta.tone} variant="secondary">
                <Icon /> {meta.label}
              </Badge>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
            <div className="pulse-author">
              <Avatar className="size-8">
                <AvatarFallback>{author.username?.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span>{author.username}</span>
              <Badge variant="outline"><Star /> 信任优秀</Badge>
            </div>
          </div>
          <div className="pulse-feed-meta">
            <span><MapPin /> {item.location || '校内面交'}</span>
            <span><Clock3 /> {timeLabel}</span>
          </div>
          <div className="pulse-feed-footer">
            <strong>
              {item.type === 'community'
                ? `${item.like_count || 0} 人喜欢`
                : `${item.type === 'wanted' ? '预算 ' : ''}¥${price || '面议'}`}
            </strong>
            <div>
              <Button variant="outline" size="sm" onClick={() => onSave(item)}>
                <Bookmark className={cn(saved && 'fill-current')} />
                {saved ? '已收藏' : '收藏'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onMessage(item)}><MessageCircle /> 私信</Button>
              <Button size="sm" onClick={() => onAction(item)}>
                {item.type === 'service' ? '接单' : item.type === 'wanted' ? '联系 TA' : item.type === 'community' ? '参与讨论' : '查看详情'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MarketplaceHome({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState('home')
  const [view, setView] = useState('pulse')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [feed, setFeed] = useState(DEMO_FEED)
  const [tasks, setTasks] = useState(DEMO_TASKS)
  const [summary, setSummary] = useState(INITIAL_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishType, setPublishType] = useState('listing')
  const [campus, setCampus] = useState('南通理工学院南通校区')
  const [savedIds, setSavedIds] = useState(new Set())
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [feedResponse, taskResponse, summaryResponse] = await Promise.all([
        getMarketplaceFeed({ kind: filter === 'all' ? 'all' : filter, search }),
        getMapTasks(),
        getMarketplaceSummary(),
      ])
      if (feedResponse.items?.length) setFeed(feedResponse.items)
      if (taskResponse?.length) setTasks(taskResponse)
      setSummary((current) => ({ ...current, ...summaryResponse }))
    } catch {
      // Demo content keeps the home useful while the local API or database is offline.
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    const timer = window.setTimeout(loadData, search ? 280 : 0)
    return () => window.clearTimeout(timer)
  }, [loadData, search])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const filteredFeed = useMemo(() => {
    const query = search.trim().toLowerCase()
    return feed.filter((item) => {
      const matchesKind = filter === 'all' || item.type === filter
      const matchesSearch = !query || `${item.title} ${item.description}`.toLowerCase().includes(query)
      return matchesKind && matchesSearch
    })
  }, [feed, filter, search])

  const handleSave = async (item) => {
    setSavedIds((current) => {
      const next = new Set(current)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
    if (item.type === 'listing' && item.id < 100) {
      try {
        await toggleFavorite(item.id)
      } catch {
        setNotice('已保存到本地收藏')
      }
    }
  }

  const handleAction = async (item) => {
    if (item.type === 'service' && item.id < 100) {
      try {
        await acceptServiceTask(item.id)
        setNotice('接单成功，可在“我的订单”查看进度')
        loadData()
        return
      } catch (error) {
        setNotice(error.response?.data?.detail || '演示任务已加入待办')
        return
      }
    }
    setNotice(item.type === 'community' ? '已打开话题讨论' : '详情功能已准备好继续扩展')
  }

  const selectNav = (id) => {
    setActiveNav(id)
    if (id === 'service') setView('radar')
    else setView('pulse')
    setFilter(['listing', 'service', 'game', 'wanted', 'community'].includes(id) ? id : 'all')
  }

  const openPublish = (type = 'listing') => {
    setPublishType(type)
    setPublishOpen(true)
  }

  return (
    <main className="dark campus-shell">
        <aside className="campus-sidebar">
          <button type="button" className="campus-logo" onClick={() => selectNav('home')}>
            <span><Sparkles /></span>
            <span>校园脉动<small>Campus Pulse</small></span>
          </button>
          <nav aria-label="主导航">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  className={cn(activeNav === item.id && 'is-active')}
                  onClick={() => selectNav(item.id)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
          <div className="campus-sidebar-stats">
            <p>信任等级</p>
            <strong>优秀</strong>
            <div><span /></div>
            <small>842 / 1000</small>
          </div>
          <Button className="campus-publish-button" onClick={() => openPublish('listing')}>
            <PenLine /> 发布内容
          </Button>
        </aside>

        <section className="campus-workspace">
          <header className="campus-topbar">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="campus-selector">
                  <MapPin /> {campus} <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>选择校区</DropdownMenuLabel>
                <DropdownMenuGroup>
                  {['南通理工学院南通校区', '南通理工学院海安校区'].map((item) => (
                    <DropdownMenuItem key={item} onClick={() => {
                      setCampus(item)
                      setNotice(`已切换到${item}`)
                    }}>
                      {item}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <InputGroup className="campus-search">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索商品、服务、话题或用户"
              />
            </InputGroup>
            <div className="campus-top-actions">
              <Button variant="ghost" size="icon" aria-label="通知" title="通知" onClick={() => setNotice('暂时没有新的系统通知')}><Bell /></Button>
              <Button variant="ghost" size="icon" aria-label="消息" className="relative" onClick={() => setNotice('消息中心已准备好接入会话列表')}>
                <MessageCircle />
                <span className="campus-unread">{summary.unread_messages}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="campus-profile">
                    <Avatar className="size-8"><AvatarFallback>{user?.username?.slice(0, 1) || '同'}</AvatarFallback></Avatar>
                    <span>{user?.username || '校园同学'}</span>
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => setNotice('个人主页模块已打开')}><UserRound /> 个人主页</DropdownMenuItem>
                    <DropdownMenuItem onClick={onLogout}><LogOut /> 退出登录</DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="campus-main">
            <div className="campus-center">
              <Card className="pulse-composer">
                <CardContent>
                  <Avatar className="size-10"><AvatarFallback>{user?.username?.slice(0, 1) || '同'}</AvatarFallback></Avatar>
                  <button type="button" onClick={() => openPublish('community')}>
                    分享校园动态、发布商品、服务或求助...
                  </button>
                  <Button variant="secondary" onClick={() => openPublish('community')}><PenLine /> 发布</Button>
                </CardContent>
                <div className="pulse-quick-actions">
                  <button type="button" onClick={() => openPublish('listing')}><ShoppingBag /> 发布二手</button>
                  <button type="button" onClick={() => { setView('radar'); setActiveNav('service') }}><Bike /> 跑腿代取</button>
                  <button type="button" onClick={() => openPublish('wanted')}><Search /> 发求购</button>
                  <button type="button" onClick={() => openPublish('community')}><MessageCircle /> 发话题</button>
                </div>
              </Card>

              <div className="pulse-view-switch">
                <div>
                  <button type="button" className={cn(view === 'pulse' && 'is-active')} onClick={() => setView('pulse')}>
                    <Compass /> 校园脉动
                  </button>
                  <button type="button" className={cn(view === 'radar' && 'is-active')} onClick={() => setView('radar')}>
                    <Map /> 校园雷达
                  </button>
                </div>
                <Badge variant="secondary"><span className="status-dot" /> 实时在线</Badge>
              </div>

              {view === 'radar' ? (
                <CampusRadar
                  tasks={tasks}
                  onAcceptTask={handleAction}
                  onLocate={(address) => setNotice(`定位成功：${address}`)}
                />
              ) : (
                <>
                  <Tabs value={filter} onValueChange={setFilter} className="pulse-filters">
                    <TabsList>
                      <TabsTrigger value="all">全部</TabsTrigger>
                      <TabsTrigger value="listing">二手</TabsTrigger>
                      <TabsTrigger value="service">跑腿</TabsTrigger>
                      <TabsTrigger value="game">游戏</TabsTrigger>
                      <TabsTrigger value="wanted">求购</TabsTrigger>
                      <TabsTrigger value="community">社区</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="pulse-feed">
                    {loading ? (
                      Array.from({ length: 3 }, (_, index) => (
                        <Card key={index} className="pulse-feed-card">
                          <CardContent className="flex gap-4">
                            <Skeleton className="size-28 shrink-0" />
                            <div className="flex flex-1 flex-col gap-3">
                              <Skeleton className="h-5 w-2/3" />
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-9 w-1/3" />
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : filteredFeed.length ? filteredFeed.map((item) => (
                      <FeedCard
                        key={`${item.type}-${item.id}`}
                        item={item}
                        saved={savedIds.has(item.id)}
                        onSave={handleSave}
                        onAction={handleAction}
                        onMessage={() => setNotice(`已创建与${item.seller?.username || item.author?.username || '该同学'}的会话`)}
                      />
                    )) : (
                      <Card className="pulse-empty">
                        <Search />
                        <h3>没有找到相关内容</h3>
                        <p>换个关键词，或者成为第一个发布的人。</p>
                        <Button onClick={() => openPublish('listing')}>立即发布</Button>
                      </Card>
                    )}
                  </div>
                </>
              )}
            </div>

            <aside className="campus-right-rail">
              <Card className="pulse-heat-card">
                <CardHeader>
                  <CardTitle><TrendingUp /> 今日校园热度</CardTitle>
                </CardHeader>
                <CardContent>
                  <div><strong>{summary.active_listings.toLocaleString()}</strong><span>在售好物</span></div>
                  <div><strong>{summary.community_posts.toLocaleString()}</strong><span>活跃发布</span></div>
                  <div><strong>{summary.open_tasks}</strong><span>待接任务</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>热门话题</CardTitle><Button variant="ghost" size="sm" onClick={() => { setFilter('community'); setNotice('已展示全部校园话题') }}>更多</Button></CardHeader>
                <CardContent className="pulse-topic-list">
                  <button type="button" onClick={() => setNotice('正在浏览：你的宿舍美食推荐')}><span>#</span> 你的宿舍美食推荐 <small>1283</small></button>
                  <button type="button" onClick={() => setNotice('正在浏览：新学期好物清单')}><span>#</span> 新学期好物清单 <small>956</small></button>
                  <button type="button" onClick={() => setNotice('正在浏览：校园拍照打卡点')}><span>#</span> 校园拍照打卡点 <small>812</small></button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>我的订单</CardTitle><Badge variant="secondary">{summary.my_orders} 进行中</Badge></CardHeader>
                <CardContent className="pulse-order">
                  <div><Bike /><span><strong>帮取快递送到北区宿舍</strong><small>预计送达 12:30</small></span></div>
                  <div className="order-progress"><span className="done" /><span className="active" /><span /><span /></div>
                  <div className="order-labels"><span>已接单</span><span>取件中</span><span>送达中</span><span>完成</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>附近靠谱同学</CardTitle><CheckCircle2 /></CardHeader>
                <CardContent className="pulse-people">
                  {['小林同学', '阿白学长', '可乐不加冰'].map((name, index) => (
                    <div key={name}>
                      <Avatar className="size-8"><AvatarFallback>{name.slice(0, 1)}</AvatarFallback></Avatar>
                      <span><strong>{name}</strong><small>信任优秀 · {(1.1 + index * 0.6).toFixed(1)}km</small></span>
                      <Button variant="outline" size="sm" onClick={() => setNotice(`已创建与${name}的会话`)}>私信</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </aside>
          </div>
        </section>

        <nav className="campus-mobile-nav" aria-label="移动端导航">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} type="button" className={cn(activeNav === item.id && 'is-active')} onClick={() => selectNav(item.id)}>
                <Icon /><span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {notice ? <div className="campus-notice" role="status"><CheckCircle2 /> {notice}</div> : null}
        <PublishDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          initialType={publishType}
          onPublished={(message) => {
            setNotice(message)
            loadData()
          }}
        />
    </main>
  )
}
