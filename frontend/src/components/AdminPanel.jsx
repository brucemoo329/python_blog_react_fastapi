import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  Flag,
  Headset,
  Megaphone,
  Package,
  Scale,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  UserX,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import MagicBento from '@/components/MagicBento'
import {
  deleteAdminContent,
  getAdminAppeals,
  getAdminAfterSales,
  getAdminContents,
  getAdminOverview,
  getAdminReports,
  getAdminSupportTickets,
  getAdminUsers,
  handleAdminAppeal,
  handleAdminAfterSale,
  handleAdminReport,
  handleAdminSupportTicket,
  sendOfficialNotice,
  updateAdminUserPenalties,
  deleteAdminUser,
} from '@/api/marketplace'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'overview', label: '总览', icon: Shield },
  { id: 'contents', label: '内容管理', icon: Package },
  { id: 'reports', label: '举报中心', icon: Flag },
  { id: 'appeals', label: '订单申诉', icon: Scale },
  { id: 'afterSales', label: '售后裁定', icon: RotateCcw },
  { id: 'tickets', label: '客服工单', icon: Headset },
  { id: 'users', label: '用户与信誉', icon: Users },
  { id: 'notices', label: '官方通知', icon: Megaphone },
]

const OVERVIEW_CARDS = [
  { key: 'users', label: '注册用户', tab: 'users', hint: '点击查看全部用户' },
  { key: 'active_listings', label: '二手商品', tab: 'contents', contentType: 'listing', hint: '含全部状态商品，点击查看' },
  { key: 'open_tasks', label: '跑腿任务', tab: 'contents', contentType: 'service', hint: '含待接/配送中/已完成，点击查看' },
  { key: 'community_posts', label: '社区帖子', tab: 'contents', contentType: 'community', hint: '点击查看社区内容' },
  { key: 'wanted_posts', label: '求购帖子', tab: 'contents', contentType: 'wanted', hint: '点击查看求购内容' },
  { key: 'game_listings', label: '游戏交易', tab: 'contents', contentType: 'game', hint: '点击查看游戏内容' },
  { key: 'pending_reports', label: '待处理举报', tab: 'reports', reportStatus: 'pending', hint: '点击处理举报' },
  { key: 'pending_appeals', label: '待处理申诉', tab: 'appeals', appealStatus: 'pending', hint: '订单投诉申诉' },
  { key: 'pending_after_sales', label: '待裁定售后', tab: 'afterSales', hint: '退货退款争议' },
  { key: 'pending_tickets', label: '待回复工单', tab: 'tickets', ticketStatus: 'pending', hint: '用户联系客服' },
  { key: 'orders', label: '订单总数', tab: 'contents', contentType: 'all', hint: '平台订单总量' },
]

