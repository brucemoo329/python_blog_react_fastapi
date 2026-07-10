import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Bike,
  Bookmark,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
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
  Repeat2,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Shield,
  Trash2,
  UserPlus,
  UserRound,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import CheckoutPlaceholder from '@/components/CheckoutPlaceholder'
import ContentDetail from '@/components/ContentDetail'
import LineSidebar from '@/components/LineSidebar'
import AdminPanel from '@/components/AdminPanel'
import MessagesCenter from '@/components/MessagesCenter'
import OrdersCenter from '@/components/OrdersCenter'
import Particles from '@/components/Particles'
import ProfileCenter from '@/components/ProfileCenter'
import PublicProfile from '@/components/PublicProfile'
import PublishDialog from '@/components/PublishDialog'
import QuickChat from '@/components/QuickChat'
import SpotlightCard from '@/components/SpotlightCard'
import StarBorder from '@/components/StarBorder'
import {
  acceptServiceTask,
  clearAllNotifications,
  deleteNotification,
  getMapTasks,
  getMarketplaceFeed,
  getMarketplaceSummary,
  getNotifications,
  getOrderDetail,
  markAllNotificationsRead,
  markNotificationRead,
  recordBrowsingHistory,
  shareContent,
  toggleFavorite,
  toggleFollow,
  toggleReaction,
  updateUserProfile,
} from '@/api/marketplace'
import { cn } from '@/lib/utils'
import '@/styles/marketplace.css'

const NAV_ITEMS = [
  { id: 'home', label: '首页', labels: { en: 'Home', ja: 'ホーム', ko: '홈' }, icon: Home },
  { id: 'listing', label: '二手市场', labels: { en: 'Market', ja: '中古市', ko: '중고장터' }, icon: ShoppingBag },
  { id: 'service', label: '跑腿代取', labels: { en: 'Errands', ja: '代行', ko: '심부름' }, icon: Bike },
  { id: 'game', label: '游戏交易', labels: { en: 'Games', ja: 'ゲーム', ko: '게임' }, icon: Gamepad2 },
  { id: 'wanted', label: '求购广场', labels: { en: 'Wanted', ja: '求む', ko: '구해요' }, icon: Search },
  { id: 'community', label: '校园社区', labels: { en: 'Community', ja: 'コミュニティ', ko: '커뮤니티' }, icon: MessageCircle },
  { id: 'orders', label: '我的订单', labels: { en: 'Orders', ja: '注文', ko: '주문' }, icon: Package },
  { id: 'profile', label: '我的主页', labels: { en: 'Profile', ja: 'プロフィール', ko: '프로필' }, icon: UserRound },
]

const MOBILE_NAV_ITEMS = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  NAV_ITEMS[2],
  { id: 'messages', label: '私信', labels: { en: 'Messages', ja: 'メッセージ', ko: '메시지' }, icon: MessageCircle },
  NAV_ITEMS[7],
]

const UI_COPY = {
  'zh-CN': { search: '搜索商品、服务、话题或用户', campusLabel: '选择校区', publish: '发布内容', trust: '信任等级', profile: '个人主页', logout: '退出登录' },
  'en-US': { search: 'Search items, services, topics or users', campusLabel: 'Choose school', publish: 'Publish', trust: 'Trust level', profile: 'Profile', logout: 'Log out' },
  'ja-JP': { search: '商品、サービス、話題、ユーザーを検索', campusLabel: '学校を選択', publish: '投稿', trust: '信頼レベル', profile: 'プロフィール', logout: 'ログアウト' },
  'ko-KR': { search: '상품, 서비스, 주제, 사용자를 검색', campusLabel: '학교 선택', publish: '게시', trust: '신뢰 등급', profile: '프로필', logout: '로그아웃' },
}

const TYPE_META = {
  listing: { label: '二手', icon: ShoppingBag, tone: 'violet' },
  service: { label: '跑腿', icon: Bike, tone: 'coral' },
  game: { label: '游戏', icon: Gamepad2, tone: 'teal' },
  wanted: { label: '求购', icon: Search, tone: 'yellow' },
  community: { label: '社区', icon: MessageCircle, tone: 'blue' },
}

const EMPTY_SUMMARY = {
  active_listings: 0,
  open_tasks: 0,
  community_posts: 0,
  my_orders: 0,
  unread_messages: 0,
  unread_notifications: 0,
  topics: [],
  nearby_users: [],
  recent_order: null,
}

