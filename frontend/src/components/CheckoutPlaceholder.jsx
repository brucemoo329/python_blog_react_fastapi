import { useState } from 'react'
import { ArrowLeft, Bike, CreditCard, MessageCircle, PackageCheck, ShieldCheck, WalletCards } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createListingOrder, payOrder } from '@/api/marketplace'

const ACTION_COPY = {
  listing: { title: '确认购买', action: '创建订单并付款' },
  game: { title: '确认游戏交易', action: '创建订单并付款' },
  service: { title: '确认接单', action: '接取任务' },
  wanted: { title: '响应求购', action: '联系求购者' },
}

export default function CheckoutPlaceholder({ item, onBack, onMessage, onAcceptTask, onNotice, onOrderCreated }) {
  const [busy, setBusy] = useState(false)
  const type = item?.type || 'listing'
  const copy = ACTION_COPY[type] || ACTION_COPY.listing
  const author = item?.author || item?.seller || item?.requester || {}
  const price = item?.price_label || (type === 'service' ? `赏金 ¥${item?.reward || 0}` : type === 'wanted' ? `预算 ¥${item?.budget_max || '面议'}` : `¥${item?.price || 0}`)

  const confirm = async () => {
    if (type === 'service') {
      await onAcceptTask?.(item)
      return
    }
    if (type === 'wanted') {
      onMessage?.(item)
      return
    }
    if (busy) return
    setBusy(true)
    try {
      const created = await createListingOrder(item.id, {
        delivery_method: 'campus_meet',
        meeting_location: item.location || item.location_name || '校内当面交易',
        buyer_note: '校园平台下单',
      })
      const paid = await payOrder(created.item.id, {
        buyer_note: '校园钱包模拟付款成功',
        meeting_location: item.location || item.location_name || '校内当面交易',
      })
      onNotice?.(paid.message || '付款成功，已通知卖家')
      onOrderCreated?.(paid.item)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '下单失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="checkout-placeholder">
      <button type="button" className="checkout-back" onClick={onBack}><ArrowLeft /> 返回详情</button>
      <div className="checkout-shell">
        <div className="checkout-main-card">
          <header><div><Badge variant="secondary">{copy.title}</Badge><h1>{item?.title || '校园交易'}</h1></div><strong>{price}</strong></header>
          <div className="checkout-product">
            {item?.image_url || item?.images?.[0] ? <img src={item.image_url || item.images[0]} alt="" /> : <span><PackageCheck /></span>}
            <div><p>{item?.description || '请与发布者确认商品、任务和交付细节。'}</p><small>{item?.school || '南通理工学院'} · {item?.location || '校内交易'}</small></div>
          </div>
          <div className="checkout-seller">
            <Avatar className="size-11"><AvatarImage src={author.avatar_url || undefined} alt={author.nickname || author.username} /><AvatarFallback>{(author.nickname || author.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
            <div><strong>{author.nickname || author.username || '校园同学'}</strong><span><ShieldCheck /> 信任 {author.trust?.score ?? 800}</span></div>
            <Button variant="outline" onClick={() => onMessage?.(item)}><MessageCircle /> 私信确认</Button>
          </div>
          <div className="checkout-methods">
            <div className="is-active"><WalletCards /><span><strong>校园钱包</strong><small>校内当面确认后记账</small></span></div>
            <div><CreditCard /><span><strong>微信 / 支付宝</strong><small>通道规划中，当前走校园确认付款</small></span></div>
          </div>
          <Button className="checkout-confirm" onClick={confirm} disabled={busy}>
            {type === 'service' ? <Bike /> : type === 'wanted' ? <MessageCircle /> : <WalletCards />} {busy ? '处理中...' : copy.action}
          </Button>
          {type !== 'service' && type !== 'wanted' ? <p className="checkout-dev-note">点击后会创建订单并模拟付款，自动给卖家发送「我已付款」消息。</p> : null}
        </div>
        <aside className="checkout-safety"><ShieldCheck /><h2>校园安心交易</h2><p>付款前核对商品状态与卖家信息，优先选择校内公共区域当面验货。</p><ul><li>确认实物或账号信息</li><li>不要脱离平台沟通</li><li>发现异常及时举报</li></ul></aside>
      </div>
    </section>
  )
}
