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
  Star,
  TrendingUp,
  Shield,
  Trash2,
  UserCheck,
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
import ImageLightbox from '@/components/ImageLightbox'
import MessagesCenter from '@/components/MessagesCenter'
import OrdersCenter from '@/components/OrdersCenter'
import { LiquidGlassBar } from '@/components/ui/liquid-glass-button'
import ProfileCenter from '@/components/ProfileCenter'
import PublicProfile from '@/components/PublicProfile'
import PublishDialog from '@/components/PublishDialog'
import QuickChat from '@/components/QuickChat'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import ErrandTrackingMap from '@/components/ErrandTrackingMap'
import ErrandNavPage from '@/components/ErrandNavPage'
import SpotlightCard from '@/components/SpotlightCard'
import StarBorder from '@/components/StarBorder'
import CampusBrand from '@/components/CampusBrand'
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
import { navLabel, normalizeLang, t as translate, writeStoredLanguage } from '@/lib/i18n'
import { campusesForSchool } from '@/lib/schools'
import '@/styles/marketplace.css'

const NAV_DEFS = [
  { id: 'home', icon: Home },
  { id: 'listing', icon: ShoppingBag },
  { id: 'service', icon: Bike },
  { id: 'game', icon: Gamepad2 },
  { id: 'wanted', icon: Search },
  { id: 'community', icon: MessageCircle },
  { id: 'orders', icon: Package },
  { id: 'profile', icon: UserRound },
]

// 手机底栏：首页 / 跑腿 / 订单 / 消息 / 我的（订单入口单独露出，取消后易找回）
const MOBILE_NAV_DEFS = [
  NAV_DEFS[0],
  NAV_DEFS[2],
  NAV_DEFS[6],
  { id: 'messages', icon: MessageCircle },
  NAV_DEFS[7],
]

const TYPE_META = {
  listing: { icon: ShoppingBag, tone: 'violet' },
  service: { icon: Bike, tone: 'coral' },
  game: { icon: Gamepad2, tone: 'teal' },
  wanted: { icon: Search, tone: 'yellow' },
  community: { icon: MessageCircle, tone: 'blue' },
}

