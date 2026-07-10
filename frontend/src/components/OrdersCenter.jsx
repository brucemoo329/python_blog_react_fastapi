import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Package, Truck, Wallet, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cancelOrder, getMyOrders, payOrder, receiveOrder, shipOrder } from '@/api/marketplace'
import { t as translate } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export default function OrdersCenter({ onBack, onNotice, onOpenOrder, onPurchase, language = 'zh-CN' }) {
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
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
      else if (action === 'cancel') response = await cancelOrder(order.id)
      onNotice?.(response?.message || t('orders.actionOk', '操作成功'))
      await load()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || t('orders.actionFail', '订单操作失败'))
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
          <p>{t('orders.subtitle')}</p>
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
        {orders.map((order) => (
          <article key={order.id} className={cn('order-card', `role-${order.role}`)}>
            <header>
              <div>
                <Badge variant="secondary">{order.role === 'buyer' ? t('orders.buyerRole') : t('orders.sellerRole')}</Badge>
                <strong>{order.title}</strong>
                <small>{t('orders.orderNo', '订单号')} {order.order_no}</small>
              </div>
              <em>{order.status_label || order.status}</em>
            </header>
            <div className="order-card-body">
              {order.image_url ? <img src={order.image_url} alt="" /> : <span className="order-thumb"><Package /></span>}
              <div>
                <p>{order.description || t('orders.campusOrder', '校园交易订单')}</p>
                <span>{t('orders.delivery', '交付')}：{order.meeting_location || (order.delivery_method === 'campus_meet' ? t('orders.campusMeet', '校内当面交易') : order.delivery_method)}</span>
                <strong className="order-price">¥{Number(order.amount || 0).toFixed(2)}</strong>
              </div>
            </div>
            <footer>
              <Button variant="outline" size="sm" onClick={() => onOpenOrder?.(order)}>{t('orders.detail')}</Button>
              {order.listing_id && order.role === 'buyer' && order.status === 'pending_payment' ? (
                <Button size="sm" onClick={() => onPurchase?.({ type: 'listing', id: order.listing_id, title: order.title, price: order.amount, image_url: order.image_url })}>{t('orders.goPay', '去付款页')}</Button>
              ) : null}
              {(order.actions || []).includes('pay') ? (
                <Button size="sm" disabled={busyId === order.id} onClick={() => runAction(order, 'pay')}><Wallet /> {t('orders.pay')}</Button>
              ) : null}
              {(order.actions || []).includes('ship') ? (
                <Button size="sm" disabled={busyId === order.id} onClick={() => runAction(order, 'ship')}><Truck /> {t('orders.ship')}</Button>
              ) : null}
              {(order.actions || []).includes('receive') ? (
                <Button size="sm" disabled={busyId === order.id} onClick={() => runAction(order, 'receive')}><CheckCircle2 /> {t('orders.receive')}</Button>
              ) : null}
              {(order.actions || []).includes('cancel') ? (
                <Button size="sm" variant="ghost" disabled={busyId === order.id} onClick={() => runAction(order, 'cancel')}><XCircle /> {t('orders.cancel')}</Button>
              ) : null}
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}
