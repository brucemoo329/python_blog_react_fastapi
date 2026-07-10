import { useMemo, useState } from 'react'
import { ArrowLeft, Bike, CreditCard, MessageCircle, PackageCheck, ShieldCheck, WalletCards } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createListingOrder, payOrder } from '@/api/marketplace'
import { t as translate } from '@/lib/i18n'

export default function CheckoutPlaceholder({ item, onBack, onMessage, onAcceptTask, onNotice, onOrderCreated, language = 'zh-CN' }) {
  const [busy, setBusy] = useState(false)
  const type = item?.type || 'listing'
  const t = (key, fallback = '') => translate(language, key, fallback)

  const copy = useMemo(() => {
    if (type === 'game') return { title: t('checkout.confirmGame'), action: t('checkout.buyAction') }
    if (type === 'service') return { title: t('checkout.confirmTask'), action: t('checkout.taskAction') }
    if (type === 'wanted') return { title: t('checkout.confirmWanted'), action: t('checkout.wantedAction') }
    return { title: t('checkout.confirmBuy'), action: t('checkout.buyAction') }
  }, [language, type])

  const author = item?.author || item?.seller || item?.requester || {}
  const price = item?.price_label || (
    type === 'service'
      ? `${t('publish.reward')} ¥${item?.reward || 0}`
      : type === 'wanted'
        ? `${t('publish.budget')} ¥${item?.budget_max || t('checkout.negotiable', '面议')}`
        : `¥${item?.price || 0}`
  )

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
        meeting_location: item.location || item.location_name || t('orders.campusMeet', '校内当面交易'),
        buyer_note: t('checkout.platformOrder', '校园平台下单'),
      })
      const paid = await payOrder(created.item.id, {
        buyer_note: t('checkout.paidNote', '校园钱包模拟付款成功'),
        meeting_location: item.location || item.location_name || t('orders.campusMeet', '校内当面交易'),
      })
      onNotice?.(paid.message || t('checkout.paidOk', '付款成功，已通知卖家'))
      onOrderCreated?.(paid.item)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || t('checkout.orderFail', '下单失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="checkout-placeholder">
      <button type="button" className="checkout-back" onClick={onBack}><ArrowLeft /> {t('detail.back')}</button>
      <div className="checkout-shell">
        <div className="checkout-main-card">
          <header><div><Badge variant="secondary">{copy.title}</Badge><h1>{item?.title || t('checkout.trade', '校园交易')}</h1></div><strong>{price}</strong></header>
          <div className="checkout-product">
            {item?.image_url || item?.images?.[0] ? <img src={item.image_url || item.images[0]} alt="" /> : <span><PackageCheck /></span>}
            <div><p>{item?.description || t('checkout.checkDetails', '请与发布者确认商品、任务和交付细节。')}</p><small>{item?.school || '南通理工学院'} · {item?.location || t('orders.campusMeet', '校内当面交易')}</small></div>
          </div>
          <div className="checkout-seller">
            <Avatar className="size-11"><AvatarImage src={author.avatar_url || undefined} alt={author.nickname || author.username} /><AvatarFallback>{(author.nickname || author.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
            <div><strong>{author.nickname || author.username || t('ui.profile')}</strong><span><ShieldCheck /> {t('ui.trustScore')} {author.trust?.score ?? 800}</span></div>
            <Button variant="outline" onClick={() => onMessage?.(item)}><MessageCircle /> {t('checkout.dmConfirm')}</Button>
          </div>
          <div className="checkout-methods">
            <div className="is-active"><WalletCards /><span><strong>{t('checkout.wallet', '校园钱包')}</strong><small>{t('checkout.walletHint', '校内当面确认后记账')}</small></span></div>
            <div><CreditCard /><span><strong>{t('checkout.otherPay', '微信 / 支付宝')}</strong><small>{t('checkout.otherPayHint', '通道规划中，当前走校园确认付款')}</small></span></div>
          </div>
          <Button className="checkout-confirm" onClick={confirm} disabled={busy}>
            {type === 'service' ? <Bike /> : type === 'wanted' ? <MessageCircle /> : <WalletCards />} {busy ? t('checkout.processing', '处理中...') : copy.action}
          </Button>
          {type !== 'service' && type !== 'wanted' ? <p className="checkout-dev-note">{t('checkout.devNote', '点击后会创建订单并模拟付款，自动给卖家发送「我已付款」消息。')}</p> : null}
        </div>
        <aside className="checkout-safety"><ShieldCheck /><h2>{t('checkout.safetyTitle', '校园安心交易')}</h2><p>{t('checkout.safetyBody', '付款前核对商品状态与卖家信息，优先选择校内公共区域当面验货。')}</p><ul><li>{t('checkout.tip1', '确认实物或账号信息')}</li><li>{t('checkout.tip2', '不要脱离平台沟通')}</li><li>{t('checkout.tip3', '发现异常及时举报')}</li></ul></aside>
      </div>
    </section>
  )
}