const EMPTY_SUMMARY = {
  active_errands: [],
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
const APP_UI_KEY = 'campus_app_ui'
const itemKey = (item) => `${item.type || item.item_type}-${item.id || item.item_id}`

function readAppUi() {
  try {
    const raw = sessionStorage.getItem(APP_UI_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function writeAppUi(patch) {
  try {
    sessionStorage.setItem(APP_UI_KEY, JSON.stringify({ ...readAppUi(), ...patch }))
  } catch {
    // ignore quota / private mode
  }
}

function clearAppUi() {
  try {
    sessionStorage.removeItem(APP_UI_KEY)
  } catch {
    // ignore
  }
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

function isLikedReaction(reaction) {
  if (!reaction) return false
  if (typeof reaction === 'string') return reaction === 'like'
  return reaction.my_reaction === 'like'
}

function likeCountOf(item) {
  if (typeof item?.reaction?.likes === 'number') return item.reaction.likes
  return item?.like_count || 0
}

function FeedCard({ item, saved, onOpen, onOpenUser, onSave, onReact, onShare, onMessage, onPurchase, onTopic, onPreviewImage, reactBurst, t }) {
  const meta = TYPE_META[item.type] || TYPE_META.listing
  const Icon = meta.icon
  const author = item.seller || item.author || item.requester || {}
  const authorDisabled = Boolean(author.account_disabled || author.is_deleted || author.is_active === false)
  const price = item.type === 'service' ? item.reward : item.type === 'wanted' ? item.budget_max : item.price
  const liked = isLikedReaction(item.reaction)
  const likeKey = `${item.type}-${item.id}-like`
  const stop = (handler) => (event) => { event.stopPropagation(); handler?.() }

  return (
    <article
      className="x-feed-post"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => { if (event.key === 'Enter') onOpen(item) }}
    >
      <button type="button" className="x-feed-avatar" onClick={stop(() => onOpenUser(author.id))}>
        <Avatar className={cn('size-11', authorDisabled && 'is-account-disabled')}>
          <AvatarImage src={!authorDisabled ? (author.avatar_url || undefined) : undefined} alt={author.nickname || author.username} />
          <AvatarFallback>{authorDisabled ? '禁' : (author.nickname || author.username || '同').slice(0, 1)}</AvatarFallback>
        </Avatar>
        <span className={author.is_online && !authorDisabled ? 'presence-dot is-online' : 'presence-dot'} />
      </button>
      <div className="x-feed-body">
        <div className="x-feed-author">
          <button type="button" onClick={stop(() => onOpenUser(author.id))}><strong>{author.nickname || author.username || '校园同学'}</strong><span>@{authorDisabled ? 'disabled' : (author.username || 'campus')} · {relativeTime(item.created_at)}</span></button>
          <Badge variant="outline" data-tone={meta.tone}><Icon /> {t(`type.${item.type}`, item.type)}</Badge>
        </div>
        <h3>{item.title || '校园动态'}</h3>
        <p>{item.description}</p>
        {item.topic ? <button type="button" className="x-feed-topic" onClick={stop(() => onTopic(item.topic))}>#{item.topic}</button> : null}
        {item.image_url ? (
          <button
            type="button"
            className="x-feed-media"
            onClick={stop(() => onPreviewImage?.(item.image_url))}
            aria-label="查看大图"
          >
            <img src={item.image_url} alt="" loading="lazy" />
            <span className="x-feed-media-hint">点击查看大图</span>
          </button>
        ) : null}
        {item.source ? <button type="button" className="x-feed-source" onClick={stop(() => onOpen({ type: item.source.type, id: item.source.id, title: item.source.title }))}><Repeat2 /> 原内容：{item.source.title}</button> : null}
        <div className="x-feed-context"><span><MapPin /> {item.school || item.location || '校内'}</span>{item.type !== 'community' ? <strong>{item.type === 'wanted' ? '预算 ' : ''}¥{price ?? '面议'}</strong> : null}</div>
        <div className="x-feed-actions">
          <button type="button" onClick={stop(() => onOpen(item))}><MessageCircle /><span>{item.comment_count || 0}</span></button>
          <button type="button" onClick={stop(() => onShare(item))}><Repeat2 /><span>{item.repost_count || 0}</span></button>
          <button
            type="button"
            className={cn(liked && 'is-like', reactBurst === likeKey && 'is-burst')}
            onClick={stop(() => onReact(item, 'like'))}
            aria-pressed={liked}
          >
            <Heart className={cn(liked && 'fill-current')} />
            <span>{likeCountOf(item)}</span>
          </button>
          <button type="button" className={cn(saved && 'is-saved')} onClick={stop(() => onSave(item))}><Bookmark className={cn(saved && 'fill-current')} /></button>
          {item.type !== 'community' ? (
            <Button size="sm" onClick={stop(() => onPurchase(item))}>
              {item.type === 'service' ? t('action.accept') : item.type === 'wanted' ? t('action.haveIt') : t('action.buy')}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" aria-label={t('action.dm')} onClick={stop(() => onMessage(item))}><MessageCircle /></Button>
        </div>
      </div>
    </article>
  )
}

export default function MarketplaceHome({ user, onLogout, onUserUpdate }) {
  const savedUi = useMemo(() => readAppUi(), [])
  const [currentUser, setCurrentUser] = useState(user)
  const [activeNav, setActiveNav] = useState(() => {
    const nav = savedUi.activeNav
    const allowed = new Set([...NAV_DEFS.map((item) => item.id), 'messages', 'admin'])
    if (nav === 'admin' && !user?.is_admin) return 'home'
    return allowed.has(nav) ? nav : 'home'
  })
  const [view, setView] = useState(() => (savedUi.view === 'radar' ? 'radar' : 'pulse'))
  const [filter, setFilter] = useState(() => {
    const f = savedUi.filter
    return ['all', 'listing', 'service', 'game', 'wanted', 'community'].includes(f) ? f : 'all'
  })
  const [topicFilter, setTopicFilter] = useState(() => savedUi.topicFilter || '')
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
  const [selectedDetail, setSelectedDetail] = useState(() => {
    const d = savedUi.selectedDetail
    if (d?.type && d?.id) return { type: d.type, id: Number(d.id) }
    return null
  })
  const [checkoutItem, setCheckoutItem] = useState(null)
  const [publicUserId, setPublicUserId] = useState(() => {
    const id = Number(savedUi.publicUserId)
    return Number.isFinite(id) && id > 0 ? id : null
  })
  const [quickChatRequest, setQuickChatRequest] = useState(null)
  const [initialConversationId, setInitialConversationId] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeErrand, setActiveErrand] = useState(() => {
    const taskId = Number(savedUi.activeErrandTaskId)
    return Number.isFinite(taskId) && taskId > 0 ? { taskId, tracking: null } : null
  })
  const [feedLightbox, setFeedLightbox] = useState({ open: false, images: [], index: 0 })
  const [feedReactBurst, setFeedReactBurst] = useState('')

  // Persist current screen so refresh stays on the same view
  useEffect(() => {
    writeAppUi({
      activeNav,
      view,
      filter,
      topicFilter: topicFilter || '',
      selectedDetail: selectedDetail?.type && selectedDetail?.id
        ? { type: selectedDetail.type, id: selectedDetail.id }
        : null,
      publicUserId: publicUserId || null,
      activeErrandTaskId: activeErrand?.taskId || null,
    })
  }, [activeNav, view, filter, topicFilter, selectedDetail, publicUserId, activeErrand])

  const language = normalizeLang(currentUser?.profile?.language || localStorage.getItem('campus_language') || 'zh-CN')
  const isAdmin = Boolean(currentUser?.is_admin)
  const t = useCallback((key, fallback = '') => translate(language, key, fallback), [language])
  const campusOptions = useMemo(
    () => campusesForSchool(campus || currentUser?.profile?.school),
    [campus, currentUser?.profile?.school],
  )
  const navItems = useMemo(
    () => NAV_DEFS.map((item) => ({ ...item, label: navLabel(language, item.id) })),
    [language],
  )
  const mobileNavItems = useMemo(
    () => MOBILE_NAV_DEFS.map((item) => ({ ...item, label: navLabel(language, item.id) })),
    [language],
  )
  const displayProfile = currentUser?.profile || {}
  const displayName = displayProfile.nickname || currentUser?.username || '校园同学'
  const displayAvatar = displayProfile.avatar_url
  const trustScore = currentUser?.trust?.score ?? summary.trust?.score ?? 800
  const trustGrade = currentUser?.trust?.grade ?? summary.trust?.grade ?? '优秀'
  const trustPercent = Math.min(100, Math.max(0, Math.round((Number(trustScore) / 1000) * 100)))
  const trustHue = Math.min(132, Math.max(8, Math.round(8 + trustPercent * 1.55)))
  const trustColor = `hsl(${trustHue} 68% 38%)`
  const trustSoftColor = `hsl(${trustHue} 64% 92%)`

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
      const reaction = {
        likes: response.likes,
        dislikes: response.dislikes,
        my_reaction: response.my_reaction,
      }
      setFeedReactBurst(`${item.type}-${item.id}-${reactionType}`)
      setFeed((current) => current.map((entry) => (
        itemKey(entry) === itemKey(item)
          ? { ...entry, reaction, like_count: reaction.likes, dislike_count: reaction.dislikes }
          : entry
      )))
      window.setTimeout(() => setFeedReactBurst((current) => (current === `${item.type}-${item.id}-${reactionType}` ? '' : current)), 450)
    } catch (error) {
      setNotice(error.response?.data?.detail || '点赞失败')
    }
  }

  const handleFeedShare = async (item) => {
    try {
      const response = await shareContent({ source_type: item.type, source_id: item.id, comment: '' })
      setFeed((current) => current.map((entry) => itemKey(entry) === itemKey(item) ? { ...entry, repost_count: (entry.repost_count || 0) + 1 } : entry))
      setNotice(response.message || '已转发到校园社区')
      // New community repost should appear in feed without manual refresh.
      loadData()
    } catch (error) {
      setNotice(error.response?.data?.detail || '转发失败')
    }
  }

  /** Keep homepage feed in sync when user interacts inside detail page. */
  const handleDetailItemChange = useCallback((patch) => {
    if (!patch?.id || !patch?.type) return
    const key = itemKey(patch)
    setFeed((current) => current.map((entry) => {
      if (itemKey(entry) !== key) {
        // Follow state may apply to author across multiple feed cards.
        if (patch._authorFollow && (entry.author?.id === patch._authorFollow.userId || entry.seller?.id === patch._authorFollow.userId || entry.requester?.id === patch._authorFollow.userId)) {
          const nextAuthor = {
            ...(entry.author || entry.seller || entry.requester || {}),
            is_following: patch._authorFollow.followed,
          }
          return {
            ...entry,
            author: entry.author ? nextAuthor : entry.author,
            seller: entry.seller ? nextAuthor : entry.seller,
            requester: entry.requester ? nextAuthor : entry.requester,
          }
        }
        return entry
      }
      const next = { ...entry, ...patch }
      // Keep nested author fields when only partial author patch is provided.
      if (patch.author) {
        next.author = { ...(entry.author || entry.seller || entry.requester || {}), ...patch.author }
        if (entry.seller) next.seller = { ...entry.seller, ...patch.author }
        if (entry.requester) next.requester = { ...entry.requester, ...patch.author }
      }
      delete next._authorFollow
      delete next._hideAuthorId
      return next
    }))

    if (typeof patch.favorited === 'boolean') {
      setSavedKeys((current) => {
        const next = new Set(current)
        if (patch.favorited) next.add(key)
        else next.delete(key)
        return next
      })
    }

    if (patch._hideAuthorId) {
      setFeed((current) => current.filter((entry) => {
        const ownerId = entry.author?.id || entry.seller?.id || entry.requester?.id
        return ownerId !== patch._hideAuthorId
      }))
    }
  }, [])

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

  const openErrandNav = (taskId, tracking = null) => {
    setCheckoutItem(null)
    setSelectedDetail(null)
    setPublicUserId(null)
    setSelectedOrder(null)
    setActiveErrand({ taskId, tracking })
  }

  const handleAcceptTask = async (task, preferredMode = 'ride') => {
    try {
      let payload = { travel_mode: preferredMode }
      try {
        const { getCurrentLngLat, planRoute, distanceMeters, geocodeAddress } = await import('@/lib/amap')
        const pos = await getCurrentLngLat()
        const origin = [pos.lng, pos.lat]
        let pickup = task.pickup_longitude != null
          ? [Number(task.pickup_longitude), Number(task.pickup_latitude)]
          : (task.longitude != null ? [Number(task.longitude), Number(task.latitude)] : null)
        if (!pickup && task.pickup_location) {
          try {
            const geo = await geocodeAddress(task.pickup_location)
            pickup = [geo.lng, geo.lat]
          } catch { /* ignore */ }
        }
        let route = null
        if (pickup) route = await planRoute(origin, pickup, preferredMode)
        const dist = route?.distance || distanceMeters(origin, pickup)
        payload = {
          runner_latitude: pos.lat,
          runner_longitude: pos.lng,
          travel_mode: preferredMode || route?.mode || 'ride',
          eta_seconds: route?.duration || null,
          distance_meters: dist,
        }
      } catch {
        /* still accept without live GPS */
      }
      const response = await acceptServiceTask(task.id, payload)
      setNotice(response.message || '接单成功，已为你打开导航')
      // 立刻从本地列表移除，避免对方/雷达仍看到待接
      setTasks((current) => current.filter((item) => item.id !== task.id))
      setFeed((current) => current.filter((item) => !(item.type === 'service' && item.id === task.id)))
      loadData()
      loadNotifications()
      // 接单后进入完整导航页（先规划去取货点）
      openErrandNav(task.id, response.tracking)
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
    setActiveErrand(null)
    setTopicFilter('')
    if (id === 'service') setView('radar')
    else setView('pulse')
    setFilter(['listing', 'service', 'game', 'wanted', 'community'].includes(id) ? id : 'all')
  }

  const openPublish = (type = 'listing') => { setPublishType(type); setPublishOpen(true) }

  const handleLogout = () => {
    clearAppUi()
    onLogout?.()
  }

  const handleProfileChange = (nextUser) => {
    const merged = { ...currentUser, ...nextUser, profile: { ...(currentUser?.profile || {}), ...(nextUser?.profile || {}) }, trust: nextUser?.trust || currentUser?.trust }
    setCurrentUser(merged)
    onUserUpdate?.(merged)
    if (merged.profile?.school) setCampus(merged.profile.school)
    if (merged.profile?.language) writeStoredLanguage(merged.profile.language)
  }

  const handleLanguageChange = async (nextLang) => {
    const lang = writeStoredLanguage(nextLang)
    const meta = { ...(currentUser?.profile || {}), language: lang }
    handleProfileChange({ ...currentUser, profile: meta })
    try {
      const response = await updateUserProfile({ language: lang })
      handleProfileChange({
        ...currentUser,
        profile: { ...meta, ...(response.profile || {}), language: lang },
      })
      setNotice(`${translate(lang, 'profile.langSwitched')} ${lang}`)
    } catch (error) {
      setNotice(error.response?.data?.detail || translate(lang, 'profile.langSwitched'))
    }
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

  const followBack = async (event, notification) => {
    event.stopPropagation()
    const actor = notification?.actor
    if (!actor?.id) return
    try {
      const response = await toggleFollow(actor.id)
      setNotifications((current) => current.map((item) => {
        if (item.id === notification.id) {
          return { ...item, is_following_actor: Boolean(response.followed) }
        }
        // Keep other follow notices for the same actor consistent.
        if (item.type === 'follow' && item.actor?.id === actor.id) {
          return { ...item, is_following_actor: Boolean(response.followed) }
        }
        return item
      }))
      setNotice(response.followed ? `已关注 ${actor.nickname || actor.username}` : '已取消关注')
    } catch (error) {
      setNotice(error.response?.data?.detail || '回关失败')
    }
  }

  return (
    <main className="campus-shell campus-shell--daylight">
      <aside className="campus-sidebar">
        <button type="button" className="campus-logo" onClick={() => selectNav('home')}><CampusBrand /></button>
        <div className="campus-line-nav" aria-label="主导航"><LineSidebar items={navItems.map((item) => item.label)} defaultActive={Math.max(0, navItems.findIndex((item) => item.id === activeNav))} accentColor="#5b4ae8" textColor="rgba(44,79,73,.62)" showIndex={false} showMarker={false} maxShift={34} proximityRadius={164} itemGap={21} fontSize={1.03} smoothing={72} className="campus-main-line-sidebar" onItemClick={(index) => selectNav(navItems[index].id)} /></div>
        <SpotlightCard className="campus-sidebar-stats" spotlightColor="rgba(15, 159, 131, 0.18)" style={{ '--trust-color': trustColor, '--trust-soft': trustSoftColor }}>
          <p>{t('ui.trust')}</p>
          <strong>{trustGrade}</strong>
          <div className="campus-trust-bar" role="progressbar" aria-valuenow={trustScore} aria-valuemin={0} aria-valuemax={1000} aria-label={t('ui.trust')}>
            <span style={{ width: `${trustPercent}%` }} />
          </div>
          <small>{trustScore} / 1000</small>
        </SpotlightCard>
        <StarBorder as="button" type="button" className="campus-publish-button" color="#0f9f83" speed="4.8s" thickness={2} onClick={() => openPublish('listing')}><PenLine /> {t('ui.publish')}</StarBorder>
      </aside>

      <section className="campus-workspace">
        <header className="campus-topbar">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="campus-selector"><MapPin /> {campus} <ChevronDown /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start"><DropdownMenuLabel>{t('ui.campusLabel')}</DropdownMenuLabel><DropdownMenuGroup>{campusOptions.map((school) => <DropdownMenuItem key={school} onClick={async () => { try { const response = await updateUserProfile({ school }); handleProfileChange({ ...currentUser, profile: { ...(currentUser?.profile || {}), ...response.profile, school } }); setCampus(school); setNotice(`${school}`) } catch (error) { setNotice(error.response?.data?.detail || '学校保存失败') } }}>{school}</DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuContent>
          </DropdownMenu>
          <InputGroup className="campus-search"><InputGroupAddon><Search /></InputGroupAddon><InputGroupInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('ui.search')} /></InputGroup>
          <div className="campus-top-actions">
            <LanguageSwitcher language={language} onChange={handleLanguageChange} appearance="topbar" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="通知" className="relative"><Bell />{summary.unread_notifications ? <span className="campus-unread">{summary.unread_notifications}</span> : null}</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="notification-popover">
                <div className="notification-header">
                  <strong>{t('ui.notifications')}</strong>
                  <div className="notification-header-actions">
                    <button type="button" onClick={markAllRead}><CheckCheck /> {t('ui.markAllRead')}</button>
                    <button type="button" onClick={clearNotifications}><Trash2 /> {t('ui.clearAll')}</button>
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
                        <em
                          className={cn('notification-follow-btn', notification.is_following_actor && 'is-following')}
                          onClick={(event) => followBack(event, notification)}
                        >
                          {notification.is_following_actor ? <><UserCheck /> {t('ui.following')}</> : <><UserPlus /> {t('ui.followBack')}</>}
                        </em>
                      ) : null}
                      <button type="button" className="notification-delete" aria-label="删除通知" onClick={(event) => removeNotification(event, notification.id)}><Trash2 /></button>
                    </div>
                  )) : <div className="notification-empty">{t('ui.noNotifications')}</div>}
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
                  <DropdownMenuItem onClick={() => selectNav('profile')}><UserRound /> {t('ui.profile')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => selectNav('orders')}><Package /> {t('nav.orders')}</DropdownMenuItem>
                  {isAdmin ? <DropdownMenuItem onClick={() => selectNav('admin')}><Shield /> {t('ui.admin')}</DropdownMenuItem> : null}
                  <DropdownMenuItem onClick={handleLogout}><LogOut /> {t('ui.logout')}</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {activeErrand ? (
          <ErrandNavPage
            taskId={activeErrand.taskId}
            initialTracking={activeErrand.tracking}
            currentUser={currentUser}
            onBack={() => { setActiveErrand(null); loadData() }}
            onNotice={setNotice}
            onMessage={(source) => openChat(source)}
            onFinished={() => { setActiveErrand(null); loadData() }}
          />
        ) : checkoutItem ? (
          <CheckoutPlaceholder
            language={language}
            item={checkoutItem}
            onBack={() => { setCheckoutItem(null); handleAction(checkoutItem) }}
            onMessage={openChat}
            onAcceptTask={handleAcceptTask}
            onNotice={setNotice}
            onOrderCreated={(order) => { setCheckoutItem(null); setSelectedOrder(order); setActiveNav('orders') }}
          />
        ) : selectedDetail ? (
          <ContentDetail
            language={language}
            target={selectedDetail}
            currentUser={currentUser}
            onBack={() => setSelectedDetail(null)}
            onNotice={setNotice}
            onOpenTarget={setSelectedDetail}
            onOpenUser={openUser}
            onTopic={openTopic}
            onMessage={openChat}
            onPurchase={(item) => { setSelectedDetail(null); setCheckoutItem(item) }}
            onDeleted={() => { setSelectedDetail(null); loadData() }}
            onItemChange={handleDetailItemChange}
            onFeedRefresh={loadData}
            onAcceptTask={(item) => handleAcceptTask(item, item.preferredMode || 'ride')}
            onOpenErrandNav={(taskId, tracking) => openErrandNav(taskId, tracking)}
          />
        ) : publicUserId ? (
          <PublicProfile userId={publicUserId} onBack={() => setPublicUserId(null)} onOpenItem={handleAction} onMessage={(source) => openChat(source)} onNotice={setNotice} />
        ) : activeNav === 'admin' && isAdmin ? (
          <AdminPanel onBack={() => selectNav('home')} onNotice={setNotice} />
        ) : activeNav === 'orders' ? (
          selectedOrder ? (
            <section className="order-detail-panel">
              <Button variant="ghost" onClick={() => setSelectedOrder(null)}>{t('detail.back')} · {t('orders.title')}</Button>
              <article className="order-detail-card">
                <header className="order-detail-hero">
                  <div>
                    <Badge>{selectedOrder.role === 'buyer' ? t('orders.buyerRole') : t('orders.sellerRole')}</Badge>
                    <h1>{selectedOrder.title}</h1>
                    <small>{t('orders.orderNo', '订单号')} {selectedOrder.order_no}</small>
                  </div>
                  <div className="order-detail-status">
                    <strong>{selectedOrder.status_label || selectedOrder.status}</strong>
                    <span>{selectedOrder.kind === 'service' ? '校园跑腿订单' : '校园商品订单'}</span>
                  </div>
                </header>

                {/* Trade status timeline */}
                {selectedOrder.kind !== 'service' && !selectedOrder.service_task_id ? (
                  <ol className="order-status-track" aria-label="交易进度">
                    {[
                      { key: 'pending_payment', label: '待付款' },
                      { key: 'pending_ship', label: '已付款·待发货' },
                      { key: 'shipped', label: '已发货·待收货' },
                      { key: 'completed', label: '已完成' },
                    ].map((step, index, arr) => {
                      const orderKeys = arr.map((s) => s.key)
                      const cur = selectedOrder.status === 'refunded' ? 'completed' : selectedOrder.status
                      const curIdx = orderKeys.indexOf(cur)
                      const stepIdx = index
                      const done = curIdx > stepIdx || (cur === 'completed' && step.key === 'completed') || selectedOrder.status === 'refunded'
                      const active = cur === step.key || (selectedOrder.status === 'refunded' && step.key === 'completed')
                      return (
                        <li key={step.key} className={done || active ? (active ? 'is-active' : 'is-done') : ''}>
                          <span className="order-status-dot" />
                          <em>{step.label}</em>
                          {index < arr.length - 1 ? <i className="order-status-line" /> : null}
                        </li>
                      )
                    })}
                    {selectedOrder.status === 'cancelled' ? (
                      <li className="is-active is-cancel"><span className="order-status-dot" /><em>已取消</em></li>
                    ) : null}
                    {selectedOrder.status === 'refunded' ? (
                      <li className="is-active is-refund"><span className="order-status-dot" /><em>退款完成</em></li>
                    ) : null}
                  </ol>
                ) : null}

                <button
                  type="button"
                  className="order-detail-summary is-clickable"
                  onClick={() => {
                    if (selectedOrder.listing_id) {
                      handleAction({
                        type: selectedOrder.kind === 'game' ? 'game' : 'listing',
                        id: selectedOrder.listing_id,
                        title: selectedOrder.title,
                      })
                    } else if (selectedOrder.service_task_id) {
                      handleAction({
                        type: 'service',
                        id: selectedOrder.service_task_id,
                        title: selectedOrder.title,
                      })
                    } else {
                      setNotice('该订单没有关联发布内容')
                    }
                  }}
                >
                  {selectedOrder.image_url ? <img src={selectedOrder.image_url} alt="" /> : <div className="order-detail-image-fallback"><Package /></div>}
                  <div>
                    <p>{selectedOrder.description || '点击查看对方发布的内容详情'}</p>
                    <strong className="order-price">¥{Number(selectedOrder.amount || 0).toFixed(2)}</strong>
                    <small className="order-open-content-hint">
                      {selectedOrder.listing_id || selectedOrder.service_task_id ? '点击打开发布内容详情 →' : '无关联发布内容'}
                    </small>
                  </div>
                </button>

                <div className="order-detail-info-grid">
                  <div><span>{t('orders.delivery', '交付')}</span><strong>{selectedOrder.meeting_location || t('orders.campusMeet', '校内当面交易')}</strong></div>
                  <div><span>{selectedOrder.role === 'buyer' ? t('orders.sellerRole') : t('orders.buyerRole')}</span><strong>{selectedOrder.role === 'buyer' ? (selectedOrder.seller?.nickname || selectedOrder.seller?.username) : (selectedOrder.buyer?.nickname || selectedOrder.buyer?.username)}</strong></div>
                  <div><span>售后保障</span><strong>{selectedOrder.after_sale ? (selectedOrder.after_sale.status === 'admin_pending' ? '客服裁定中' : selectedOrder.after_sale.status === 'pending_seller' ? '等待卖家协商' : selectedOrder.after_sale.status === 'refunded' ? '退款完成' : '协商处理中') : '可在订单列表申请售后'}</strong></div>
                </div>
                {selectedOrder.buyer_note ? <p className="order-detail-note"><span>买家备注</span>{selectedOrder.buyer_note}</p> : null}
                {selectedOrder.seller_note ? <p className="order-detail-note"><span>卖家备注</span>{selectedOrder.seller_note}</p> : null}
                <div className="order-detail-actions">
                  <Button variant="outline" onClick={() => setSelectedOrder(null)}>{t('detail.back')}</Button>
                  {(selectedOrder.listing_id || selectedOrder.service_task_id) ? (
                    <Button
                      variant="secondary"
                      onClick={() => handleAction({
                        type: selectedOrder.service_task_id ? 'service' : (selectedOrder.kind === 'game' ? 'game' : 'listing'),
                        id: selectedOrder.service_task_id || selectedOrder.listing_id,
                        title: selectedOrder.title,
                      })}
                    >
                      查看发布内容
                    </Button>
                  ) : null}
                  {selectedOrder.role === 'buyer' && selectedOrder.seller ? (
                    <Button onClick={() => openChat({ user: selectedOrder.seller, context: { type: 'listing', id: selectedOrder.listing_id, title: selectedOrder.title } })}>{t('ui.message')}</Button>
                  ) : null}
                  {selectedOrder.role === 'seller' && selectedOrder.buyer ? (
                    <Button onClick={() => openChat({ user: selectedOrder.buyer, context: { type: 'listing', id: selectedOrder.listing_id, title: selectedOrder.title } })}>{t('ui.message')}</Button>
                  ) : null}
                </div>
              </article>
            </section>
          ) : (
            <OrdersCenter
              language={language}
              onBack={() => selectNav('home')}
              onNotice={setNotice}
              onOpenOrder={openOrderDetail}
              onPurchase={(item) => setCheckoutItem(item)}
              onOpenErrandNav={(taskId, tracking) => openErrandNav(taskId, tracking)}
            />
          )
        ) : activeNav === 'profile' ? (
          <ProfileCenter user={currentUser} language={language} onLogout={handleLogout} onNotice={setNotice} onProfileChange={handleProfileChange} onOpenItem={handleAction} onOpenUser={openUser} />
        ) : activeNav === 'messages' ? (
          <MessagesCenter
            currentUser={currentUser}
            language={language}
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
              <Card className="pulse-composer"><CardContent><Avatar className="size-10"><AvatarImage src={displayAvatar || undefined} alt={displayName} /><AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback></Avatar><button type="button" onClick={() => openPublish('community')}>{t('ui.composerPlaceholder')}</button><Button variant="secondary" onClick={() => openPublish('community')}><PenLine /> {t('ui.publish')}</Button></CardContent><div className="pulse-quick-actions"><button type="button" onClick={() => openPublish('listing')}><ShoppingBag /> {t('ui.publishListing')}</button><button type="button" onClick={() => { setView('radar'); setActiveNav('service') }}><Bike /> {t('ui.publishService')}</button><button type="button" onClick={() => openPublish('wanted')}><Search /> {t('ui.publishWanted')}</button><button type="button" onClick={() => openPublish('community')}><MessageCircle /> {t('ui.publishCommunity')}</button></div></Card>
              <div className="pulse-view-switch"><div><button type="button" className={cn(view === 'pulse' && 'is-active')} onClick={() => setView('pulse')}><Compass /> {t('ui.pulse')}</button><button type="button" className={cn(view === 'radar' && 'is-active')} onClick={() => setView('radar')}><Map /> {t('ui.radar')}</button></div><Badge variant="secondary"><span className="status-dot" /> {t('ui.live')}</Badge></div>
              {view === 'radar' ? <CampusRadar school={campus || currentUser?.profile?.school || '南通理工学院'} tasks={tasks} onAcceptTask={handleAcceptTask} onOpenTask={handleAction} onLocate={(address) => setNotice(address)} /> : <><Tabs value={filter} onValueChange={(value) => { setFilter(value); setTopicFilter('') }} className="pulse-filters"><TabsList><TabsTrigger value="all">{t('ui.filterAll')}</TabsTrigger><TabsTrigger value="listing">{t('type.listing')}</TabsTrigger><TabsTrigger value="service">{t('type.service')}</TabsTrigger><TabsTrigger value="game">{t('type.game')}</TabsTrigger><TabsTrigger value="wanted">{t('type.wanted')}</TabsTrigger><TabsTrigger value="community">{t('type.community')}</TabsTrigger></TabsList></Tabs>{topicFilter ? <div className="active-topic-filter"><span>#{topicFilter}</span><button type="button" onClick={() => setTopicFilter('')}>{t('ui.viewAllCommunity')}</button></div> : null}<div className="pulse-feed">{loading ? Array.from({ length: 3 }, (_, index) => <div key={index} className="x-feed-post"><Skeleton className="size-11 shrink-0 rounded-full" /><div className="flex flex-1 flex-col gap-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-28 w-full" /></div></div>) : filteredFeed.length ? filteredFeed.map((item) => <FeedCard key={itemKey(item)} item={item} t={t} saved={savedKeys.has(itemKey(item)) || item.favorited} onOpen={handleAction} onOpenUser={openUser} onSave={handleSave} onReact={handleFeedReact} reactBurst={feedReactBurst} onShare={handleFeedShare} onMessage={openChat} onPurchase={(entry) => setCheckoutItem(entry)} onTopic={openTopic} onPreviewImage={(src) => setFeedLightbox({ open: true, images: [src], index: 0 })} />) : <Card className="pulse-empty"><Search /><h3>{t('ui.noFeed')}</h3><p>{t('ui.noFeedHint')}</p><Button onClick={() => openPublish('listing')}>{t('ui.publishNow')}</Button></Card>}</div></>}
            </div>

            <aside className="campus-right-rail">
              <Card className="pulse-heat-card"><CardHeader><CardTitle><TrendingUp /> {t('ui.heat')}</CardTitle></CardHeader><CardContent><button type="button" className="heat-stat-btn" onClick={() => selectNav('listing')}><strong>{summary.active_listings.toLocaleString()}</strong><span>{t('ui.activeListings')}</span></button><button type="button" className="heat-stat-btn" onClick={() => selectNav('community')}><strong>{summary.community_posts.toLocaleString()}</strong><span>{t('ui.activePosts')}</span></button><button type="button" className="heat-stat-btn" onClick={() => selectNav('service')}><strong>{summary.open_tasks}</strong><span>{t('ui.openTasks')}</span></button></CardContent></Card>
              <Card><CardHeader><CardTitle>{t('ui.hotTopics')}</CardTitle><Button variant="ghost" size="sm" onClick={() => selectNav('community')}>{t('ui.more')}</Button></CardHeader><CardContent className="pulse-topic-list">{summary.topics?.length ? summary.topics.map((topic) => <button key={topic.name} type="button" onClick={() => openTopic(topic.name)}><span>#</span> {topic.name} <small>{topic.count}</small></button>) : <div className="right-rail-empty">{t('ui.publishCommunity')}</div>}</CardContent></Card>
              <Card className="pulse-errand-orders">
                <CardHeader>
                  <CardTitle>{t('ui.myOrders')}</CardTitle>
                  <Badge variant="secondary">{(summary.active_errands?.length || 0) + (summary.recent_order ? 1 : 0)}</Badge>
                </CardHeader>
                <CardContent className="pulse-order">
                  {summary.active_errands?.length ? (
                    <details className="errand-orders-expand" open={summary.active_errands.length === 1}>
                      <summary>
                        配送进度 · {summary.active_errands.length} 单
                      </summary>
                      <div className="errand-orders-list">
                        {summary.active_errands.map((errand) => (
                          <div key={errand.id} className="errand-order-block">
                            <button type="button" className="errand-order-head" onClick={() => openErrandNav(errand.id, errand)}>
                              <Bike />
                              <span>
                                <strong>{errand.title}</strong>
                                <small>{errand.progress_text || errand.phase_label}</small>
                              </span>
                            </button>
                            <Button size="sm" className="w-full mb-2" onClick={() => openErrandNav(errand.id, errand)}>
                              打开配送导航
                            </Button>
                            <ErrandTrackingMap
                              compact
                              taskId={errand.id}
                              initialTracking={errand}
                              currentUserId={currentUser?.id}
                              onNotice={setNotice}
                              onMessageRequester={(track) => openChat({ user: track.requester, context: { type: 'service', id: track.id } })}
                              onOpenTask={() => openErrandNav(errand.id, errand)}
                            />
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  {summary.recent_order ? (
                    <button type="button" onClick={() => selectNav('orders')}>
                      <Package />
                      <span>
                        <strong>{summary.recent_order.title}</strong>
                        <small>{summary.recent_order.status}</small>
                      </span>
                    </button>
                  ) : null}
                  {!summary.active_errands?.length && !summary.recent_order ? (
                    <div className="right-rail-empty">{t('ui.noOrders')}</div>
                  ) : null}
                </CardContent>
              </Card>
              <Card><CardHeader><CardTitle>{t('ui.nearby')}</CardTitle><CheckCircle2 /></CardHeader><CardContent className="pulse-people">{summary.nearby_users?.length ? summary.nearby_users.map((person) => <div key={person.id}><button type="button" className="nearby-person" onClick={() => openUser(person.id)}><Avatar className="size-8"><AvatarImage src={person.avatar_url || undefined} alt={person.nickname || person.username} /><AvatarFallback>{(person.nickname || person.username || '同').slice(0, 1)}</AvatarFallback></Avatar><span className={person.is_online ? 'presence-dot is-online' : 'presence-dot'} /><span><strong>{person.nickname || person.username}</strong><small><Star /> {t('ui.trustScore')} {person.trust?.score ?? 800} · {person.is_online ? t('ui.online') : t('ui.recentActive')}</small></span></button><Button variant="outline" size="sm" onClick={() => openChat({ user: person })}>{t('ui.message')}</Button></div>) : <div className="right-rail-empty">{t('ui.noNearby')}</div>}</CardContent></Card>
            </aside>
          </div>
        )}
      </section>

      <LiquidGlassBar className="campus-mobile-nav" filterId="campus-mobile-nav-glass">
        <nav className="campus-mobile-nav-inner" aria-label="移动端导航">
          {mobileNavItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={cn('campus-mobile-nav-item', activeNav === item.id && 'is-active')}
                onClick={() => selectNav(item.id)}
              >
                <span className="campus-mobile-nav-icon"><Icon /></span>
                <span className="campus-mobile-nav-label">{item.label}</span>
                {item.id === 'messages' && summary.unread_messages ? <em>{summary.unread_messages}</em> : null}
              </button>
            )
          })}
        </nav>
      </LiquidGlassBar>
      {notice ? <div className="campus-notice" role="status"><CheckCircle2 /> {notice}</div> : null}
      <PublishDialog language={language} open={publishOpen} onOpenChange={setPublishOpen} initialType={publishType} onPublished={(response) => { setNotice(response?.message || t('ui.publish')); if (response?.type && response?.id) setSelectedDetail({ type: response.type, id: response.id }); loadData() }} />
      <ImageLightbox open={feedLightbox.open} images={feedLightbox.images} index={feedLightbox.index} onClose={() => setFeedLightbox((current) => ({ ...current, open: false }))} onIndexChange={(index) => setFeedLightbox((current) => ({ ...current, index }))} />
      <QuickChat request={quickChatRequest} currentUser={currentUser} onClose={() => setQuickChatRequest(null)} onNotice={setNotice} onConversationUpdate={() => { loadNotifications(); getMarketplaceSummary().then((response) => setSummary((current) => ({ ...current, ...response }))).catch(() => {}) }} onOpenCenter={() => { setInitialConversationId(null); selectNav('messages'); setQuickChatRequest(null) }} />
    </main>
  )
}
