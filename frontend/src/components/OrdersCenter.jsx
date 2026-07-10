import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bike, Package, Star, Truck, Wallet, CheckCircle2, XCircle, Navigation } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  cancelOrder,
  getMyOrders,
  payOrder,
  receiveOrder,
  reviewOrder,
  shipOrder,
  skipOrderReview,
} from '@/api/marketplace'
import { t as translate } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const CANCEL_REASONS = [
  '临时有事，无法继续',
  '地址/时间冲突',
  '双方协商取消',
  '跑腿费用/条件不合适',
  '联系不上对方',
  '其他原因',
]

export default function OrdersCenter({
  language = 'zh-CN',
  onBack,
  onNotice,
  onOpenOrder,
  onPurchase,
  onOpenErrandNav,
}) {
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [cancelFor, setCancelFor] = useState(null)
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[2])
  const [reviewFor, setReviewFor] = useState(null)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const t = (key, fallback = '') => translate(language, key, fallback)

  const tabs = useMemo(() => [
    { id: 'all', label: t('orders.all') },
    { id: 'buyer', label: t('orders.buyer') },
    { id: 'seller', label: t('orders.seller') },
  ], [language])

  const statusTabs = useMemo(() => [
    { id: 'all', label: t('orders.statusAll') },
    { id: 'pending_payment', label: t('orders.pendingPay') },
    { id: 'pending_ship', label: t('orders.pendingShip') },
    { id: 'shipped', label: t('orders.shipped') },
    { id: 'completed', label: t('orders.done') },
    { id: 'cancelled', label: t('orders.cancelled') },
  ], [language])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getMyOrders({ role, status })
      setOrders(response.items || [])
    } catch (error) {
      onNotice?.(error.response?.data?.detail || t('orders.loadFail', '订单加载失败'))
    } finally {
      setLoading(false)
    }
  }, [role, status, onNotice, language])

  useEffect(() => { load() }, [load])

  const runAction = async (order, action) => {
    setBusyId(order.id)
    try {
      let response
      if (action === 'pay') response = await payOrder(order.id)
      else if (action === 'ship') response = await shipOrder(order.id, { meeting_location: order.meeting_location || t('orders.defaultMeet', '宿舍楼下当面交付') })
      else if (action === 'receive') response = await receiveOrder(order.id)
      onNotice?.(response?.message || t('orders.actionOk', '操作成功'))
      await load()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || t('orders.actionFail', '订单操作失败'))
    } finally {
      setBusyId(null)
    }
  }

  const submitCancel = async () => {
    if (!cancelFor) return
    setBusyId(cancelFor.id)
    try {
      const response = await cancelOrder(cancelFor.id, cancelReason)
      onNotice?.(response?.message || '订单已取消')
      setCancelFor(null)
      await load()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '取消失败')
    } finally {
      setBusyId(null)
    }
  }

  const submitReview = async (isComplaint = false) => {
    if (!reviewFor) return
    setBusyId(reviewFor.id)
    try {
      const response = await reviewOrder(reviewFor.id, {
        rating: isComplaint ? 1 : rating,
        content: reviewText || (isComplaint ? '对本次交易提出投诉' : '好评'),
        is_complaint: isComplaint,
      })
      onNotice?.(response?.message || '评价成功')
      setReviewFor(null)
      setReviewText('')
      setRating(5)
      await load()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '评价失败')
    } finally {
      setBusyId(null)
    }
  }

  const submitSkip = async (order) => {
    setBusyId(order.id)
    try {
      const response = await skipOrderReview(order.id)
      onNotice?.(response?.message || '已选择不投诉')
      setReviewFor(null)
      await load()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="orders-center">
      <header className="orders-center-header">
        <Button variant="ghost" onClick={onBack}><ArrowLeft /> {t('detail.back')}</Button>
        <div>
          <h1>{t('orders.title')}</h1>
          <p>商品订单与跑腿订单都会显示在这里</p>
        </div>
      </header>

      <div className="orders-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={cn(role === tab.id && 'is-active')} onClick={() => setRole(tab.id)}>{tab.label}</button>
        ))}
      </div>
      <div className="orders-status-tabs">
        {statusTabs.map((tab) => (
          <button key={tab.id} type="button" className={cn(status === tab.id && 'is-active')} onClick={() => setStatus(tab.id)}>{tab.label}</button>
        ))}
      </div>

      <div className="orders-list">
        {loading ? <div className="chat-empty">{t('orders.loading')}</div> : null}
        {!loading && !orders.length ? (
          <div className="chat-empty">
            <Package />
            <h3>{t('orders.empty')}</h3>
            <p>{t('orders.emptyHint')}</p>
          </div>
        ) : null}
        {orders.map((order) => {
          const isService = order.kind === 'service' || order.service_task_id
          const actions = order.actions || []
          return (
            <article key={order.id} className={cn('order-card', `role-${order.role}`, isService && 'is-service')}>
              <header>
                <div>
                  <div className="order-badges">
                    <Badge variant="secondary">{order.role === 'buyer' ? (isService ? '我是发布者' : t('orders.buyerRole')) : (isService ? '我是跑手' : t('orders.sellerRole'))}</Badge>
                    {isService ? <Badge>跑腿</Badge> : <Badge variant="outline">商品</Badge>}
                  </div>
                  <strong>{order.title}</strong>
                  <small>{t('orders.orderNo', '订单号')} {order.order_no}</small>
                </div>
                <em>{order.status_label || order.status}</em>
              </header>
              <div className="order-card-body">
                {order.image_url ? <img src={order.image_url} alt="" /> : <span className="order-thumb">{isService ? <Bike /> : <Package />}</span>}
                <div>
                  <p>{order.description || (isService ? '校园跑腿订单' : t('orders.campusOrder', '校园交易订单'))}</p>
                  <span>{t('orders.delivery', '交付')}：{order.meeting_location || t('orders.campusMeet', '校内当面交易')}</span>
                  {order.cancel_reason ? <span className="order-cancel-reason">取消原因：{order.cancel_reason}</span> : null}
                  <strong className="order-price">¥{Number(order.amount || 0).toFixed(2)}</strong>
                </div>
              </div>
              <footer>
                <Button variant="outline" size="sm" onClick={() => onOpenOrder?.(order)}>{t('orders.detail')}</Button>
                {isService && order.service_task_id && !['completed', 'cancelled'].includes(order.status) ? (
                  <Button size="sm" onClick={() => onOpenErrandNav?.(order.service_task_id, order.service_task)}>
                    <Navigation /> 配送导航
                  </Button>
                ) : null}
                {order.listing_id && order.role === 'buyer' && order.status === 'pending_payment' ? (
                  <Button size="sm" onClick={() => onPurchase?.({ type: 'listing', id: order.listing_id, title: order.title, price: order.amount, image_url: order.image_url })}>{t('orders.goPay', '去付款页')}</Button>
                ) : null}
                {actions.includes('pay') ? (
                  <Button size="sm" disabled={busyId === order.id} onClick={() => runAction(order, 'pay')}><Wallet /> {t('orders.pay')}</Button>
                ) : null}
                {actions.includes('ship') ? (
                  <Button size="sm" disabled={busyId === order.id} onClick={() => runAction(order, 'ship')}><Truck /> {t('orders.ship')}</Button>
                ) : null}
                {actions.includes('receive') ? (
                  <Button size="sm" disabled={busyId === order.id} onClick={() => runAction(order, 'receive')}><CheckCircle2 /> {t('orders.receive')}</Button>
                ) : null}
                {actions.includes('cancel') ? (
                  <Button size="sm" variant="ghost" disabled={busyId === order.id} onClick={() => { setCancelFor(order); setCancelReason(CANCEL_REASONS[2]) }}>
                    <XCircle /> {t('orders.cancel')}
                  </Button>
                ) : null}
                {order.can_review ? (
                  <Button size="sm" variant="secondary" onClick={() => { setReviewFor(order); setRating(5); setReviewText('') }}>
                    <Star /> {order.peer_cancelled ? '投诉或不投诉' : '好评/投诉'}
                  </Button>
                ) : null}
                {order.my_review ? (
                  <span className="order-reviewed">已评价 {order.my_review.rating} 星</span>
                ) : null}
              </footer>
            </article>
          )
        })}
      </div>

      {cancelFor ? (
        <div className="order-modal-mask">
          <div className="order-modal">
            <h3>取消订单</h3>
            <p>请选择取消原因，取消后对方可选择投诉或不投诉。</p>
            <div className="order-reason-list">
              {CANCEL_REASONS.map((reason) => (
                <button key={reason} type="button" className={cn(cancelReason === reason && 'is-active')} onClick={() => setCancelReason(reason)}>
                  {reason}
                </button>
              ))}
            </div>
            <div className="order-modal-actions">
              <Button variant="outline" onClick={() => setCancelFor(null)}>返回</Button>
              <Button variant="destructive" disabled={busyId === cancelFor.id} onClick={submitCancel}>确认取消</Button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewFor ? (
        <div className="order-modal-mask">
          <div className="order-modal">
            <h3>{reviewFor.peer_cancelled ? '对方取消了订单' : '订单评价'}</h3>
            <p>{reviewFor.peer_cancelled ? '你可以选择投诉对方，或选择不投诉。' : '完成后可给对方好评或投诉，将影响信任分。'}</p>
            {!reviewFor.peer_cancelled ? (
              <div className="order-star-row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className={cn(rating >= n && 'is-on')} onClick={() => setRating(n)}>★</button>
                ))}
              </div>
            ) : null}
            <textarea
              className="order-review-text"
              rows={3}
              placeholder="写一点评价内容（可选）"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
            <div className="order-modal-actions">
              <Button variant="outline" onClick={() => setReviewFor(null)}>关闭</Button>
              {reviewFor.peer_cancelled || reviewFor.status === 'cancelled' ? (
                <Button variant="outline" disabled={busyId === reviewFor.id} onClick={() => submitSkip(reviewFor)}>不投诉</Button>
              ) : null}
              <Button variant="destructive" disabled={busyId === reviewFor.id} onClick={() => submitReview(true)}>投诉 -20</Button>
              {!reviewFor.peer_cancelled ? (
                <Button disabled={busyId === reviewFor.id} onClick={() => submitReview(false)}>提交好评</Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