export default function AdminPanel({ onBack, onNotice }) {
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [contents, setContents] = useState([])
  const [contentType, setContentType] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [reports, setReports] = useState([])
  const [reportStatus, setReportStatus] = useState('all')
  const [appeals, setAppeals] = useState([])
  const [appealStatus, setAppealStatus] = useState('pending')
  const [afterSales, setAfterSales] = useState([])
  const [afterSaleStatus, setAfterSaleStatus] = useState('all')
  const [tickets, setTickets] = useState([])
  const [ticketStatus, setTicketStatus] = useState('pending')
  const [ticketReplies, setTicketReplies] = useState({})
  const [users, setUsers] = useState([])
  const [userKeyword, setUserKeyword] = useState('')
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', broadcast: false })
  const [selectedRecipient, setSelectedRecipient] = useState(null)
  const [noticeUserKeyword, setNoticeUserKeyword] = useState('')
  const [noticeUserResults, setNoticeUserResults] = useState([])
  const [noticeUserSearching, setNoticeUserSearching] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadOverview = useCallback(async () => {
    const data = await getAdminOverview()
    setOverview(data)
  }, [])

  const loadContents = useCallback(async () => {
    const data = await getAdminContents({ content_type: contentType, keyword })
    setContents(data.items || [])
  }, [contentType, keyword])

  const loadReports = useCallback(async () => {
    const data = await getAdminReports({ status: reportStatus })
    setReports(data.items || [])
  }, [reportStatus])

  const loadAppeals = useCallback(async () => {
    const data = await getAdminAppeals({ status: appealStatus })
    setAppeals(data.items || [])
  }, [appealStatus])

  const loadAfterSales = useCallback(async () => {
    const data = await getAdminAfterSales({ status: afterSaleStatus })
    setAfterSales(data.items || [])
  }, [afterSaleStatus])

  const loadTickets = useCallback(async () => {
    const data = await getAdminSupportTickets({ status: ticketStatus })
    setTickets(data.items || [])
  }, [ticketStatus])

  const loadUsers = useCallback(async () => {
    const data = await getAdminUsers({ keyword: userKeyword })
    setUsers(data.items || [])
  }, [userKeyword])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (tab === 'overview') await loadOverview()
        if (tab === 'contents') await loadContents()
        if (tab === 'reports') await loadReports()
        if (tab === 'appeals') await loadAppeals()
        if (tab === 'afterSales') await loadAfterSales()
        if (tab === 'tickets') await loadTickets()
        if (tab === 'users') await loadUsers()
      } catch (error) {
        if (!cancelled) onNotice?.(error.response?.data?.detail || '管理后台加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tab, loadOverview, loadContents, loadReports, loadAppeals, loadAfterSales, loadTickets, loadUsers, onNotice])

  const openOverviewCard = (card) => {
    if (card.contentType) setContentType(card.contentType)
    if (card.reportStatus) setReportStatus(card.reportStatus)
    if (card.appealStatus) setAppealStatus(card.appealStatus)
    if (card.ticketStatus) setTicketStatus(card.ticketStatus)
    if (card.tab === 'users') setUserKeyword('')
    setTab(card.tab)
  }

  const removeContent = async (item) => {
    if (!window.confirm(`确认删除「${item.title}」？`)) return
    try {
      await deleteAdminContent(item.type, item.id)
      onNotice?.('内容已删除')
      await loadContents()
      await loadOverview()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '删除失败')
    }
  }

  const resolveReport = async (report, action) => {
    try {
      const response = await handleAdminReport(report.id, {
        status: action === 'none' ? 'dismissed' : 'resolved',
        action,
        admin_note: action === 'none' ? '经核实暂不处罚' : `已处理举报：${report.reason}`,
        trust_delta: action === 'trust_penalty' ? -35 : undefined,
      })
      onNotice?.(response.message || '举报已处理')
      await loadReports()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '处理失败')
    }
  }

  const resolveAppeal = async (appeal, status) => {
    const note = window.prompt(
      status === 'approved' ? '同意申诉的备注（可选）' : '驳回申诉的原因（可选）',
      status === 'approved' ? '经核实投诉不公，已恢复信任分' : '经核实投诉成立，维持原处罚',
    )
    if (note === null) return
    try {
      const response = await handleAdminAppeal(appeal.id, {
        status,
        admin_note: note || undefined,
        restore_trust: status === 'approved',
      })
      onNotice?.(response.message || '申诉已处理')
      await loadAppeals()
      await loadOverview()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '处理失败')
    }
  }

  const replyTicket = async (ticket) => {
    const reply = (ticketReplies[ticket.id] || '').trim()
    if (!reply) {
      onNotice?.('请填写回复内容')
      return
    }
    try {
      const response = await handleAdminSupportTicket(ticket.id, {
        status: 'replied',
        admin_reply: reply,
      })
      onNotice?.(response.message || '已回复用户')
      setTicketReplies((current) => ({ ...current, [ticket.id]: '' }))
      await loadTickets()
      await loadOverview()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '回复失败')
    }
  }

  const closeTicket = async (ticket) => {
    const reply = (ticketReplies[ticket.id] || ticket.admin_reply || '已结案').trim()
    try {
      const response = await handleAdminSupportTicket(ticket.id, {
        status: 'closed',
        admin_reply: reply,
      })
      onNotice?.(response.message || '工单已关闭')
      await loadTickets()
      await loadOverview()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '关闭失败')
    }
  }

  const updateUser = async (user, patch) => {
    try {
      const response = await updateAdminUserPenalties(user.id, patch)
      onNotice?.(response.message || '用户状态已更新')
      await loadUsers()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '更新失败')
    }
  }

  const removeUser = async (user) => {
    if (!window.confirm(`确认删除账号「${user.nickname || user.username}」？账户会被停用，订单与审计记录会保留。`)) return
    try {
      const response = await deleteAdminUser(user.id)
      onNotice?.(response.message || '账户已删除')
      await loadUsers()
      await loadOverview()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '删除账户失败')
    }
  }

  const resolveAfterSale = async (request, decision) => {
    const note = window.prompt(
      decision === 'refund' ? '退款裁定说明（可选）' : '驳回售后的说明（可选）',
      decision === 'refund' ? '经客服核实，同意退货退款。' : '经客服核实，维持原交易状态。',
    )
    if (note === null) return
    try {
      const response = await handleAdminAfterSale(request.id, { decision, admin_note: note || undefined })
      onNotice?.(response.message || '售后已处理')
      await loadAfterSales()
      await loadOverview()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '售后处理失败')
    }
  }

  const searchNoticeUsers = async () => {
    const key = noticeUserKeyword.trim()
    if (!key) {
      onNotice?.('请输入用户名、昵称或邮箱进行检索')
      return
    }
    setNoticeUserSearching(true)
    try {
      const data = await getAdminUsers({ keyword: key, limit: 20 })
      setNoticeUserResults(data.items || [])
      if (!(data.items || []).length) onNotice?.('没有找到匹配用户')
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '用户检索失败')
    } finally {
      setNoticeUserSearching(false)
    }
  }

  const sendNotice = async () => {
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) {
      onNotice?.('请填写通知标题和正文')
      return
    }
    if (!noticeForm.broadcast && !selectedRecipient?.id) {
      onNotice?.('请先检索并选择接收用户，或勾选全站广播')
      return
    }
    try {
      const payload = {
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        broadcast: noticeForm.broadcast,
        recipient_user_id: noticeForm.broadcast ? undefined : selectedRecipient?.id,
      }
      const response = await sendOfficialNotice(payload)
      onNotice?.(response.message)
      setNoticeForm({ title: '', content: '', broadcast: false })
      setSelectedRecipient(null)
      setNoticeUserKeyword('')
      setNoticeUserResults([])
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '发送失败')
    }
  }

  return (
    <section className="admin-panel">
      <aside className="admin-sidebar">
        <Button variant="ghost" onClick={onBack}><ArrowLeft /> 返回平台</Button>
        <div className="admin-brand">
          <Shield />
          <div>
            <strong>Campus Official</strong>
            <span>校园交易管理后台</span>
          </div>
        </div>
        <nav>
          {TABS.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} type="button" className={cn(tab === item.id && 'is-active')} onClick={() => setTab(item.id)}>
                <Icon /> {item.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <Badge className="admin-official-badge"><BadgeCheck /> 官方控制台</Badge>
            <h1>{TABS.find((item) => item.id === tab)?.label}</h1>
          </div>
          <p>用于内容治理、举报核实、信誉管理与官方通知。</p>
        </header>

        {loading ? <div className="chat-empty">管理数据加载中...</div> : null}

        {!loading && tab === 'overview' && overview ? (
          <MagicBento
            className="admin-magic-bento"
            textAutoHide={false}
            enableStars
            enableSpotlight
            enableBorderGlow
            enableTilt
            enableMagnetism
            clickEffect
            spotlightRadius={300}
            particleCount={12}
            glowColor="132, 0, 255"
            cards={OVERVIEW_CARDS.map((card) => {
              const value = overview[card.key]
              const num = Number(value)
              const title = Number.isFinite(num) ? String(num) : String(value ?? 0)
              let description = card.hint
              if (card.key === 'open_tasks' && overview.tasks_open != null) {
                description = `待接 ${overview.tasks_open} · 配送中 ${overview.tasks_accepted ?? 0} · 完成 ${overview.tasks_completed ?? 0}`
              }
              if (card.key === 'active_listings' && overview.listings_available != null) {
                description = `在售 ${overview.listings_available} · 点击查看全部商品`
              }
              return {
                ...card,
                // Dark cards so white MagicBento text stays readable
                color: '#12241e',
                label: card.label,
                title,
                description,
              }
            })}
            onCardClick={(card) => openOverviewCard(card)}
          />
        ) : null}

        {!loading && tab === 'contents' ? (
          <div className="admin-section">
            <div className="admin-toolbar">
              <select value={contentType} onChange={(event) => setContentType(event.target.value)}>
                <option value="all">全部类型</option>
                <option value="listing">二手</option>
                <option value="game">游戏</option>
                <option value="service">跑腿</option>
                <option value="wanted">求购</option>
                <option value="community">社区</option>
              </select>
              <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题/内容" />
              <Button onClick={loadContents}>刷新</Button>
            </div>
            <div className="admin-table">
              {contents.map((item) => (
                <article key={`${item.type}-${item.id}`}>
                  <div>
                    <Badge variant="secondary">{item.type_label || item.type}</Badge>
                    <strong>{item.title}</strong>
                    <small>{item.author?.nickname || item.author?.username || '未知'} · {item.status}</small>
                    <p>{item.description?.slice(0, 100)}</p>
                  </div>
                  <div className="admin-row-actions">
                    <em>{item.price_label}</em>
                    <Button size="sm" variant="destructive" onClick={() => removeContent(item)}><Trash2 /> 删除</Button>
                  </div>
                </article>
              ))}
              {!contents.length ? <div className="chat-empty">暂无内容</div> : null}
            </div>
          </div>
        ) : null}

        {!loading && tab === 'reports' ? (
          <div className="admin-section admin-reports">
            <div className="admin-toolbar">
              <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value)}>
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="resolved">已处理</option>
                <option value="dismissed">已驳回</option>
              </select>
              <Button onClick={loadReports}>刷新</Button>
            </div>
            {reports.map((report) => (
              <article key={report.id} className={cn(report.status === 'pending' && 'is-pending')}>
                <header>
                  <Badge>{report.status}</Badge>
                  <strong>{report.reason}</strong>
                  <small>{new Date(report.created_at).toLocaleString()}</small>
                </header>
                <p>
                  <strong>{report.reporter?.nickname || report.reporter?.username}</strong>
                  {' 举报 '}
                  <strong>{report.target_user?.nickname || report.target_user?.username || report.target_title}</strong>
                  {report.description ? ` · ${report.description}` : ''}
                </p>
                <small>对象：{report.target_type}#{report.target_id} · {report.target_title}</small>
                {report.status === 'pending' ? (
                  <div className="admin-row-actions">
                    <Button size="sm" variant="outline" onClick={() => resolveReport(report, 'none')}>驳回</Button>
                    <Button size="sm" onClick={() => resolveReport(report, 'warn')}>警告</Button>
                    <Button size="sm" onClick={() => resolveReport(report, 'ban_comment')}>禁评</Button>
                    <Button size="sm" onClick={() => resolveReport(report, 'ban_post')}>禁发</Button>
                    <Button size="sm" onClick={() => resolveReport(report, 'trust_penalty')}>扣信誉</Button>
                    <Button size="sm" variant="destructive" onClick={() => resolveReport(report, 'disable_user')}>停用账号</Button>
                  </div>
                ) : (
                  <small>处理：{report.action_taken || '已处理'} {report.admin_note || ''}</small>
                )}
              </article>
            ))}
            {!reports.length ? <div className="chat-empty">暂无举报</div> : null}
          </div>
        ) : null}

        {!loading && tab === 'appeals' ? (
          <div className="admin-section admin-reports">
            <div className="admin-toolbar">
              <select value={appealStatus} onChange={(event) => setAppealStatus(event.target.value)}>
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="approved">已通过</option>
                <option value="rejected">已驳回</option>
              </select>
              <Button onClick={loadAppeals}>刷新</Button>
            </div>
            {appeals.map((appeal) => (
              <article key={appeal.id} className={cn(appeal.status === 'pending' && 'is-pending')}>
                <header>
                  <Badge>{appeal.status === 'pending' ? '待处理' : appeal.status === 'approved' ? '已通过' : '已驳回'}</Badge>
                  <strong>{appeal.order_title || appeal.order_no}</strong>
                  <small>{appeal.created_at ? new Date(appeal.created_at).toLocaleString() : ''}</small>
                </header>
                <p>
                  申诉人 <strong>{appeal.appellant?.nickname || appeal.appellant?.username}</strong>
                  {' · 订单 '}
                  {appeal.order_no || `#${appeal.order_id}`}
                </p>
                <p>申诉理由：{appeal.reason}</p>
                {appeal.review ? (
                  <small>
                    原投诉：{appeal.review.is_complaint ? '投诉' : '评价'} {appeal.review.rating} 星 · {appeal.review.content}
                  </small>
                ) : null}
                {appeal.status === 'pending' ? (
                  <div className="admin-row-actions">
                    <Button size="sm" onClick={() => resolveAppeal(appeal, 'approved')}>同意申诉（恢复信任分）</Button>
                    <Button size="sm" variant="destructive" onClick={() => resolveAppeal(appeal, 'rejected')}>驳回申诉</Button>
                  </div>
                ) : (
                  <small>处理备注：{appeal.admin_note || '—'}</small>
                )}
              </article>
            ))}
            {!appeals.length ? <div className="chat-empty">暂无申诉</div> : null}
          </div>
        ) : null}

        {!loading && tab === 'afterSales' ? (
          <div className="admin-section admin-reports">
            <div className="admin-toolbar">
              <select value={afterSaleStatus} onChange={(event) => setAfterSaleStatus(event.target.value)}>
                <option value="all">全部售后</option>
                <option value="pending_seller">等待卖家协商</option>
                <option value="admin_pending">待客服裁定</option>
                <option value="refunded">已退款</option>
                <option value="rejected">已驳回</option>
              </select>
              <Button onClick={loadAfterSales}>刷新</Button>
            </div>
            {afterSales.map((request) => (
              <article key={request.id} className={cn((request.status === 'admin_pending' || request.status === 'pending_seller') && 'is-pending')}>
                <header>
                  <Badge>
                    {{
                      pending_seller: '等待卖家协商',
                      admin_pending: '待客服裁定',
                      refunded: '已退款',
                      rejected: '已驳回',
                    }[request.status] || request.status}
                  </Badge>
                  <strong>{request.order_title}</strong>
                  <small>{request.order_no}</small>
                </header>
                <p><strong>买家：</strong>{request.applicant?.nickname || request.applicant?.username} · {request.reason}</p>
                <p><strong>卖家说明：</strong>{request.seller_response || '未填写'}</p>
                {request.admin_note ? <small>客服说明：{request.admin_note}</small> : null}
                {request.status === 'admin_pending' || request.status === 'pending_seller' ? (
                  <div className="admin-row-actions">
                    <Button size="sm" variant="outline" onClick={() => resolveAfterSale(request, 'reject')}>驳回售后</Button>
                    <Button size="sm" onClick={() => resolveAfterSale(request, 'refund')}>同意退款</Button>
                  </div>
                ) : null}
              </article>
            ))}
            {!afterSales.length ? <div className="chat-empty">暂无匹配售后记录</div> : null}
          </div>
        ) : null}

        {!loading && tab === 'tickets' ? (
          <div className="admin-section admin-reports">
            <div className="admin-toolbar">
              <select value={ticketStatus} onChange={(event) => setTicketStatus(event.target.value)}>
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="replied">已回复</option>
                <option value="closed">已关闭</option>
              </select>
              <Button onClick={loadTickets}>刷新</Button>
            </div>
            {tickets.map((ticket) => (
              <article key={ticket.id} className={cn(ticket.status === 'pending' && 'is-pending')}>
                <header>
                  <Badge>{ticket.status === 'pending' ? '待处理' : ticket.status === 'replied' ? '已回复' : '已关闭'}</Badge>
                  <strong>{ticket.title}</strong>
                  <small>{ticket.created_at ? new Date(ticket.created_at).toLocaleString() : ''}</small>
                </header>
                <p>
                  用户 <strong>{ticket.user?.nickname || ticket.user?.username}</strong>
                  {ticket.order_no ? ` · 订单 ${ticket.order_no}` : ''}
                  {ticket.category ? ` · ${ticket.category}` : ''}
                </p>
                <p>{ticket.content}</p>
                {ticket.admin_reply ? <small>已回复：{ticket.admin_reply}</small> : null}
                {ticket.status !== 'closed' ? (
                  <div className="admin-ticket-reply">
                    <Textarea
                      rows={2}
                      placeholder="填写客服回复…"
                      value={ticketReplies[ticket.id] || ''}
                      onChange={(event) => setTicketReplies((current) => ({ ...current, [ticket.id]: event.target.value }))}
                    />
                    <div className="admin-row-actions">
                      <Button size="sm" onClick={() => replyTicket(ticket)}>回复用户</Button>
                      <Button size="sm" variant="outline" onClick={() => closeTicket(ticket)}>关闭工单</Button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
            {!tickets.length ? <div className="chat-empty">暂无工单</div> : null}
          </div>
        ) : null}

        {!loading && tab === 'users' ? (
          <div className="admin-section">
            <div className="admin-toolbar">
              <Input value={userKeyword} onChange={(event) => setUserKeyword(event.target.value)} placeholder="搜索用户名 / 昵称 / 邮箱" />
              <Button onClick={loadUsers}><Search /> 搜索</Button>
            </div>
            <div className="admin-table">
              {users.map((user) => (
                <article key={user.id}>
                  <div>
                    <strong>{user.nickname || user.username}</strong>
                    <small>ID {user.id} · @{user.username} · {user.email} · 信任 {user.trust?.score ?? 800}</small>
                    <p>
                      {user.can_comment ? '可评论' : '禁评'} · {user.can_post ? '可发帖' : '禁发'} · {user.is_active ? '正常' : '停用'}
                      {user.ban_reason ? ` · ${user.ban_reason}` : ''}
                    </p>
                  </div>
                  <div className="admin-row-actions">
                    <Button size="sm" variant="outline" onClick={() => updateUser(user, { can_comment: !user.can_comment, ban_reason: user.can_comment ? '管理员限制评论' : null })}>
                      {user.can_comment ? '禁评' : '恢复评论'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateUser(user, { can_post: !user.can_post, ban_reason: user.can_post ? '管理员限制发帖' : null })}>
                      {user.can_post ? '禁发' : '恢复发帖'}
                    </Button>
                    <Button size="sm" onClick={() => updateUser(user, { trust_delta: -20, trust_note: '管理员下调信任分' })}>信誉-20</Button>
                    <Button size="sm" onClick={() => updateUser(user, { trust_delta: 20, trust_note: '管理员上调信任分' })}>信誉+20</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateUser(user, { is_active: !user.is_active, ban_reason: user.is_active ? '账号被管理员停用' : null })}>
                      {user.is_active ? '停用' : '启用'}
                    </Button>
                    {!user.is_admin && !user.is_deleted ? <Button size="sm" variant="destructive" onClick={() => removeUser(user)}><UserX /> 删除账户</Button> : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedRecipient(user)
                        setNoticeForm((current) => ({ ...current, broadcast: false }))
                        setTab('notices')
                      }}
                    >
                      <Megaphone /> 发通知
                    </Button>
                  </div>
                </article>
              ))}
              {!users.length ? <div className="chat-empty">未找到用户</div> : null}
            </div>
          </div>
        ) : null}

        {tab === 'notices' ? (
          <div className="admin-section admin-notice-form">
            <label><span>通知标题</span><Input value={noticeForm.title} onChange={(event) => setNoticeForm({ ...noticeForm, title: event.target.value })} placeholder="例如：校园交易安全提醒" /></label>
            <label><span>通知正文</span><Textarea value={noticeForm.content} onChange={(event) => setNoticeForm({ ...noticeForm, content: event.target.value })} placeholder="官方通知内容" rows={5} /></label>

            <label className="admin-check">
              <input
                type="checkbox"
                checked={noticeForm.broadcast}
                onChange={(event) => {
                  const broadcast = event.target.checked
                  setNoticeForm({ ...noticeForm, broadcast })
                  if (broadcast) setSelectedRecipient(null)
                }}
              />
              全站广播（发给所有活跃用户）
            </label>

            {!noticeForm.broadcast ? (
              <div className="admin-notice-user-picker">
                <span className="admin-notice-label">指定接收用户</span>
                {selectedRecipient ? (
                  <div className="admin-selected-user">
                    <div>
                      <strong>{selectedRecipient.nickname || selectedRecipient.username}</strong>
                      <small>ID {selectedRecipient.id} · @{selectedRecipient.username} · {selectedRecipient.email}</small>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedRecipient(null)}><X /> 更换</Button>
                  </div>
                ) : (
                  <>
                    <div className="admin-toolbar">
                      <Input
                        value={noticeUserKeyword}
                        onChange={(event) => setNoticeUserKeyword(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            searchNoticeUsers()
                          }
                        }}
                        placeholder="输入用户名、昵称或邮箱检索"
                      />
                      <Button onClick={searchNoticeUsers} disabled={noticeUserSearching}>
                        <Search /> {noticeUserSearching ? '检索中...' : '检索用户'}
                      </Button>
                    </div>
                    <div className="admin-notice-user-results">
                      {noticeUserResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="admin-notice-user-item"
                          onClick={() => {
                            setSelectedRecipient(user)
                            setNoticeUserResults([])
                          }}
                        >
                          <strong>{user.nickname || user.username}</strong>
                          <small>ID {user.id} · @{user.username} · {user.email}</small>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            <Button onClick={sendNotice}>
              <Megaphone /> {noticeForm.broadcast ? '发送全站官方通知' : selectedRecipient ? `发送给 ${selectedRecipient.nickname || selectedRecipient.username}` : '发送官方通知'}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
