import { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, MessageCircle, ShieldCheck, UserCheck, UserPlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getPublicUserProfile, toggleFollow } from '@/api/marketplace'

export default function PublicProfile({ userId, onBack, onOpenItem, onMessage, onNotice }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    getPublicUserProfile(userId).then((response) => {
      if (!cancelled) setData(response)
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

  if (!data || data.user?.id !== userId) return <div className="public-profile-page"><div className="chat-empty">用户主页加载中...</div></div>
  if (!data) return <div className="public-profile-page"><Button variant="ghost" onClick={onBack}><ArrowLeft /> 返回</Button><div className="chat-empty">用户不存在</div></div>
  const profile = data.profile || {}
  const targetUser = { ...data.user, ...profile }

  return (
    <section className="public-profile-page">
      <Button variant="ghost" className="detail-back" onClick={onBack}><ArrowLeft /> 返回</Button>
      <header className="public-profile-hero" data-theme={profile.background_theme || 'teal'} style={profile.background_url ? { '--public-bg': `url("${profile.background_url}")` } : undefined}>
        <Avatar className="public-profile-avatar"><AvatarImage src={profile.avatar_url || undefined} alt={profile.nickname} /><AvatarFallback>{(profile.nickname || data.user?.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
        <div className="public-profile-copy"><Badge><ShieldCheck /> {data.trust?.grade} · {data.trust?.score}</Badge><h1>{profile.nickname || data.user?.username}</h1><p>{profile.signature || '这个同学还没有填写个性签名。'}</p><span><MapPin /> {profile.school || '南通理工学院'} · {data.user?.is_online ? '在线' : '离线'}</span></div>
        <div className="public-profile-stats"><div><strong>{profile.followers || 0}</strong><span>粉丝</span></div><div><strong>{profile.following || 0}</strong><span>关注</span></div><div><strong>{data.published?.length || 0}</strong><span>发布</span></div></div>
        {!data.is_me ? <div className="public-profile-actions"><Button onClick={follow}>{data.is_following ? <UserCheck /> : <UserPlus />}{data.is_following ? '已关注' : '关注'}</Button><Button variant="secondary" onClick={() => onMessage?.({ user: targetUser })}><MessageCircle /> 私信</Button></div> : null}
      </header>
      <div className="public-profile-feed"><h2>TA 的发布</h2>{data.published?.length ? data.published.map((item) => <button key={`${item.type}-${item.id}`} type="button" onClick={() => onOpenItem?.(item)}>{item.image_url ? <img src={item.image_url} alt="" /> : <span>{item.title?.slice(0, 1)}</span>}<div><strong>{item.title}</strong><small>{item.status}</small></div>{item.price_label ? <em>{item.price_label}</em> : null}</button>) : <div className="chat-empty">暂时没有公开发布。</div>}</div>
    </section>
  )
}
