import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Package, Truck, Wallet, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cancelOrder, getMyOrders, payOrder, receiveOrder, shipOrder } from '@/api/marketplace'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'all', label: '全部' },
  { id: 'buyer', label: '我买到的' },
  { id: 'seller', label: '我卖出的' },
]

const STATUS_TABS = [
  { id: 'all', label: '全部状态' },
  { id: 'pending_payment', label: '待付款' },
  { id: 'pending_ship', label: '待发货' },
  { id: 'shipped', label: '待收货' },
  { id: 'completed', label: '已完成' },
  { id: 'cancelled', label: '已取消' },
]

export default function OrdersCenter({ onBack, onNotice, onOpenOrder, onPurchase }) {
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getMyOrders({ role, status })
      setOrders(response.items || [])
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '订单加载失败')
    } finally {
      setLoading(false)
    }
  }, [role, status, onNotice])

  useEffect(() => { load() }, [load])

  const runAction = async (order, action) => {
    setBusyId(order.id)
    try {
      let response
      if (action === 'pay') response = await payOrder(order.id)
      else if (action === 'ship') response = await shipOrder(order.id, { meeting_location: order.meeting_location || '宿舍楼下当面交付' })
      else if (action === 'receive') response = await receiveOrder(order.id)
      else if (action === 'cancel') response = await cancelOrder(order.id)
      onNotice?.(response?.message || '操作成功')
      await load()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '订单操作失败')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="orders-center">
      <header className="orders-center-header">
        <Button variant="ghost" onClick={onBack}><ArrowLeft /> 返回</Button>
        <div>
          <h1>我的订单</h1>
          <p>校园当面交易 · 付款与发货状态一目了然</p>
        </div>
      </header>

      <div className="orders-tabs">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={cn(role === tab.id && 'is-active')} onClick={() => setRole(tab.id)}>{tab.label}</button>
        ))}
      </div>
      <div className="orders-status-tabs">
        {STATUS_TABS.map((tab) => (
          <button key={tab.id} type="button" className={cn(status === tab.id && 'is-active')} onClick={() => setStatus(tab.id)}>{tab.label}</button>
        ))}
      </div>

      <div className="orders-list">
        {loading ? <div className="chat-empty">订单加载中...</div> : null}
        {!loading && !orders.length ? (
          <div className="chat-empty">
            <Package />
            <h3>还没有相关订单</h3>
            <p>去逛逛二手好物，或等待同学下单你的发布。</p>
          </div>
        ) : null}
        {orders.map((order) => (
          <article key={order.id} className={cn('order-card', `role-${order.role}`)}>
            <header>
              <div>
                <Badge variant="secondary">{order.role === 'buyer' ? '我是买家' : '我是卖家'}</Badge>
                <strong>{order.title}</strong>
                <small>订单号 {order.order_no}</small>
              </div>
              <em>{order.status_label || order.status}</em>
            </header>
            <div className="order-card-body">
              {order.image_url ? <img src={order.image_url} alt="" /> : <span className="order-thumb"><Package /></span>}
              <div>
                <p>{order.description || '校园交易订单'}</p>
                <span>交付：{order.meeting_location || (order.delivery_method === 'campus_meet' ? '校内当面交易' : order.delivery_method)}</span>
                <strong className="order-price">¥{Number(order.amount || 0).toFixed(2)}</strong>
              </div>
            </div>
            <footer>
              <Button variant="outline" size="sm" onClick={() => onOpenOrder?.(order)}>查看详情</Button>
              {order.listing_id && order.role === 'buyer' && order.status === 'pending_payment' ? (
                <Button size="sm" onClick={() => onPurchase?.({ type: 'listing', id: order.listing_id, title: order.title, price: order.amount, image_url: order.image_url })}>去付款页</Button>
              ) : null}
              {(order.actions || []).includes('pay') ? (
                <Button size="sm" disabled={busyId === order.id} onClick={() => runAction(order, 'pay')}><Wallet /> 确认付款</Button>
              ) : null}
              {(order.actions || []).includes('ship') ? (
                <Button size="sm" disabled={busyId === order.id} onClick={() => runAction(order, 'ship')}><Truck /> 我已发货</Button>
              ) : null}
              {(order.actions || []).includes('receive') ? (
                <Button size="sm" disabled={busyId === order.id} onClick={() => runAction(order, 'receive')}><CheckCircle2 /> 确认收货</Button>
              ) : null}
              {(order.actions || []).includes('cancel') ? (
                <Button size="sm" variant="ghost" disabled={busyId === order.id} onClick={() => runAction(order, 'cancel')}><XCircle /> 取消订单</Button>
              ) : null}
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}
