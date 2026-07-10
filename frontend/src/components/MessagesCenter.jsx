import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, MessageCircle, Search } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ChatThread from '@/components/ChatThread'
import { getConversations } from '@/api/marketplace'
import { cn } from '@/lib/utils'

export default function MessagesCenter({ currentUser, initialConversationId, onBack, onNotice, onUnreadChange }) {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(initialConversationId || null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await getConversations()
      const items = response.items || []
      setConversations(items)
      setActiveId((current) => current || initialConversationId || items[0]?.id || null)
      onUnreadChange?.(items.reduce((total, item) => total + (item.unread || 0), 0))
    } catch (error) {
      if (!silent) onNotice?.(error.response?.data?.detail || '消息中心加载失败')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [initialConversationId, onUnreadChange, onNotice])

  useEffect(() => {
    loadConversations()
    const timer = window.setInterval(() => loadConversations(true), 7000)
    return () => window.clearInterval(timer)
  }, [loadConversations])

  useEffect(() => {
    if (initialConversationId) setActiveId(initialConversationId)
  }, [initialConversationId])

  const filtered = conversations.filter((conversation) => {
    const user = conversation.user || {}
    return `${user.nickname || ''} ${user.username || ''} ${conversation.last_message?.content || ''}`.toLowerCase().includes(search.trim().toLowerCase())
  })
  const active = conversations.find((conversation) => conversation.id === activeId)

  return (
    <section className="messages-center">
      <aside className="messages-list-panel">
        <header><Button variant="ghost" size="icon" onClick={onBack} aria-label="返回"><ArrowLeft /></Button><div><h1>私信</h1><span>{conversations.length} 个会话</span></div></header>
        <div className="messages-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索联系人或消息" /></div>
        <div className="messages-conversation-list">
          {loading ? <div className="chat-empty">会话加载中...</div> : null}
          {!loading && !filtered.length ? <div className="chat-empty">还没有私信，去帖子里和同学聊聊。</div> : null}
          {filtered.map((conversation) => {
            const user = conversation.user || {}
            return (
              <button key={conversation.id} type="button" className={cn(activeId === conversation.id && 'is-active')} onClick={() => setActiveId(conversation.id)}>
                <Avatar className="size-11"><AvatarImage src={user.avatar_url || undefined} alt={user.nickname || user.username} /><AvatarFallback>{(user.nickname || user.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
                <span className={user.is_online ? 'presence-dot is-online' : 'presence-dot'} />
                <div><strong>{user.nickname || user.username}</strong><small>{conversation.last_message?.content || '开始聊天'}</small></div>
                {conversation.unread ? <Badge>{conversation.unread}</Badge> : null}
              </button>
            )
          })}
        </div>
      </aside>
      <div className="messages-thread-panel">
        {active ? (
          <>
            <header className="messages-thread-header">
              <Avatar className="size-10"><AvatarImage src={active.user?.avatar_url || undefined} alt={active.user?.nickname || active.user?.username} /><AvatarFallback>{(active.user?.nickname || active.user?.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
              <div><strong>{active.user?.nickname || active.user?.username}</strong><span>{active.user?.is_online ? '在线' : '离线'} · {active.user?.school || '校园同学'}</span></div>
            </header>
            <ChatThread conversation={active} currentUser={currentUser} onNotice={onNotice} onConversationUpdate={() => loadConversations(true)} />
          </>
        ) : <div className="messages-no-selection"><MessageCircle /><h2>选择一个会话</h2><p>聊天记录会一直保存在你的账号中。</p></div>}
      </div>
    </section>
  )
}