const PAGE_LOADED_AT = Date.now()
const itemKey = (item) => `${item.type || item.item_type}-${item.id || item.item_id}`

function getLangGroup(language) {
  if (language?.startsWith('en')) return 'en'
  if (language?.startsWith('ja')) return 'ja'
  if (language?.startsWith('ko')) return 'ko'
  return 'zh'
}

function relativeTime(value) {
  if (!value) return '刚刚'
  const createdAt = new Date(value)
  if (Number.isNaN(createdAt.getTime())) return '刚刚'
  const minutes = Math.max(0, Math.round((PAGE_LOADED_AT - createdAt.getTime()) / 60000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`
  return `${Math.floor(minutes / 1440)} 天前`
}

function FeedCard({ item, saved, onOpen, onOpenUser, onSave, onReact, onShare, onMessage, onPurchase, onTopic }) {
  const meta = TYPE_META[item.type] || TYPE_META.listing
  const Icon = meta.icon
  const author = item.seller || item.author || item.requester || {}
  const price = item.type === 'service' ? item.reward : item.type === 'wanted' ? item.budget_max : item.price
  const stop = (handler) => (event) => { event.stopPropagation(); handler?.() }

  return (
    <article
      className="x-feed-post"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => { if (event.key === 'Enter') onOpen(item) }}
    >
      <button type="button" className="x-feed-avatar" onClick={stop(() => onOpenUser(author.id))}>
        <Avatar className="size-11"><AvatarImage src={author.avatar_url || undefined} alt={author.nickname || author.username} /><AvatarFallback>{(author.nickname || author.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
        <span className={author.is_online ? 'presence-dot is-online' : 'presence-dot'} />
      </button>
      <div className="x-feed-body">
        <div className="x-feed-author">
          <button type="button" onClick={stop(() => onOpenUser(author.id))}><strong>{author.nickname || author.username || '校园同学'}</strong><span>@{author.username || 'campus'} · {relativeTime(item.created_at)}</span></button>
          <Badge variant="outline" data-tone={meta.tone}><Icon /> {meta.label}</Badge>
        </div>
        <h3>{item.title || '校园动态'}</h3>
        <p>{item.description}</p>
        {item.topic ? <button type="button" className="x-feed-topic" onClick={stop(() => onTopic(item.topic))}>#{item.topic}</button> : null}
        {item.image_url ? <div className="x-feed-media"><img src={item.image_url} alt="" loading="lazy" /></div> : null}
        {item.source ? <button type="button" className="x-feed-source" onClick={stop(() => onOpen({ type: item.source.type, id: item.source.id, title: item.source.title }))}><Repeat2 /> 原内容：{item.source.title}</button> : null}
        <div className="x-feed-context"><span><MapPin /> {item.school || item.location || '校内'}</span>{item.type !== 'community' ? <strong>{item.type === 'wanted' ? '预算 ' : ''}¥{price ?? '面议'}</strong> : null}</div>
        <div className="x-feed-actions">
          <button type="button" onClick={stop(() => onOpen(item))}><MessageCircle /><span>{item.comment_count || 0}</span></button>
          <button type="button" onClick={stop(() => onShare(item))}><Repeat2 /><span>{item.repost_count || 0}</span></button>
          <button type="button" className={cn(item.reaction?.my_reaction === 'like' && 'is-like')} onClick={stop(() => onReact(item, 'like'))}><Heart className={cn(item.reaction?.my_reaction === 'like' && 'fill-current')} /><span>{item.reaction?.likes || item.like_count || 0}</span></button>
          <button type="button" className={cn(saved && 'is-saved')} onClick={stop(() => onSave(item))}><Bookmark className={cn(saved && 'fill-current')} /></button>
          {item.type !== 'community' ? <Button size="sm" onClick={stop(() => onPurchase(item))}>{item.type === 'service' ? '接单' : item.type === 'wanted' ? '我有货' : '购买'}</Button> : null}
          <Button variant="ghost" size="icon" aria-label="私信发布者" onClick={stop(() => onMessage(item))}><MessageCircle /></Button>
        </div>
      </div>
    </article>
  )
}

export default function MarketplaceHome({ user, onLogout, onUserUpdate }) {
  const [currentUser, setCurrentUser] = useState(user)
  const [activeNav, setActiveNav] = useState('home')
  const [view, setView] = useState('pulse')
  const [filter, setFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('')
  const [search, setSearch] = useState('')
  const [feed, setFeed] = useState([])
  const [tasks, setTasks] = useState([])
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishType, setPublishType] = useState('listing')
  const [campus, setCampus] = useState(user?.profile?.school || '南通理工学院')
  const [savedKeys, setSavedKeys] = useState(new Set())
  const [notice, setNotice] = useState('')
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [checkoutItem, setCheckoutItem] = useState(null)
  const [publicUserId, setPublicUserId] = useState(null)
  const [quickChatRequest, setQuickChatRequest] = useState(null)
  const [initialConversationId, setInitialConversationId] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)

  const language = currentUser?.profile?.language || localStorage.getItem('campus_language') || 'zh-CN'
  const isAdmin = Boolean(currentUser?.is_admin)
  const langGroup = getLangGroup(language)
  const copy = UI_COPY[language] || UI_COPY['zh-CN']
  const displayProfile = currentUser?.profile || {}
  const displayName = displayProfile.nickname || currentUser?.username || '校园同学'
  const displayAvatar = displayProfile.avatar_url
  const trustScore = currentUser?.trust?.score ?? summary.trust?.score ?? 800
  const trustGrade = currentUser?.trust?.grade ?? summary.trust?.grade ?? '优秀'

  useEffect(() => {
    setCurrentUser(user)
    if (user?.profile?.school) setCampus(user.profile.school)
  }, [user])

  const loadNotifications = useCallback(async () => {
    try {
      const response = await getNotifications()
      setNotifications(response.items || [])
      setSummary((current) => ({ ...current, unread_notifications: response.unread || 0 }))
    } catch {
      // The main feed remains usable if notification polling is temporarily unavailable.
    }
  }, [])

  const handleUnreadMessagesChange = useCallback((count) => {
    setSummary((current) => {
      if (current.unread_messages === count) return current
      return { ...current, unread_messages: count }
    })
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [feedResponse, taskResponse, summaryResponse] = await Promise.all([
        getMarketplaceFeed({ kind: filter === 'all' ? 'all' : filter, search, topic: topicFilter }),
        getMapTasks(),
        getMarketplaceSummary(),
      ])
      const items = feedResponse.items || []
      setFeed(items)
      setTasks(taskResponse || [])
      setSummary((current) => ({ ...current, ...summaryResponse }))
      setSavedKeys(new Set(items.filter((item) => item.favorited).map(itemKey)))
      if (summaryResponse.profile) {
        setCurrentUser((current) => ({ ...current, profile: { ...(current?.profile || {}), ...summaryResponse.profile }, trust: summaryResponse.trust || current?.trust }))
        if (summaryResponse.profile.school) setCampus(summaryResponse.profile.school)
      }
    } catch (error) {
      setFeed([])
      setTasks([])
      setNotice(error.response?.data?.detail || '校园数据加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [filter, search, topicFilter])

  useEffect(() => {
    const timer = window.setTimeout(loadData, search ? 280 : 0)
    return () => window.clearTimeout(timer)
  }, [loadData, search])

  useEffect(() => {
    loadNotifications()
    const timer = window.setInterval(loadNotifications, 20000)
    return () => window.clearInterval(timer)
  }, [loadNotifications])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const filteredFeed = useMemo(() => {
    const query = search.trim().toLowerCase()
    return feed.filter((item) => !query || `${item.title || ''} ${item.description || ''} ${item.topic || ''}`.toLowerCase().includes(query))
  }, [feed, search])

  const handleSave = async (item) => {
    try {
      const response = await toggleFavorite(item.type, item.id)
      const key = itemKey(item)
      setSavedKeys((current) => {
        const next = new Set(current)
        if (response.favorited) next.add(key)
        else next.delete(key)
        return next
      })
      setFeed((current) => current.map((entry) => itemKey(entry) === key ? { ...entry, favorited: response.favorited } : entry))
      setNotice(response.message)
    } catch (error) {
      setNotice(error.response?.data?.detail || '收藏失败')
    }
  }

  const handleFeedReact = async (item, reactionType) => {
    try {
      const response = await toggleReaction({ target_type: item.type, target_id: item.id, reaction_type: reactionType })
      setFeed((current) => current.map((entry) => itemKey(entry) === itemKey(item) ? { ...entry, reaction: response, like_count: response.likes, dislike_count: response.dislikes } : entry))
    } catch (error) {
      setNotice(error.response?.data?.detail || '点赞失败')
    }
  }

  const handleFeedShare = async (item) => {
    try {
      const response = await shareContent({ source_type: item.type, source_id: item.id, comment: '' })
      setFeed((current) => current.map((entry) => itemKey(entry) === itemKey(item) ? { ...entry, repost_count: (entry.repost_count || 0) + 1 } : entry))
      setNotice(response.message || '已转发到校园社区')
    } catch (error) {
      setNotice(error.response?.data?.detail || '转发失败')
    }
  }

  const handleAction = async (item) => {
    const type = item.type || item.item_type || 'listing'
    const id = Number(item.item_id || item.id)
    try {
      await recordBrowsingHistory({
        item_type: type,
        item_id: id,
        title: item.title || '校园内容',
        image_url: item.image_url || item.images?.[0] || null,
        price_label: item.type === 'service' ? `¥${item.reward || 0}` : item.type === 'wanted' ? (item.budget_max ? `预算 ¥${item.budget_max}` : '预算面议') : item.price ? `¥${item.price}` : item.price_label || null,
      })
    } catch {
      // Browsing history should never block opening a post.
    }
    setCheckoutItem(null)
    setPublicUserId(null)
    setSelectedDetail({ type, id })
  }

  const openTopic = (topic) => {
    setTopicFilter(topic)
    setFilter('community')
    setActiveNav('community')
    setView('pulse')
    setSelectedDetail(null)
    setCheckoutItem(null)
    setPublicUserId(null)
  }

  const openUser = (userId) => {
    if (!userId) return
    if (userId === currentUser?.id) {
      setActiveNav('profile')
      setSelectedDetail(null)
      return
    }
    setSelectedDetail(null)
    setCheckoutItem(null)
    setPublicUserId(userId)
  }

  const openChat = (source) => {
    const targetUser = source?.user || source?.seller || source?.author || source?.requester
    if (!targetUser?.id) return setNotice('暂时无法识别该发布者')
    if (targetUser.id === currentUser?.id) return setNotice('这是你自己发布的内容')
    setQuickChatRequest({
      user: targetUser,
      context: source?.type && source?.id ? { type: source.type, id: source.id } : source?.context,
    })
  }

  const handleAcceptTask = async (task) => {
    try {
      const response = await acceptServiceTask(task.id)
      setNotice(response.message)
      loadData()
      loadNotifications()
      const requester = task.requester || task.author
      if (requester?.id) setQuickChatRequest({ user: requester, context: { type: 'service', id: task.id } })
    } catch (error) {
      setNotice(error.response?.data?.detail || '接单失败')
    }
  }

  const selectNav = (id) => {
    setActiveNav(id)
    setSelectedDetail(null)
    setCheckoutItem(null)
    setPublicUserId(null)
    setSelectedOrder(null)
    setTopicFilter('')
    if (id === 'service') setView('radar')
    else setView('pulse')
    setFilter(['listing', 'service', 'game', 'wanted', 'community'].includes(id) ? id : 'all')
  }

  const openPublish = (type = 'listing') => { setPublishType(type); setPublishOpen(true) }

  const handleProfileChange = (nextUser) => {
    const merged = { ...currentUser, ...nextUser, profile: { ...(currentUser?.profile || {}), ...(nextUser?.profile || {}) }, trust: nextUser?.trust || currentUser?.trust }
    setCurrentUser(merged)
    onUserUpdate?.(merged)
    if (merged.profile?.school) setCampus(merged.profile.school)
  }

  const openNotification = async (notification) => {
    if (!notification.is_read) {
      try { await markNotificationRead(notification.id) } catch { /* keep navigation responsive */ }
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item))
      setSummary((current) => ({ ...current, unread_notifications: Math.max(0, (current.unread_notifications || 0) - 1) }))
    }
    if (notification.type === 'admin_report' || notification.type === 'official') {
      if (isAdmin && (notification.type === 'admin_report' || notification.target_type === 'report')) {
        selectNav('admin')
        return
      }
    }
    if (notification.target_type === 'conversation') {
      setInitialConversationId(notification.target_id)
      selectNav('messages')
    } else if (notification.target_type === 'order') {
      try {
        const response = await getOrderDetail(notification.target_id)
        setSelectedOrder(response.item)
        selectNav('orders')
      } catch {
        selectNav('orders')
      }
    } else if (notification.target_type === 'user') {
      openUser(notification.target_id)
    } else if (notification.target_type && notification.target_id) {
      handleAction({ type: notification.target_type, id: notification.target_id, title: notification.title })
    }
  }

  const markAllRead = async () => {
    await markAllNotificationsRead()
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
    setSummary((current) => ({ ...current, unread_notifications: 0 }))
  }

  const removeNotification = async (event, notificationId) => {
    event.stopPropagation()
    try {
      await deleteNotification(notificationId)
      setNotifications((current) => current.filter((item) => item.id !== notificationId))
      setSummary((current) => ({ ...current, unread_notifications: Math.max(0, (current.unread_notifications || 0) - 1) }))
    } catch (error) {
      setNotice(error.response?.data?.detail || '删除通知失败')
    }
  }

  const clearNotifications = async () => {
    try {
      await clearAllNotifications()
      setNotifications([])
      setSummary((current) => ({ ...current, unread_notifications: 0 }))
      setNotice('通知已全部清除')
    } catch (error) {
      setNotice(error.response?.data?.detail || '清除通知失败')
    }
  }

  const openOrderDetail = async (order) => {
    try {
      const response = await getOrderDetail(order.id)
      setSelectedOrder(response.item)
      setActiveNav('orders')
    } catch (error) {
      setNotice(error.response?.data?.detail || '订单详情加载失败')
    }
  }

  const followBack = async (event, actor) => {
    event.stopPropagation()
    try {
      const response = await toggleFollow(actor.id)
      setNotice(response.followed ? `已关注 ${actor.nickname || actor.username}` : '已取消关注')
    } catch (error) {
      setNotice(error.response?.data?.detail || '回关失败')
    }
  }

  const showParticles = !selectedDetail && !checkoutItem && !publicUserId && !['messages', 'orders', 'admin'].includes(activeNav) && view === 'pulse'

  return (
    <main className="dark campus-shell">
      {showParticles ? <div className="campus-particles-bg" aria-hidden="true"><Particles particleColors={['#8b5cf6', '#a78bfa', '#f5d0fe']} particleCount={90} particleSpread={13} speed={0.06} particleBaseSize={72} sizeRandomness={1.2} alphaParticles disableRotation pixelRatio={1} /></div> : null}
      <aside className="campus-sidebar">
        <button type="button" className="campus-logo" onClick={() => selectNav('home')}><span><Sparkles /></span><span>校园脉动<small>Campus Pulse</small></span></button>
        <div className="campus-line-nav" aria-label="主导航"><LineSidebar items={NAV_ITEMS.map((item) => item.labels?.[langGroup] || item.label)} defaultActive={Math.max(0, NAV_ITEMS.findIndex((item) => item.id === activeNav))} accentColor="#a78bfa" textColor="rgba(216,180,254,.62)" showIndex={false} showMarker={false} maxShift={22} proximityRadius={138} itemGap={19} fontSize={1.02} smoothing={80} className="campus-main-line-sidebar" onItemClick={(index) => selectNav(NAV_ITEMS[index].id)} /></div>
        <SpotlightCard className="campus-sidebar-stats" spotlightColor="rgba(167, 139, 250, 0.34)"><p>{copy.trust}</p><strong>{trustGrade}</strong><div><span /></div><small>{trustScore} / 1000</small></SpotlightCard>
        <StarBorder as="button" type="button" className="campus-publish-button" color="#c084fc" speed="4.8s" thickness={2} onClick={() => openPublish('listing')}><PenLine /> {copy.publish}</StarBorder>
      </aside>

      <section className="campus-workspace">
        <header className="campus-topbar">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="campus-selector"><MapPin /> {campus} <ChevronDown /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start"><DropdownMenuLabel>{copy.campusLabel}</DropdownMenuLabel><DropdownMenuGroup>{['南通理工学院南通校区', '南通理工学院海安校区'].map((school) => <DropdownMenuItem key={school} onClick={async () => { try { const response = await updateUserProfile({ school }); handleProfileChange({ ...currentUser, profile: { ...(currentUser?.profile || {}), ...response.profile } }); setNotice(`已切换到${school}`) } catch (error) { setNotice(error.response?.data?.detail || '学校保存失败') } }}>{school}</DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuContent>
          </DropdownMenu>
          <InputGroup className="campus-search"><InputGroupAddon><Search /></InputGroupAddon><InputGroupInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} /></InputGroup>
          <div className="campus-top-actions">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="通知" className="relative"><Bell />{summary.unread_notifications ? <span className="campus-unread">{summary.unread_notifications}</span> : null}</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="notification-popover">
                <div className="notification-header">
                  <strong>通知</strong>
                  <div className="notification-header-actions">
                    <button type="button" onClick={markAllRead}><CheckCheck /> 全部已读</button>
                    <button type="button" onClick={clearNotifications}><Trash2 /> 一键清除</button>
                  </div>
                </div>
                <div className="notification-list">
                  {notifications.length ? notifications.map((notification) => (
                    <div key={notification.id} className={cn('notification-item', !notification.is_read && 'is-unread', notification.type === 'official' && 'is-official')}>
                      <button type="button" className="notification-main" onClick={() => openNotification(notification)}>
                        <Avatar className="size-9">
                          <AvatarImage src={notification.actor?.avatar_url || undefined} alt="" />
                          <AvatarFallback>{notification.type === 'official' ? '官' : (notification.actor?.nickname || notification.actor?.username || '校').slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <span>
                          <strong>{notification.title}</strong>
                          <small>{notification.content}</small>
                        </span>
                      </button>
                      {notification.type === 'follow' && notification.actor ? (
                        <em onClick={(event) => followBack(event, notification.actor)}><UserPlus /> 回关</em>
                      ) : null}
                      <button type="button" className="notification-delete" aria-label="删除通知" onClick={(event) => removeNotification(event, notification.id)}><Trash2 /></button>
                    </div>
                  )) : <div className="notification-empty">暂时没有通知</div>}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" aria-label="消息" className="relative" onClick={() => selectNav('messages')}><MessageCircle />{summary.unread_messages ? <span className="campus-unread">{summary.unread_messages}</span> : null}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" className="campus-profile"><Avatar className="size-8"><AvatarImage src={displayAvatar || undefined} alt={displayName} /><AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback></Avatar><span>{displayName}</span><ChevronDown /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => selectNav('profile')}><UserRound /> {copy.profile}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => selectNav('orders')}><Package /> 我的订单</DropdownMenuItem>
                  {isAdmin ? <DropdownMenuItem onClick={() => selectNav('admin')}><Shield /> 管理后台</DropdownMenuItem> : null}
                  <DropdownMenuItem onClick={onLogout}><LogOut /> {copy.logout}</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {checkoutItem ? (
          <CheckoutPlaceholder
            item={checkoutItem}
            onBack={() => { setCheckoutItem(null); handleAction(checkoutItem) }}
            onMessage={openChat}
            onAcceptTask={handleAcceptTask}
            onNotice={setNotice}
            onOrderCreated={(order) => { setCheckoutItem(null); setSelectedOrder(order); setActiveNav('orders') }}
          />
        ) : selectedDetail ? (
          <ContentDetail target={selectedDetail} currentUser={currentUser} onBack={() => setSelectedDetail(null)} onNotice={setNotice} onOpenTarget={setSelectedDetail} onOpenUser={openUser} onTopic={openTopic} onMessage={openChat} onPurchase={(item) => { setSelectedDetail(null); setCheckoutItem(item) }} onDeleted={() => { setSelectedDetail(null); loadData() }} />
        ) : publicUserId ? (
          <PublicProfile userId={publicUserId} onBack={() => setPublicUserId(null)} onOpenItem={handleAction} onMessage={(source) => openChat(source)} onNotice={setNotice} />
        ) : activeNav === 'admin' && isAdmin ? (
          <AdminPanel onBack={() => selectNav('home')} onNotice={setNotice} />
        ) : activeNav === 'orders' ? (
          selectedOrder ? (
            <section className="order-detail-panel">
              <Button variant="ghost" onClick={() => setSelectedOrder(null)}>返回订单列表</Button>
              <article className="order-detail-card">
                <header>
                  <Badge>{selectedOrder.role === 'buyer' ? '买家视角' : '卖家视角'}</Badge>
                  <h1>{selectedOrder.title}</h1>
                  <strong>{selectedOrder.status_label}</strong>
                </header>
                <p>订单号 {selectedOrder.order_no}</p>
                <p className="order-price">¥{Number(selectedOrder.amount || 0).toFixed(2)}</p>
                <p>交付方式：{selectedOrder.meeting_location || '校内当面交易'}</p>
                <p>{selectedOrder.role === 'buyer' ? `卖家：${selectedOrder.seller?.nickname || selectedOrder.seller?.username}` : `买家：${selectedOrder.buyer?.nickname || selectedOrder.buyer?.username}`}</p>
                {selectedOrder.buyer_note ? <p>买家备注：{selectedOrder.buyer_note}</p> : null}
                {selectedOrder.seller_note ? <p>卖家备注：{selectedOrder.seller_note}</p> : null}
                <div className="order-detail-actions">
                  <Button variant="outline" onClick={() => setSelectedOrder(null)}>返回列表操作</Button>
                  {selectedOrder.role === 'buyer' && selectedOrder.seller ? (
                    <Button onClick={() => openChat({ user: selectedOrder.seller, context: { type: 'listing', id: selectedOrder.listing_id, title: selectedOrder.title } })}>联系卖家</Button>
                  ) : null}
                  {selectedOrder.role === 'seller' && selectedOrder.buyer ? (
                    <Button onClick={() => openChat({ user: selectedOrder.buyer, context: { type: 'listing', id: selectedOrder.listing_id, title: selectedOrder.title } })}>联系买家</Button>
                  ) : null}
                </div>
              </article>
            </section>
          ) : (
            <OrdersCenter onBack={() => selectNav('home')} onNotice={setNotice} onOpenOrder={openOrderDetail} onPurchase={(item) => setCheckoutItem(item)} />
          )
        ) : activeNav === 'profile' ? (
          <ProfileCenter user={currentUser} onLogout={onLogout} onNotice={setNotice} onProfileChange={handleProfileChange} onOpenItem={handleAction} onOpenUser={openUser} />
        ) : activeNav === 'messages' ? (
          <MessagesCenter
            currentUser={currentUser}
            initialConversationId={initialConversationId}
            onBack={() => selectNav('home')}
            onNotice={setNotice}
            onUnreadChange={handleUnreadMessagesChange}
            onOpenOrder={openOrderDetail}
            onPurchase={(item) => { setActiveNav('home'); setCheckoutItem(item) }}
          />
        ) : (
          <div className="campus-main">
            <div className="campus-center">
              <Card className="pulse-composer"><CardContent><Avatar className="size-10"><AvatarImage src={displayAvatar || undefined} alt={displayName} /><AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback></Avatar><button type="button" onClick={() => openPublish('community')}>分享校园动态、发布商品、服务或求助...</button><Button variant="secondary" onClick={() => openPublish('community')}><PenLine /> 发布</Button></CardContent><div className="pulse-quick-actions"><button type="button" onClick={() => openPublish('listing')}><ShoppingBag /> 发布二手</button><button type="button" onClick={() => { setView('radar'); setActiveNav('service') }}><Bike /> 跑腿代取</button><button type="button" onClick={() => openPublish('wanted')}><Search /> 发求购</button><button type="button" onClick={() => openPublish('community')}><MessageCircle /> 发话题</button></div></Card>
              <div className="pulse-view-switch"><div><button type="button" className={cn(view === 'pulse' && 'is-active')} onClick={() => setView('pulse')}><Compass /> 校园脉动</button><button type="button" className={cn(view === 'radar' && 'is-active')} onClick={() => setView('radar')}><Map /> 校园雷达</button></div><Badge variant="secondary"><span className="status-dot" /> 实时在线</Badge></div>
              {view === 'radar' ? <CampusRadar tasks={tasks} onAcceptTask={handleAcceptTask} onOpenTask={handleAction} onLocate={(address) => setNotice(`定位成功：${address}`)} /> : <><Tabs value={filter} onValueChange={(value) => { setFilter(value); setTopicFilter('') }} className="pulse-filters"><TabsList><TabsTrigger value="all">全部</TabsTrigger><TabsTrigger value="listing">二手</TabsTrigger><TabsTrigger value="service">跑腿</TabsTrigger><TabsTrigger value="game">游戏</TabsTrigger><TabsTrigger value="wanted">求购</TabsTrigger><TabsTrigger value="community">社区</TabsTrigger></TabsList></Tabs>{topicFilter ? <div className="active-topic-filter"><span>#{topicFilter}</span><button type="button" onClick={() => setTopicFilter('')}>查看全部社区内容</button></div> : null}<div className="pulse-feed">{loading ? Array.from({ length: 3 }, (_, index) => <div key={index} className="x-feed-post"><Skeleton className="size-11 shrink-0 rounded-full" /><div className="flex flex-1 flex-col gap-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-28 w-full" /></div></div>) : filteredFeed.length ? filteredFeed.map((item) => <FeedCard key={itemKey(item)} item={item} saved={savedKeys.has(itemKey(item)) || item.favorited} onOpen={handleAction} onOpenUser={openUser} onSave={handleSave} onReact={handleFeedReact} onShare={handleFeedShare} onMessage={openChat} onPurchase={(entry) => setCheckoutItem(entry)} onTopic={openTopic} />) : <Card className="pulse-empty"><Search /><h3>没有找到相关内容</h3><p>换个关键词，或者成为第一个发布的人。</p><Button onClick={() => openPublish('listing')}>立即发布</Button></Card>}</div></>}
            </div>

            <aside className="campus-right-rail">
              <Card className="pulse-heat-card"><CardHeader><CardTitle><TrendingUp /> 今日校园热度</CardTitle></CardHeader><CardContent><button type="button" className="heat-stat-btn" onClick={() => selectNav('listing')}><strong>{summary.active_listings.toLocaleString()}</strong><span>在售好物</span></button><button type="button" className="heat-stat-btn" onClick={() => selectNav('community')}><strong>{summary.community_posts.toLocaleString()}</strong><span>活跃发布</span></button><button type="button" className="heat-stat-btn" onClick={() => selectNav('service')}><strong>{summary.open_tasks}</strong><span>待接任务</span></button></CardContent></Card>
              <Card><CardHeader><CardTitle>热门话题</CardTitle><Button variant="ghost" size="sm" onClick={() => selectNav('community')}>更多</Button></CardHeader><CardContent className="pulse-topic-list">{summary.topics?.length ? summary.topics.map((topic) => <button key={topic.name} type="button" onClick={() => openTopic(topic.name)}><span>#</span> {topic.name} <small>{topic.count}</small></button>) : <div className="right-rail-empty">发布第一条校园话题</div>}</CardContent></Card>
              <Card><CardHeader><CardTitle>我的订单</CardTitle><Badge variant="secondary">{summary.my_orders} 笔</Badge></CardHeader><CardContent className="pulse-order">{summary.recent_order ? <button type="button" onClick={() => selectNav('orders')}><Package /><span><strong>{summary.recent_order.title}</strong><small>{summary.recent_order.status}</small></span></button> : <div className="right-rail-empty">暂无进行中的订单</div>}</CardContent></Card>
              <Card><CardHeader><CardTitle>附近靠谱同学</CardTitle><CheckCircle2 /></CardHeader><CardContent className="pulse-people">{summary.nearby_users?.length ? summary.nearby_users.map((person) => <div key={person.id}><button type="button" className="nearby-person" onClick={() => openUser(person.id)}><Avatar className="size-8"><AvatarImage src={person.avatar_url || undefined} alt={person.nickname || person.username} /><AvatarFallback>{(person.nickname || person.username || '同').slice(0, 1)}</AvatarFallback></Avatar><span className={person.is_online ? 'presence-dot is-online' : 'presence-dot'} /><span><strong>{person.nickname || person.username}</strong><small><Star /> 信任 {person.trust?.score ?? 800} · {person.is_online ? '在线' : '近期活跃'}</small></span></button><Button variant="outline" size="sm" onClick={() => openChat({ user: person })}>私信</Button></div>) : <div className="right-rail-empty">暂无其他活跃发布者</div>}</CardContent></Card>
            </aside>
          </div>
        )}
      </section>

      <nav className="campus-mobile-nav" aria-label="移动端导航">{MOBILE_NAV_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" className={cn(activeNav === item.id && 'is-active')} onClick={() => selectNav(item.id)}><Icon /><span>{item.labels?.[langGroup] || item.label}</span>{item.id === 'messages' && summary.unread_messages ? <em>{summary.unread_messages}</em> : null}</button> })}</nav>
      {notice ? <div className="campus-notice" role="status"><CheckCircle2 /> {notice}</div> : null}
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} initialType={publishType} onPublished={(response) => { setNotice(response?.message || '发布成功'); if (response?.type && response?.id) setSelectedDetail({ type: response.type, id: response.id }); loadData() }} />
      <QuickChat request={quickChatRequest} currentUser={currentUser} onClose={() => setQuickChatRequest(null)} onNotice={setNotice} onConversationUpdate={() => { loadNotifications(); getMarketplaceSummary().then((response) => setSummary((current) => ({ ...current, ...response }))).catch(() => {}) }} onOpenCenter={() => { setInitialConversationId(null); selectNav('messages'); setQuickChatRequest(null) }} />
    </main>
  )
}
