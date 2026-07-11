import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  ImagePlus,
  LocateFixed,
  MapPin,
  MessageCircle,
  Package,
  Quote,
  Send,
  ShoppingBag,
  SmilePlus,
  WalletCards,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Message, MessageAvatar, MessageContent, MessageFooter } from '@/components/ui/message'
import ImageLightbox from '@/components/ImageLightbox'
import {
  getConversationMessages,
  getUserShopItems,
  sendConversationMessage,
  toggleMessageReaction,
} from '@/api/marketplace'
import {
  getBrowserPosition,
  geolocationErrorMessage,
  getGeolocationBlockReason,
} from '@/lib/geolocation'
import { alertIncoming } from '@/lib/messageAlerts'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏']

function timeLabel(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function compressChatImage(file, maxSize = 1280, quality = 0.76) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const image = new Image()
      image.onerror = reject
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function ChatThread({
  conversation,
  currentUser,
  compact = false,
  onNotice,
  onConversationUpdate,
  onOpenOrder,
  onPurchase,
}) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [shopItems, setShopItems] = useState([])
  const [transfer, setTransfer] = useState({ amount: '', note: '' })
  const [messageMenu, setMessageMenu] = useState(null)
  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0 })
  const albumRef = useRef(null)
  const cameraRef = useRef(null)
  const scrollerRef = useRef(null)
  const previousCountRef = useRef(0)
  const lastMessageIdRef = useRef(null)
  const noticeRef = useRef(onNotice)
  const conversationUpdateRef = useRef(onConversationUpdate)
  const currentUserIdRef = useRef(currentUser?.id)

  useEffect(() => { noticeRef.current = onNotice }, [onNotice])
  useEffect(() => { conversationUpdateRef.current = onConversationUpdate }, [onConversationUpdate])
  useEffect(() => { currentUserIdRef.current = currentUser?.id }, [currentUser?.id])

  const refresh = useCallback(async (silent = false) => {
    if (!conversation?.id) return
    if (!silent) setLoading(true)
    try {
      const response = await getConversationMessages(conversation.id)
      const items = response.items || []
      setMessages((previous) => {
        const last = items[items.length - 1]
        const changed = previous.length !== items.length
          || previous[previous.length - 1]?.id !== last?.id
        if (!silent || changed) {
          queueMicrotask(() => conversationUpdateRef.current?.())
        }
        // Incoming from peer while this thread is open (and not first load)
        if (silent && changed && last && lastMessageIdRef.current != null && last.id !== lastMessageIdRef.current) {
          const fromOther = last.is_mine === false
            || (last.is_mine == null && (
              last.sender_id != null
                ? last.sender_id !== currentUserIdRef.current
                : last.sender?.id !== currentUserIdRef.current
            ))
          if (fromOther) {
            const peer = conversation.user || {}
            alertIncoming({
              title: peer.nickname || peer.username || '新私信',
              body: last.content || '发来一条新消息',
              tag: `chat-${conversation.id}-${last.id}`,
            }, {
              // User is looking at chat: chime only, no OS banner if focused
              skipDesktopWhenFocused: true,
              skipSoundWhenFocused: false,
            })
          }
        }
        if (last?.id != null) lastMessageIdRef.current = last.id
        return items
      })
    } catch (error) {
      if (!silent) noticeRef.current?.(error.response?.data?.detail || '聊天记录加载失败')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [conversation?.id, conversation?.user])

  useEffect(() => {
    setMessages([])
    previousCountRef.current = 0
    lastMessageIdRef.current = null
    setShopOpen(false)
    refresh()
    const timer = window.setInterval(() => refresh(true), 5000)
    return () => window.clearInterval(timer)
  }, [conversation?.id, refresh])

  useEffect(() => {
    if (messages.length > previousCountRef.current) {
      requestAnimationFrame(() => {
        if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
      })
    }
    previousCountRef.current = messages.length
  }, [messages.length])

  const sendPayload = async (payload) => {
    if (!conversation?.id || sending) return
    setSending(true)
    try {
      const response = await sendConversationMessage(conversation.id, {
        ...payload,
        reply_to_id: replyTo?.id || undefined,
      })
      setMessages((current) => [...current, response.item])
      setText('')
      setReplyTo(null)
      setEmojiOpen(false)
      setShopOpen(false)
      conversationUpdateRef.current?.()
    } catch (error) {
      noticeRef.current?.(error.response?.data?.detail || '消息发送失败')
    } finally {
      setSending(false)
    }
  }

  const sendText = () => {
    const content = text.trim()
    if (content) sendPayload({ content, message_type: 'text' })
  }

  const sendImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const content = await compressChatImage(file)
      await sendPayload({ content, message_type: 'image', metadata: { filename: file.name } })
    } catch {
      onNotice?.('图片处理失败，请换一张图片')
    }
  }

  const sendLocation = async () => {
    try {
      const block = getGeolocationBlockReason()
      if (block) {
        onNotice?.(geolocationErrorMessage(block))
        return
      }
      onNotice?.('正在获取位置，请允许浏览器位置权限…')
      const { coords } = await getBrowserPosition({ enableHighAccuracy: true, timeout: 12000 })
      await sendPayload({
        content: '我分享了当前位置',
        message_type: 'location',
        metadata: { latitude: coords.latitude, longitude: coords.longitude, label: '当前位置' },
      })
    } catch (error) {
      onNotice?.(error?.message || geolocationErrorMessage(error?.reason || 'failed'))
    }
  }

  const sendTransfer = async () => {
    const amount = Number(transfer.amount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99) {
      onNotice?.('请输入有效的转账金额')
      return
    }
    await sendPayload({
      content: `转账 ¥${amount.toFixed(2)}`,
      message_type: 'transfer',
      metadata: { amount, note: transfer.note.trim() || '校园交易转账', status: 'pending' },
    })
    setTransfer({ amount: '', note: '' })
    setTransferOpen(false)
  }

  const openShopPicker = async () => {
    const sellerId = conversation?.user?.id
    if (!sellerId) return
    try {
      const response = await getUserShopItems(sellerId)
      setShopItems(response.items || [])
      setShopOpen(true)
      setTransferOpen(false)
      setEmojiOpen(false)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '商品列表加载失败')
    }
  }

  const sendProductCard = async (item) => {
    await sendPayload({
      content: `推荐商品：${item.title}`,
      message_type: 'product',
      metadata: {
        listing_id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        price: item.price,
        price_label: item.price_label,
        image_url: item.image_url,
      },
    })
  }

  const reactToMessage = async (messageId, emoji) => {
    try {
      const response = await toggleMessageReaction(messageId, emoji)
      setMessages((current) => current.map((item) => item.id === messageId ? response.item : item))
      setMessageMenu(null)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '消息表情更新失败')
    }
  }

  const other = conversation?.user || {}

  return (
    <section className={compact ? 'chat-thread is-compact' : 'chat-thread'}>
      {conversation?.context ? (
        <button
          type="button"
          className="chat-context-card"
          onClick={() => onPurchase?.(conversation.context)}
        >
          <span>{conversation.context.image_url ? <img src={conversation.context.image_url} alt="" /> : <MessageCircle />}</span>
          <div><strong>{conversation.context.title}</strong><small>{conversation.context.price_label || conversation.context.status}</small></div>
        </button>
      ) : null}

      <div ref={scrollerRef} className="chat-message-scroller">
        {loading ? <div className="chat-empty">聊天记录加载中...</div> : null}
        {!loading && !messages.length ? <div className="chat-empty">打个招呼，开始这次校园交流。</div> : null}
        {messages.map((message) => {
          const mine = message.is_mine || message.sender?.id === currentUser?.id
          const sender = message.sender || (mine ? currentUser : other)
          const meta = message.metadata || {}
          return (
            <Message
              key={message.id}
              align={mine ? 'end' : 'start'}
              onContextMenu={(event) => {
                if (mine) return
                event.preventDefault()
                setMessageMenu(message.id)
              }}
            >
              {!mine ? (
                <MessageAvatar>
                  <Avatar className="size-8">
                    <AvatarImage src={sender?.avatar_url || undefined} alt={sender?.nickname || sender?.username} />
                    <AvatarFallback>{(sender?.nickname || sender?.username || '同').slice(0, 1)}</AvatarFallback>
                  </Avatar>
                </MessageAvatar>
              ) : null}
              <MessageContent>
                {message.reply_to ? (
                  <div className="chat-reply-preview"><Quote /> {message.reply_to.sender?.nickname || message.reply_to.sender?.username}：{message.reply_to.content}</div>
                ) : null}
                <div className="chat-bubble" data-type={message.message_type}>
                  {message.message_type === 'image' ? (
                    <button
                      type="button"
                      className="chat-image-btn"
                      onClick={() => setLightbox({ open: true, images: [message.content], index: 0 })}
                      aria-label="查看聊天大图"
                    >
                      <img src={message.content} alt="聊天图片" />
                    </button>
                  ) : null}
                  {message.message_type === 'location' ? (
                    <a
                      href={`https://uri.amap.com/marker?position=${meta?.longitude},${meta?.latitude}&name=${encodeURIComponent(meta?.label || '共享位置')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin /><span><strong>{meta?.label || '共享位置'}</strong><small>点击在高德地图中查看</small></span>
                    </a>
                  ) : null}
                  {message.message_type === 'transfer' ? (
                    <div className="chat-transfer-card"><WalletCards /><span><strong>¥{Number(meta?.amount || 0).toFixed(2)}</strong><small>{meta?.note || '校园交易转账'} · 待接入支付</small></span></div>
                  ) : null}
                  {message.message_type === 'product' ? (
                    <div className="chat-product-card">
                      <div className="chat-product-card-main">
                        {meta.image_url ? <img src={meta.image_url} alt="" /> : <span><Package /></span>}
                        <div>
                          <strong>{meta.title || '校园商品'}</strong>
                          <small>{meta.description || '点击下方去购买查看详情'}</small>
                          <em>¥{Number(meta.price || 0).toFixed(2)}</em>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="chat-product-buy"
                        onClick={() => onPurchase?.({
                          type: meta.type || 'listing',
                          id: meta.listing_id,
                          title: meta.title,
                          description: meta.description,
                          price: meta.price,
                          image_url: meta.image_url,
                          author: other,
                        })}
                      >
                        去购买
                      </button>
                    </div>
                  ) : null}
                  {message.message_type === 'order' ? (
                    <div className="chat-order-card">
                      <Package />
                      <div>
                        <strong>{meta.event === 'paid' ? '付款成功' : meta.event === 'shipped' ? '订单已发货' : meta.event === 'received' ? '已确认收货' : '订单更新'}</strong>
                        <small>{meta.title} · ¥{Number(meta.amount || 0).toFixed(2)}</small>
                        <span>{message.content}</span>
                      </div>
                      <button type="button" onClick={() => onOpenOrder?.({ id: meta.order_id, order_no: meta.order_no, title: meta.title })}>
                        查看订单
                      </button>
                    </div>
                  ) : null}
                  {message.message_type === 'text' ? message.content : null}
                </div>
                {message.reactions?.length ? (
                  <div className="chat-message-reactions">
                    {message.reactions.map((reaction) => (
                      <button key={reaction.emoji} type="button" className={reaction.reacted ? 'is-active' : ''} onClick={() => reactToMessage(message.id, reaction.emoji)}>
                        {reaction.emoji} {reaction.count}
                      </button>
                    ))}
                  </div>
                ) : null}
                {messageMenu === message.id ? (
                  <div className="chat-message-menu">
                    <button type="button" onClick={() => { setReplyTo(message); setMessageMenu(null) }}><Quote /> 引用</button>
                    {EMOJIS.slice(0, 4).map((emoji) => <button key={emoji} type="button" onClick={() => reactToMessage(message.id, emoji)}>{emoji}</button>)}
                    <button type="button" aria-label="关闭" onClick={() => setMessageMenu(null)}><X /></button>
                  </div>
                ) : null}
                <MessageFooter>{timeLabel(message.created_at)}{mine ? (message.is_read ? ' · 已读' : ' · 已发送') : ''}</MessageFooter>
              </MessageContent>
            </Message>
          )
        })}
      </div>

      <div className="chat-composer">
        {replyTo ? (
          <div className="chat-composer-reply"><Quote /><span>引用 {replyTo.sender?.nickname || replyTo.sender?.username}：{replyTo.content}</span><button type="button" onClick={() => setReplyTo(null)}><X /></button></div>
        ) : null}
        {transferOpen ? (
          <div className="chat-transfer-form">
            <Input type="number" min="0.01" max="999999.99" step="0.01" value={transfer.amount} onChange={(event) => setTransfer({ ...transfer, amount: event.target.value })} placeholder="金额" />
            <Input value={transfer.note} onChange={(event) => setTransfer({ ...transfer, note: event.target.value })} placeholder="转账说明" />
            <Button size="sm" onClick={sendTransfer}>发送转账卡片</Button>
            <Button size="sm" variant="ghost" onClick={() => setTransferOpen(false)}>取消</Button>
          </div>
        ) : null}
        {shopOpen ? (
          <div className="chat-shop-picker">
            <header><strong>对方在售商品</strong><button type="button" onClick={() => setShopOpen(false)}><X /></button></header>
            <div className="chat-shop-list">
              {shopItems.length ? shopItems.map((item) => (
                <button key={item.id} type="button" className="chat-shop-item" onClick={() => sendProductCard(item)}>
                  {item.image_url ? <img src={item.image_url} alt="" /> : <span><Package /></span>}
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                    <em>{item.price_label}</em>
                  </div>
                </button>
              )) : <div className="chat-empty">对方暂无在售商品</div>}
            </div>
          </div>
        ) : null}
        {emojiOpen ? <div className="chat-emoji-picker">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => setText((value) => `${value}${emoji}`)}>{emoji}</button>)}</div> : null}
        <div className="chat-input-row">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                sendText()
              }
            }}
            placeholder={`发消息给 ${other.nickname || other.username || '校园同学'}...`}
          />
          <Button size="icon" onClick={sendText} disabled={!text.trim() || sending} aria-label="发送"><Send /></Button>
        </div>
        <div className="chat-tool-row">
          <button type="button" onClick={() => setEmojiOpen((value) => !value)}><SmilePlus /> 表情</button>
          <button type="button" onClick={() => albumRef.current?.click()}><ImagePlus /> 相册</button>
          <button type="button" onClick={() => cameraRef.current?.click()}><Camera /> 拍摄</button>
          <button type="button" onClick={sendLocation}><LocateFixed /> 位置</button>
          <button type="button" onClick={() => setTransferOpen((value) => !value)}><WalletCards /> 转账</button>
          <button type="button" onClick={openShopPicker}><ShoppingBag /> 商品</button>
          <input ref={albumRef} hidden type="file" accept="image/*" onChange={sendImage} />
          <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={sendImage} />
        </div>
      </div>

      <ImageLightbox
        open={lightbox.open}
        images={lightbox.images}
        index={lightbox.index}
        onClose={() => setLightbox((current) => ({ ...current, open: false }))}
        onIndexChange={(next) => setLightbox((current) => ({ ...current, index: next }))}
      />
    </section>
  )
}
