import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Eraser, MessageCircle, Search, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ChatThread from '@/components/ChatThread'
import { clearConversationMessages, deleteConversation, getConversations } from '@/api/marketplace'
import { t as translate } from '@/lib/i18n'
import { cn } from '@/lib/utils'

function useIsMobile(breakpoint = 760) {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  ))
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= breakpoint)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [breakpoint])
  return isMobile
}

export default function MessagesCenter({ currentUser, initialConversationId, onBack, onNotice, onUnreadChange, onOpenOrder, onPurchase, language = 'zh-CN' }) {
  const isMobile = useIsMobile()
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(initialConversationId || null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const noticeRef = useRef(onNotice)
  const unreadChangeRef = useRef(onUnreadChange)
  const initialIdRef = useRef(initialConversationId)
  const requestSeqRef = useRef(0)
  const isMobileRef = useRef(isMobile)
  const t = (key, fallback = '') => translate(language, key, fallback)

  useEffect(() => { noticeRef.current = onNotice }, [onNotice])
  useEffect(() => { unreadChangeRef.current = onUnreadChange }, [onUnreadChange])
  useEffect(() => { initialIdRef.current = initialConversationId }, [initialConversationId])
  useEffect(() => { isMobileRef.current = isMobile }, [isMobile])

  const loadConversations = useCallback(async (silent = false) => {
    const seq = ++requestSeqRef.current
    if (!silent) setLoading(true)
    try {
      const response = await getConversations()
      if (seq !== requestSeqRef.current) return
      const items = response.items || []
      setConversations(items)
      setActiveId((current) => {
        if (current && items.some((item) => item.id === current)) return current
        if (initialIdRef.current) return initialIdRef.current
        if (isMobileRef.current) return null
        return items[0]?.id || null
      })
      unreadChangeRef.current?.(items.reduce((total, item) => total + (item.unread || 0), 0))
    } catch (error) {
      if (seq !== requestSeqRef.current) return
      if (!silent) noticeRef.current?.(error.response?.data?.detail || t('msg.loadFail', '消息中心加载失败'))
    } finally {
      if (seq === requestSeqRef.current && !silent) setLoading(false)
    }
  }, [language])

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
  const showThread = Boolean(activeId && active)
  const showList = !isMobile || !showThread

  const clearChat = async () => {
    if (!active?.id) return
    if (!window.confirm(t('msg.clearConfirm', '确认清空该会话的全部聊天记录？'))) return
    try {
      const response = await clearConversationMessages(active.id)
      onNotice?.(response.message || t('msg.cleared', '聊天记录已清空'))
      await loadConversations(true)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || t('msg.clearFail', '清空失败'))
    }
  }

  const removeConversation = async () => {
    if (!active?.id) return
    if (!window.confirm(t('msg.deleteConfirm', '确认删除该会话？聊天记录也会一并删除。'))) return
    try {
      const response = await deleteConversation(active.id)
      onNotice?.(response.message || t('msg.deleted', '会话已删除'))
      setActiveId(null)
      await loadConversations(true)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || t('msg.deleteFail', '删除失败'))
    }
  }

  const handleListBack = () => {
    if (isMobile && showThread) {
      setActiveId(null)
      return
    }
    onBack?.()
  }

  return (
    <section className={cn('messages-center', showThread && 'has-active-thread', isMobile && 'is-mobile')}>
      {showList ? (
        <aside className="messages-list-panel">
          <header>
            <Button variant="ghost" size="icon" onClick={handleListBack} aria-label={t('detail.back')}><ArrowLeft /></Button>
            <div><h1>{t('msg.title')}</h1><span>{conversations.length} {t('msg.sessions')}</span></div>
          </header>
          <div className="messages-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('msg.search')} /></div>
          <div className="messages-conversation-list">
            {loading ? <div className="chat-empty">{t('msg.loading')}</div> : null}
            {!loading && !filtered.length ? <div className="chat-empty">{t('msg.empty')}</div> : null}
            {!loading && filtered.map((conversation) => {
              const user = conversation.user || {}
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(activeId === conversation.id && 'is-active')}
                  onClick={() => setActiveId(conversation.id)}
                >
                  <Avatar className="size-11"><AvatarImage src={user.avatar_url || undefined} alt={user.nickname || user.username} /><AvatarFallback>{(user.nickname || user.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
                  <span className={user.is_online ? 'presence-dot is-online' : 'presence-dot'} />
                  <div>
                    <strong>{user.nickname || user.username}</strong>
                    <small>{conversation.last_message?.content || t('msg.startChat', '开始聊天')}</small>
                  </div>
                  {conversation.unread ? <Badge>{conversation.unread}</Badge> : null}
                </button>
              )
            })}
          </div>
        </aside>
      ) : null}

      <div className="messages-thread-panel">
        {showThread ? (
          <>
            <header className="messages-thread-header">
              {isMobile ? (
                <Button variant="ghost" size="icon" className="messages-mobile-back" onClick={() => setActiveId(null)} aria-label={t('detail.back')}>
                  <ArrowLeft />
                </Button>
              ) : null}
              <Avatar className="size-10"><AvatarImage src={active.user?.avatar_url || undefined} alt={active.user?.nickname || active.user?.username} /><AvatarFallback>{(active.user?.nickname || active.user?.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
              <div className="messages-thread-meta">
                <strong>{active.user?.nickname || active.user?.username}</strong>
                <span>{active.user?.is_online ? t('ui.online') : t('ui.offline')} · {active.user?.school || t('ui.profile')}</span>
              </div>
              <div className="messages-thread-actions">
                <Button variant="ghost" size="sm" onClick={clearChat}><Eraser /> <span>{t('msg.clear')}</span></Button>
                <Button variant="ghost" size="sm" onClick={removeConversation}><Trash2 /> <span>{t('msg.delete')}</span></Button>
              </div>
            </header>
            <ChatThread
              conversation={active}
              currentUser={currentUser}
              onNotice={onNotice}
              onConversationUpdate={() => loadConversations(true)}
              onOpenOrder={onOpenOrder}
              onPurchase={onPurchase}
            />
          </>
        ) : (
          <div className="messages-no-selection">
            <MessageCircle />
            <h2>{isMobile ? t('msg.pickPeer') : t('msg.select')}</h2>
            <p>{t('msg.saved')}</p>
          </div>
        )}
      </div>
    </section>
  )
}
