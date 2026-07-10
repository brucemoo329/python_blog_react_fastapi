import { useEffect, useState } from 'react'
import { ArrowLeft, Flag, MapPin, MessageCircle, ShieldCheck, UserCheck, UserPlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getPublicUserProfile, reportTarget, toggleFollow } from '@/api/marketplace'
import { cn } from '@/lib/utils'

const GROUPS = [
  { id: 'listing', label: '二手好物' },
  { id: 'game', label: '游戏交易' },
  { id: 'service', label: '跑腿代取' },
  { id: 'wanted', label: '求购' },
  { id: 'community', label: '社区帖' },
]

export default function PublicProfile({ userId, onBack, onOpenItem, onMessage, onNotice }) {
  const [data, setData] = useState(null)
  const [group, setGroup] = useState('listing')
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPublicUserProfile(userId).then((response) => {
      if (!cancelled) {
        setData(response)
        const groups = response.published_groups || {}
        const first = GROUPS.find((item) => (groups[item.id] || []).length)?.id || 'listing'
        setGroup(first)
      }
    }).catch((error) => {
      if (!cancelled) onNotice?.(error.response?.data?.detail || '用户主页加载失败')
    })
    return () => { cancelled = true }
  }, [userId, onNotice])

  const follow = async () => {
    try {
      const response = await toggleFollow(userId)
      setData((current) => ({
        ...current,
        is_following: response.followed,
        profile: { ...current.profile, followers: response.target_follower_count },
      }))
      onNotice?.(response.message)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '关注操作失败')
    }
  }

  const reportUser = async () => {
    if (reporting) return
    const reason = window.prompt('请填写举报原因（如：欺诈、辱骂、虚假信息）', '违规行为')
    if (!reason?.trim()) return
    setReporting(true)
    try {
      const response = await reportTarget({
        target_type: 'user',
        target_id: userId,
        reason: reason.trim(),
        description: '来自用户主页的举报',
      })
      onNotice?.(response.message || '举报已提交')
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '举报失败')
    } finally {
      setReporting(false)
    }
  }

  if (!data || data.user?.id !== userId) return <div className="public-profile-page"><div className="chat-empty">用户主页加载中...</div></div>
  const profile = data.profile || {}
  const targetUser = { ...data.user, ...profile }
  const groups = data.published_groups || {}
  const currentItems = groups[group] || []

  return (
    <section className="public-profile-page">
      <Button variant="ghost" className="detail-back" onClick={onBack}><ArrowLeft /> 返回</Button>
      <header className="public-profile-hero" data-theme={profile.background_theme || 'teal'} style={profile.background_url ? { '--public-bg': `url("${profile.background_url}")` } : undefined}>
        <Avatar className="public-profile-avatar"><AvatarImage src={profile.avatar_url || undefined} alt={profile.nickname} /><AvatarFallback>{(profile.nickname || data.user?.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
        <div className="public-profile-copy">
          <Badge><ShieldCheck /> {data.trust?.grade} · 信用 {data.trust?.score ?? 800}</Badge>
          <h1>{profile.nickname || data.user?.username}</h1>
          <p>{profile.signature || '这个同学还没有填写个性签名。'}</p>
          <span><MapPin /> {profile.school || '南通理工学院'} · {data.user?.is_online ? '在线' : '离线'}</span>
          <div className="public-credit-line">
            <span>卖家信用值 <strong>{data.trust?.score ?? 800}</strong></span>
            <span>好评率 <strong>{data.trust?.positive_rate ?? 100}%</strong></span>
            <span>好评数 <strong>{data.trust?.positive_reviews ?? 0}</strong>/{data.trust?.total_reviews ?? 0}</span>
          </div>
        </div>
        <div className="public-profile-stats">
          <div><strong>{profile.followers || 0}</strong><span>粉丝</span></div>
          <div><strong>{profile.following || 0}</strong><span>关注</span></div>
          <div><strong>{data.published?.length || 0}</strong><span>发布</span></div>
        </div>
        {!data.is_me ? (
          <div className="public-profile-actions">
            <Button onClick={follow}>{data.is_following ? <UserCheck /> : <UserPlus />}{data.is_following ? '已关注' : '关注'}</Button>
            <Button variant="secondary" onClick={() => onMessage?.({ user: targetUser })}><MessageCircle /> 私信</Button>
            <Button variant="outline" disabled={reporting} onClick={reportUser}><Flag /> 举报</Button>
          </div>
        ) : null}
      </header>

      <div className="public-profile-feed">
        <div className="public-profile-group-tabs">
          {GROUPS.map((item) => (
            <button key={item.id} type="button" className={cn(group === item.id && 'is-active')} onClick={() => setGroup(item.id)}>
              {item.label}
              <em>{(groups[item.id] || []).length}</em>
            </button>
          ))}
        </div>
        <h2>{GROUPS.find((item) => item.id === group)?.label || 'TA 的发布'}</h2>
        {currentItems.length ? currentItems.map((item) => (
          <button key={`${item.type}-${item.id}`} type="button" onClick={() => onOpenItem?.(item)}>
            {item.image_url ? <img src={item.image_url} alt="" /> : <span>{item.title?.slice(0, 1)}</span>}
            <div><strong>{item.title}</strong><small>{item.status}</small></div>
            {item.price_label ? <em>{item.price_label}</em> : null}
          </button>
        )) : <div className="chat-empty">该分类下暂时没有发布。</div>}
      </div>
    </section>
  )
}
