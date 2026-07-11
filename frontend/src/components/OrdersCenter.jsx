import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bike, Package, Star, Truck, Wallet, CheckCircle2, XCircle, Navigation, Trash2, Scale, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  appealOrder,
  applyAfterSale,
  cancelOrder,
  deleteOrderRecord,
  getMyOrders,
  payOrder,
  receiveOrder,
  reviewOrder,
  respondAfterSale,
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

function reviewTargetText(order) {
  const hint = order?.review_target?.hint
  if (hint) return hint
  const roleLabel = order?.review_target?.role_label
  const name = order?.review_target?.user?.nickname || order?.review_target?.user?.username
  if (roleLabel && name) return `你正在评价对方（${roleLabel}）：${name}`
  if (roleLabel) return `你正在评价对方（${roleLabel}）`
  const isService = order?.kind === 'service' || order?.service_task_id
  if (isService) {
    return order?.role === 'buyer' ? '你正在评价跑手（接单配送的同学）' : '你正在评价发布者（发任务的同学）'
  }
  return order?.role === 'buyer' ? '你正在评价卖家' : '你正在评价买家'
}

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
  const [appealFor, setAppealFor] = useState(null)
  const [appealReason, setAppealReason] = useState('')
  const [afterSaleFor, setAfterSaleFor] = useState(null)
  const [afterSaleReason, setAfterSaleReason] = useState('')
  const [afterSaleResponse, setAfterSaleResponse] = useState('')
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
    { id: 'refunded', label: '退款完成' },
    { id: 'cancelled', label: t('orders.cancelled') },
  ], [language])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getMyOrders({ role, status })
      setOrders(Array.isArray(response?.items) ? response.items : [])
    } catch (error) {
      // Keep previous list on failure so the page does not go blank after actions
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

  const submitAppeal = async () => {
    if (!appealFor || !appealReason.trim()) {
      onNotice?.('请填写申诉理由')
      return
    }
    setBusyId(appealFor.id)
    try {
      const complaintId = appealFor.complaints_against_me?.[0]?.id
      const response = await appealOrder(appealFor.id, {
        reason: appealReason.trim(),
        review_id: complaintId || undefined,
      })
      onNotice?.(response?.message || '申诉已提交')
      setAppealFor(null)
      setAppealReason('')
      await load()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '申诉提交失败')
    } finally {
      setBusyId(null)
    }
  }

  const removeRecord = async (order) => {
    if (!window.confirm('删除后仅对自己隐藏该订单记录，对方仍可见。确认删除？')) return
    setBusyId(order.id)
    try {
      const response = await deleteOrderRecord(order.id)
      onNotice?.(response?.message || '记录已删除')
      await load()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '删除失败')
    } finally {
      setBusyId(null)
    }
  }

  const submitAfterSale = async () => {
    if (!afterSaleFor) return
    const isSellerResponse = afterSaleFor.mode === 'respond'
    const text = (isSellerResponse ? afterSaleResponse : afterSaleReason).trim()
    if (!text || text.length < 2) {
      onNotice?.(isSellerResponse ? '请填写至少 2 个字的协商说明' : '请填写至少 2 个字的售后原因')
      return
    }
    const orderId = afterSaleFor.order.id
    setBusyId(orderId)
    try {
      const response = isSellerResponse
        ? await respondAfterSale(orderId, { agree: afterSaleFor.agree, response: text })
        : await applyAfterSale(orderId, { reason: text })
      onNotice?.(response?.message || '售后状态已更新')
      setAfterSaleFor(null)
      setAfterSaleReason('')
      setAfterSaleResponse('')
      // Optimistically patch list so UI never goes blank if refresh fails
      if (response?.item) {
        setOrders((prev) => {
          const next = prev.map((item) => (item.id === orderId ? { ...item, ...response.item } : item))
          return next.some((item) => item.id === orderId) ? next : [response.item, ...prev]
        })
      }
      try {
        await load()
      } catch {
        // load already surfaces notice
      }
    } catch (error) {
      const detail = error.response?.data?.detail
      let message = '售后操作失败'
      if (typeof detail === 'string') message = detail
      else if (Array.isArray(detail)) {
        message = detail.map((item) => item?.msg || item?.message || JSON.stringify(item)).join('；')
      } else if (detail) message = JSON.stringify(detail)
      onNotice?.(message)
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
          <p>商品订单与跑腿订单都会显示在这里。跑腿单：发布者可评价/投诉跑手，跑手可评价/投诉发布者。</p>
        </div>
      </header>

      <section className="orders-filter-panel" aria-label="订单筛选">
        <div className="orders-filter-group">
          <span>订单身份</span>
          <div className="orders-tabs">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" className={cn(role === tab.id && 'is-active')} onClick={() => setRole(tab.id)}>{tab.label}</button>
            ))}
          </div>
        </div>
        <div className="orders-filter-group">
          <span>订单状态</span>
          <div className="orders-status-tabs">
            {statusTabs.map((tab) => (
              <button key={tab.id} type="button" className={cn(status === tab.id && 'is-active')} onClick={() => setStatus(tab.id)}>{tab.label}</button>
            ))}
          </div>
        </div>
      </section>
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
          const peerName = order.review_target?.user?.nickname || order.review_target?.user?.username
          const peerRole = order.review_target?.role_label
          return (
            <article key={order.id} className={cn('order-card', `role-${order.role}`, isService && 'is-service')}>
              <header>
                <div>
                  <div className="order-badges">
                    <Badge variant="secondary">{order.role === 'buyer' ? (isService ? '我是发布者' : t('orders.buyerRole')) : (isService ? '我是跑手' : t('orders.sellerRole'))}</Badge>
                    {isService ? <Badge>跑腿</Badge> : <Badge variant="outline">商品</Badge>}
                  </div>
                  <button type="button" className="order-title-link" onClick={() => onOpenOrder?.(order)}>
                    <strong>{order.title}</strong>
                  </button>
                  <small>{t('orders.orderNo', '订单号')} {order.order_no}</small>
                  {peerRole ? <small className="order-peer-line">对方：{peerRole}{peerName ? ` · ${peerName}` : ''}</small> : null}
                </div>
                <em>{order.status_label || order.status}</em>
              </header>
              <button type="button" className="order-card-body is-clickable" onClick={() => onOpenOrder?.(order)}>
                {order.image_url ? <img src={order.image_url} alt="" /> : <span className="order-thumb">{isService ? <Bike /> : <Package />}</span>}
                <div>
                  <p>{order.description || (isService ? '校园跑腿订单' : t('orders.campusOrder', '校园交易订单'))}</p>
                  <span>{t('orders.delivery', '交付')}：{order.meeting_location || t('orders.campusMeet', '校内当面交易')}</span>
                  {order.cancel_reason ? <span className="order-cancel-reason">取消原因：{order.cancel_reason}</span> : null}
                  {order.complaints_against_me?.length ? (
                    <span className="order-complaint-hint">你收到对方投诉，可申诉至客服</span>
                  ) : null}
                  {order.my_appeals?.[0] ? (
                    <span className="order-appeal-status">
                      申诉状态：{order.my_appeals[0].status === 'pending' ? '客服处理中' : order.my_appeals[0].status === 'approved' ? '已通过' : '已驳回'}
                      {order.my_appeals[0].admin_note ? ` · ${order.my_appeals[0].admin_note}` : ''}
                    </span>
                  ) : null}
                  {order.after_sale ? (
                    <span className="order-after-sale-status">
                      售后：{{
                        pending_seller: '等待卖家协商',
                        admin_pending: '客服裁定中',
                        refunded: '退款完成',
                        rejected: '售后已驳回',
                      }[order.after_sale.status] || order.after_sale.status || '处理中'}
                      {order.after_sale.reason ? ` · ${order.after_sale.reason}` : ''}
                      {order.after_sale.admin_note ? ` · ${order.after_sale.admin_note}` : ''}
                    </span>
                  ) : null}
                  {order.status === 'refunded' ? (
                    <span className="order-after-sale-status">订单状态：退款完成</span>
                  ) : null}
                  <strong className="order-price">¥{Number(order.amount || 0).toFixed(2)}</strong>
                  <small className="order-open-hint">点击查看订单与交易进度</small>
                </div>
              </button>
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
                {order.can_apply_after_sale ? (
                  <Button size="sm" variant="outline" onClick={() => { setAfterSaleFor({ order, mode: 'apply' }); setAfterSaleReason('') }}>
                    <RotateCcw /> 申请售后
                  </Button>
                ) : null}
                {order.can_respond_after_sale ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setAfterSaleFor({ order, mode: 'respond', agree: false }); setAfterSaleResponse('') }}>拒绝售后</Button>
                    <Button size="sm" onClick={() => { setAfterSaleFor({ order, mode: 'respond', agree: true }); setAfterSaleResponse('') }}>同意退款</Button>
                  </>
                ) : null}
                {actions.includes('cancel') ? (
                  <Button size="sm" variant="ghost" disabled={busyId === order.id} onClick={() => { setCancelFor(order); setCancelReason(CANCEL_REASONS[2]) }}>
                    <XCircle /> {t('orders.cancel')}
                  </Button>
                ) : null}
                {order.can_review ? (
                  <Button size="sm" variant="secondary" onClick={() => { setReviewFor(order); setRating(5); setReviewText('') }}>
                    <Star /> {order.peer_cancelled ? '投诉或不投诉' : `好评/投诉${peerRole ? `（${peerRole}）` : ''}`}
                  </Button>
                ) : null}
                {order.my_review ? (
                  <span className="order-reviewed">
                    {order.my_review.is_complaint ? '已投诉' : `已评价 ${order.my_review.rating} 星`}
                    {peerRole ? ` · 对象：${peerRole}` : ''}
                  </span>
                ) : null}
                {order.can_appeal ? (
                  <Button size="sm" variant="outline" onClick={() => { setAppealFor(order); setAppealReason('') }}>
                    <Scale /> 申诉客服
                  </Button>
                ) : null}
                {order.can_delete_record ? (
                  <Button size="sm" variant="ghost" disabled={busyId === order.id} onClick={() => removeRecord(order)}>
                    <Trash2 /> 删除记录
                  </Button>
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
            <p className="order-review-target">{reviewTargetText(reviewFor)}</p>
            <p>
              {reviewFor.peer_cancelled
                ? '你可以投诉对方，或选择不投诉。投诉将影响对方信任分。'
                : '星级与投诉对象均为对方，不是自己。好评加分，投诉扣对方信任分。'}
            </p>
            {!reviewFor.peer_cancelled ? (
              <div className="order-star-row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className={cn(rating >= n && 'is-on')} onClick={() => setRating(n)}>★</button>
                ))}
              </div>
            ) : null}
            {!reviewFor.peer_cancelled ? (
              <small className="order-star-hint">当前将给「{reviewFor.review_target?.role_label || '对方'}」打 {rating} 星</small>
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
              <Button variant="destructive" disabled={busyId === reviewFor.id} onClick={() => submitReview(true)}>
                投诉{reviewFor.review_target?.role_label ? `（${reviewFor.review_target.role_label}）` : ''} -20
              </Button>
              {!reviewFor.peer_cancelled ? (
                <Button disabled={busyId === reviewFor.id} onClick={() => submitReview(false)}>
                  提交好评给{reviewFor.review_target?.role_label || '对方'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {appealFor ? (
        <div className="order-modal-mask">
          <div className="order-modal">
            <h3>订单申诉</h3>
            <p>你认为对方的投诉不公？说明理由后将提交给平台客服（管理员）处理。通过后可恢复被扣信任分。</p>
            {appealFor.complaints_against_me?.[0] ? (
              <div className="order-complaint-box">
                <strong>对方投诉内容</strong>
                <p>{appealFor.complaints_against_me[0].content || '（无文字）'}</p>
              </div>
            ) : null}
            <textarea
              className="order-review-text"
              rows={4}
              placeholder="请说明申诉理由，例如：对方未按约定取货/恶意取消/描述不符…"
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
            />
            <div className="order-modal-actions">
              <Button variant="outline" onClick={() => setAppealFor(null)}>取消</Button>
              <Button disabled={busyId === appealFor.id} onClick={submitAppeal}>提交申诉</Button>
            </div>
          </div>
        </div>
      ) : null}

      {afterSaleFor ? (
        <div className="order-modal-mask">
          <div className="order-modal">
            <h3>{afterSaleFor.mode === 'apply' ? '申请退货退款' : afterSaleFor.agree ? '同意退货退款' : '拒绝售后申请'}</h3>
            <p>{afterSaleFor.mode === 'apply'
              ? '提交后需要卖家同意；卖家不同意时，会自动进入客服裁定。'
              : afterSaleFor.agree
                ? '同意后平台会将订单标记为退款完成，并恢复商品在售状态。'
                : '拒绝后会自动建立客服工单，由平台裁定是否退款。'}</p>
            <textarea
              className="order-review-text"
              rows={4}
              placeholder={afterSaleFor.mode === 'apply' ? '请说明退货/退款原因、商品情况和你的处理诉求…' : '请写明协商说明，客服会一并查看…'}
              value={afterSaleFor.mode === 'apply' ? afterSaleReason : afterSaleResponse}
              onChange={(event) => afterSaleFor.mode === 'apply' ? setAfterSaleReason(event.target.value) : setAfterSaleResponse(event.target.value)}
            />
            <div className="order-modal-actions">
              <Button variant="outline" onClick={() => setAfterSaleFor(null)}>取消</Button>
              <Button disabled={busyId === afterSaleFor.order.id} onClick={submitAfterSale}>
                {afterSaleFor.mode === 'apply' ? '提交申请' : afterSaleFor.agree ? '确认同意退款' : '确认拒绝并转客服'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
