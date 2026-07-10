import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  Flag,
  Megaphone,
  Package,
  Shield,
  Trash2,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteAdminContent,
  getAdminContents,
  getAdminOverview,
  getAdminReports,
  getAdminUsers,
  handleAdminReport,
  sendOfficialNotice,
  updateAdminUserPenalties,
} from '@/api/marketplace'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'overview', label: '总览', icon: Shield },
  { id: 'contents', label: '内容管理', icon: Package },
  { id: 'reports', label: '举报中心', icon: Flag },
  { id: 'users', label: '用户与信誉', icon: Users },
  { id: 'notices', label: '官方通知', icon: Megaphone },
]

export default function AdminPanel({ onBack, onNotice }) {
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [contents, setContents] = useState([])
  const [contentType, setContentType] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])
  const [userKeyword, setUserKeyword] = useState('')
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', recipient_user_id: '', broadcast: true })
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
    const data = await getAdminReports({ status: 'all' })
    setReports(data.items || [])
  }, [])

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
        if (tab === 'users') await loadUsers()
      } catch (error) {
        if (!cancelled) onNotice?.(error.response?.data?.detail || '管理后台加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tab, loadOverview, loadContents, loadReports, loadUsers, onNotice])

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

  const updateUser = async (user, patch) => {
    try {
      const response = await updateAdminUserPenalties(user.id, patch)
      onNotice?.(response.message || '用户状态已更新')
      await loadUsers()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '更新失败')
    }
  }

  const sendNotice = async () => {
    try {
      const payload = {
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        broadcast: noticeForm.broadcast,
        recipient_user_id: noticeForm.broadcast ? undefined : Number(noticeForm.recipient_user_id || 0) || undefined,
      }
      const response = await sendOfficialNotice(payload)
      onNotice?.(response.message)
      setNoticeForm({ title: '', content: '', recipient_user_id: '', broadcast: true })
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
          <div className="admin-stats-grid">
            {[
              ['注册用户', overview.users],
              ['在售商品', overview.active_listings],
              ['待处理举报', overview.pending_reports],
              ['订单总数', overview.orders],
              ['跑腿任务', overview.open_tasks],
              ['社区帖子', overview.community_posts],
            ].map(([label, value]) => (
              <article key={label}><span>{label}</span><strong>{value}</strong></article>
            ))}
          </div>
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

        {!loading && tab === 'users' ? (
          <div className="admin-section">
            <div className="admin-toolbar">
              <Input value={userKeyword} onChange={(event) => setUserKeyword(event.target.value)} placeholder="搜索用户名/邮箱" />
              <Button onClick={loadUsers}>搜索</Button>
            </div>
            <div className="admin-table">
              {users.map((user) => (
                <article key={user.id}>
                  <div>
                    <strong>{user.nickname || user.username}</strong>
                    <small>@{user.username} · 信任 {user.trust?.score ?? 800}</small>
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
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'notices' ? (
          <div className="admin-section admin-notice-form">
            <label><span>通知标题</span><Input value={noticeForm.title} onChange={(event) => setNoticeForm({ ...noticeForm, title: event.target.value })} placeholder="例如：校园交易安全提醒" /></label>
            <label><span>通知正文</span><Textarea value={noticeForm.content} onChange={(event) => setNoticeForm({ ...noticeForm, content: event.target.value })} placeholder="官方通知内容" rows={5} /></label>
            <label className="admin-check"><input type="checkbox" checked={noticeForm.broadcast} onChange={(event) => setNoticeForm({ ...noticeForm, broadcast: event.target.checked })} /> 全站广播</label>
            {!noticeForm.broadcast ? (
              <label><span>接收用户 ID</span><Input value={noticeForm.recipient_user_id} onChange={(event) => setNoticeForm({ ...noticeForm, recipient_user_id: event.target.value })} placeholder="用户数字 ID" /></label>
            ) : null}
            <Button onClick={sendNotice}><Megaphone /> 发送官方通知</Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
