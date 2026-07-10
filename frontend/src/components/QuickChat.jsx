import { useEffect, useState } from 'react'
import { MessageCircle, Minus, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import ChatThread from '@/components/ChatThread'
import { startConversation } from '@/api/marketplace'

export default function QuickChat({ request, currentUser, onClose, onNotice, onOpenCenter, onConversationUpdate }) {
  const [conversation, setConversation] = useState(null)
  const [minimized, setMinimized] = useState(false)
  const target = request?.user

  useEffect(() => {
    let cancelled = false
    if (!target?.id) return undefined
    startConversation({
      target_user_id: target.id,
      context_type: request.context?.type,
      context_id: request.context?.id,
    }).then((response) => {
      if (!cancelled) setConversation(response)
    }).catch((error) => {
      if (!cancelled) onNotice?.(error.response?.data?.detail || '私信会话创建失败')
    })
    return () => { cancelled = true }
  }, [target?.id, request?.context?.type, request?.context?.id, onNotice])

  if (!request) return null
  const activeConversation = conversation?.user?.id === target?.id ? conversation : null
  const displayUser = activeConversation?.user || target || {}

  return (
    <aside className={minimized ? 'quick-chat is-minimized' : 'quick-chat'} aria-label={`与${displayUser.nickname || displayUser.username || '校园同学'}私信`}>
      <header>
        <button type="button" className="quick-chat-person" onClick={onOpenCenter}>
          <Avatar className="size-9">
            <AvatarImage src={displayUser.avatar_url || undefined} alt={displayUser.nickname || displayUser.username} />
            <AvatarFallback>{(displayUser.nickname || displayUser.username || '同').slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span><strong>{displayUser.nickname || displayUser.username || '校园同学'}</strong><small><i className={displayUser.is_online ? 'is-online' : ''} />{displayUser.is_online ? '在线' : '离线'}</small></span>
        </button>
        <div>
          <Button variant="ghost" size="icon" aria-label={minimized ? '展开聊天' : '最小化聊天'} onClick={() => setMinimized((value) => !value)}>{minimized ? <MessageCircle /> : <Minus />}</Button>
          <Button variant="ghost" size="icon" aria-label="关闭聊天" onClick={onClose}><X /></Button>
        </div>
      </header>
      {!minimized ? (
        activeConversation ? (
          <ChatThread
            compact
            conversation={activeConversation}
            currentUser={currentUser}
            onNotice={onNotice}
            onConversationUpdate={onConversationUpdate}
          />
        ) : <div className="chat-empty">正在打开会话...</div>
      ) : null}
    </aside>
  )
}
