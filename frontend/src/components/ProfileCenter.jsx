import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  BellRing,
  Camera,
  CreditCard,
  Globe2,
  Heart,
  History,
  ImagePlus,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircleQuestion,
  PackageCheck,
  PencilLine,
  School,
  Send,
  ShieldCheck,
  ShoppingBag,
  Star,
  ThumbsUp,
  UserRoundCog,
  WalletCards,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  checkInProfile,
  createPaymentMethod,
  createUserAddress,
  getUserProfile,
  updateAccountSecurity,
  updateUserProfile,
} from '@/api/marketplace'

const LANGUAGES = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
]

const SCHOOLS = ['南通理工学院', '南通理工学院南通校区', '南通理工学院海安校区']

const BACKGROUND_THEMES = [
  { value: 'teal', label: '青绿校园' },
  { value: 'sunset', label: '黄昏操场' },
  { value: 'violet', label: '霓虹社团' },
  { value: 'forest', label: '图书馆绿荫' },
]

const EMPTY_PROFILE = {
  profile: {
    nickname: '校园同学',
    avatar_url: '',
    background_url: '',
    background_theme: 'teal',
    school: '南通理工学院',
    signature: '在校园里认真交易，也认真生活。',
    current_ip: '正在获取',
    language: 'zh-CN',
    followers: 0,
    following: 0,
  },
  trust: {
    score: 800,
    grade: '优秀',
    checked_in_today: false,
    completed_orders: 0,
    positive_reviews: 0,
    verified_reports: 0,
    pending_reports: 0,
    rules: [
      { label: '每日签到', points: '+2', note: '需要手动点击签到，每天一次' },
      { label: '交易成功', points: '+12', note: '买卖双方完成后加分' },
      { label: '获得好评', points: '+15', note: '4 星及以上评价加分' },
      { label: '核实违规', points: '-35', note: '只有投诉被核实才扣分' },
    ],
    events: [],
  },
  addresses: [],
  payment_methods: [],
  favorites: [],
  history: [],
  published: { listings: [], services: [], wanted: [], posts: [] },
  sold: [],
  bought: [],
  pending_reviews: [],
}

const SETTING_KEYS = ['profile', 'address', 'school', 'security', 'payment', 'payout', 'language', 'share', 'support']
const SETTING_LABELS = {
  profile: '个人资料',
  address: '地址管理',
  school: '学校选择',
  security: '账号与安全',
  payment: '支付方式',
  payout: '收款方式',
  language: '设置语言',
  share: '分享给朋友',
  support: '联系客服',
}

const SETTING_ICONS = {
  profile: UserRoundCog,
  address: MapPin,
  school: School,
  security: LockKeyhole,
  payment: CreditCard,
  payout: WalletCards,
  language: Globe2,
  share: Send,
  support: MessageCircleQuestion,
}

function shortDate(value) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function MiniItem({ item, emptyText }) {
  if (!item) return <div className="profile-empty-line">{emptyText}</div>
  return (
    <div className="profile-mini-item">
      {item.image_url ? <img src={item.image_url} alt="" /> : <span>{item.title?.slice(0, 1) || '校'}</span>}
      <div>
        <strong>{item.title}</strong>
        <small>{item.price_label || item.status || shortDate(item.created_at)}</small>
      </div>
      <em>{shortDate(item.created_at || item.viewed_at)}</em>
    </div>
  )
}

function compressImage(file, maxSize = 720, quality = 0.78) {
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
        const ctx = canvas.getContext('2d')
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function ProfileCenter({ user, onLogout, onNotice, onProfileChange }) {
  const avatarInputRef = useRef(null)
  const backgroundInputRef = useRef(null)
  const [data, setData] = useState(EMPTY_PROFILE)
  const [form, setForm] = useState(EMPTY_PROFILE.profile)
  const [activePanel, setActivePanel] = useState('profile')
  const [editOpen, setEditOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addressForm, setAddressForm] = useState({
    label: '宿舍',
    receiver_name: user?.username || '',
    phone: '',
    school: '南通理工学院',
    detail: '',
    is_default: true,
  })
  const [payForm, setPayForm] = useState({
    method_type: 'payment',
    channel: '微信',
    display_name: '校园交易付款',
    account_mask: '',
    is_default: true,
  })
  const [securityForm, setSecurityForm] = useState({
    username: user?.username || '',
    current_password: '',
    new_password: '',
  })

  const syncProfile = (nextProfile, nextTrust) => {
    const mergedProfile = { ...form, ...nextProfile }
    setForm(mergedProfile)
    if (nextTrust) setData((current) => ({ ...current, trust: { ...current.trust, ...nextTrust } }))
    onProfileChange?.({
      ...user,
      username: securityForm.username || user?.username,
      profile: mergedProfile,
      trust: nextTrust || data.trust,
    })
    if (mergedProfile.language) {
      document.documentElement.lang = mergedProfile.language
      localStorage.setItem('campus_language', mergedProfile.language)
    }
  }

  const refreshProfile = async () => {
    try {
      const response = await getUserProfile()
      setData({ ...EMPTY_PROFILE, ...response })
      const nextProfile = { ...EMPTY_PROFILE.profile, ...response.profile }
      setForm(nextProfile)
      setSecurityForm((current) => ({ ...current, username: response.user?.username || user?.username || '' }))
      setAddressForm((current) => ({ ...current, school: nextProfile.school || current.school }))
      onProfileChange?.({ ...user, ...response.user, profile: nextProfile, trust: response.trust })
      if (nextProfile.language) {
        document.documentElement.lang = nextProfile.language
        localStorage.setItem('campus_language', nextProfile.language)
      }
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '个人主页数据暂时离线，已使用本地演示数据')
      setData((current) => ({ ...current, profile: { ...current.profile, nickname: user?.username || current.profile.nickname } }))
    }
  }

  useEffect(() => {
    refreshProfile()
  }, [])

  const publishedList = useMemo(() => [
    ...(data.published?.listings || []),
    ...(data.published?.services || []),
    ...(data.published?.wanted || []),
    ...(data.published?.posts || []),
  ], [data.published])

  const trustPercent = Math.min(100, Math.max(0, Math.round((data.trust.score / 1000) * 100)))
  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const saveProfile = async (patch = form, message = '个人资料已保存') => {
    setSaving(true)
    try {
      const response = await updateUserProfile(patch)
      setData((current) => ({ ...current, profile: { ...current.profile, ...response.profile } }))
      syncProfile(response.profile)
      onNotice?.(message)
      return response.profile
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '保存失败，请稍后重试')
      return null
    } finally {
      setSaving(false)
    }
  }

  const saveSettingProfile = async (patch, message) => {
    const saved = await saveProfile(patch, message)
    if (saved) setSettingsOpen(false)
  }

  const handleAvatar = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const avatar_url = await compressImage(file, 520, 0.76)
      updateForm('avatar_url', avatar_url)
      await saveProfile({ avatar_url }, '头像已保存到数据库')
    } catch {
      onNotice?.('头像处理失败，请换一张图片')
    } finally {
      event.target.value = ''
    }
  }

  const handleBackground = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const background_url = await compressImage(file, 1200, 0.74)
      updateForm('background_url', background_url)
      await saveProfile({ background_url }, '主页背景已保存')
    } catch {
      onNotice?.('背景图处理失败，请换一张图片')
    } finally {
      event.target.value = ''
    }
  }

  const saveAddress = async () => {
    try {
      await createUserAddress({ ...addressForm, school: form.school })
      onNotice?.('地址已添加')
      refreshProfile()
      setAddressForm((current) => ({ ...current, detail: '', phone: '' }))
      setSettingsOpen(false)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '地址保存失败')
    }
  }

  const savePayment = async () => {
    try {
      await createPaymentMethod({ ...payForm, method_type: activePanel === 'payout' ? 'payout' : 'payment' })
      onNotice?.(activePanel === 'payment' ? '支付方式已保存' : '收款方式已保存')
      refreshProfile()
      setSettingsOpen(false)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '支付/收款方式保存失败')
    }
  }

  const handleCheckIn = async () => {
    try {
      const response = await checkInProfile()
      setData((current) => ({
        ...current,
        trust: { ...current.trust, ...response.trust, checked_in_today: response.checked_in_today },
      }))
      onProfileChange?.({ ...user, profile: form, trust: response.trust })
      onNotice?.(response.message)
      refreshProfile()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '签到失败')
    }
  }

  const saveSecurity = async () => {
    try {
      const payload = {
        username: securityForm.username?.trim() || undefined,
        current_password: securityForm.current_password || undefined,
        new_password: securityForm.new_password || undefined,
      }
      const response = await updateAccountSecurity(payload)
      const nextUser = { ...user, ...response.user, profile: form, trust: data.trust }
      localStorage.setItem('campus_user', JSON.stringify(nextUser))
      onProfileChange?.(nextUser)
      onNotice?.('账号与安全已更新')
      setSecurityForm((current) => ({ ...current, current_password: '', new_password: '' }))
      refreshProfile()
      setSettingsOpen(false)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '账号安全保存失败')
    }
  }

  const shareProfile = async () => {
    const text = `来校园脉动找我交易：${form.nickname || user?.username || '校园同学'}`
    try {
      await navigator.clipboard.writeText(text)
      onNotice?.('分享文案已复制')
    } catch {
      onNotice?.(text)
    }
  }

  const chooseSetting = (key) => {
    if (key === 'share') return shareProfile()
    if (key === 'support') return onNotice?.('客服入口已准备好，后续可接入工单或在线消息')
    if (key === 'profile') return setEditOpen(true)
    setActivePanel(key)
    setSettingsOpen(true)
  }

  return (
    <div className="profile-center">
      <section
        className="profile-hero"
        data-theme={form.background_theme || 'teal'}
        style={form.background_url ? { '--profile-bg-image': `url("${form.background_url}")` } : undefined}
      >
        <div className="profile-hero-glow" />
        <div className="profile-avatar-wrap">
          <Avatar className="profile-avatar">
            <AvatarImage src={form.avatar_url || undefined} alt={form.nickname} />
            <AvatarFallback>{(form.nickname || user?.username || '同').slice(0, 1)}</AvatarFallback>
          </Avatar>
          <button type="button" onClick={() => avatarInputRef.current?.click()} title="上传头像">
            <Camera />
          </button>
          <input ref={avatarInputRef} hidden type="file" accept="image/*" onChange={handleAvatar} />
        </div>
        <div className="profile-hero-main">
          <div>
            <Badge variant="secondary"><BadgeCheck /> {data.trust.grade}</Badge>
            <h1>{form.nickname || user?.username || '校园同学'}</h1>
            <p>{form.signature || '添加一句个性化留言，让同学更了解你。'}</p>
          </div>
          <div className="profile-identity">
            <span><MapPin /> 当前地区：{form.current_ip || '正在获取'}</span>
            <span><School /> 当前学校：{form.school || '南通理工学院'}</span>
          </div>
        </div>
        <div className="profile-social">
          <div><strong>{form.followers || 0}</strong><span>粉丝</span></div>
          <div><strong>{form.following || 0}</strong><span>关注</span></div>
          <div><strong>{data.trust.score}</strong><span>信任分</span></div>
        </div>
        <div className="profile-hero-actions">
          <Button onClick={() => setEditOpen(true)}><PencilLine /> 更改资料</Button>
          <Button variant="secondary" onClick={() => backgroundInputRef.current?.click()}><ImagePlus /> 更换背景</Button>
          <input ref={backgroundInputRef} hidden type="file" accept="image/*" onChange={handleBackground} />
        </div>
      </section>

      <section className="profile-grid">
        <div className="profile-main-column">
          <Card className="profile-card trust-card">
            <CardHeader>
              <CardTitle><ShieldCheck /> 交易信任等级</CardTitle>
              <Button variant={data.trust.checked_in_today ? 'secondary' : 'default'} onClick={handleCheckIn} disabled={data.trust.checked_in_today}>
                {data.trust.checked_in_today ? '今日已签到' : '签到 +2'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="trust-score-line">
                <strong>{data.trust.score}</strong>
                <span>/ 1000 · {data.trust.grade}</span>
                <em style={{ '--trust': `${trustPercent}%` }} />
              </div>
              <div className="trust-rules">
                {data.trust.rules.map((rule) => (
                  <div key={rule.label} className={rule.points.startsWith('-') ? 'is-minus' : ''}>
                    <strong>{rule.points}</strong>
                    <span>{rule.label}</span>
                    <small>{rule.note}</small>
                  </div>
                ))}
              </div>
              <div className="trust-facts">
                <span><PackageCheck /> 成功交易 {data.trust.completed_orders}</span>
                <span><ThumbsUp /> 好评 {data.trust.positive_reviews}</span>
                <span><BellRing /> 待核实投诉 {data.trust.pending_reports}</span>
                <span><ShieldCheck /> 已核实违规 {data.trust.verified_reports}</span>
              </div>
            </CardContent>
          </Card>

          <div className="profile-list-grid">
            <Card className="profile-card">
              <CardHeader><CardTitle><Heart /> 我的收藏</CardTitle></CardHeader>
              <CardContent>{(data.favorites || []).slice(0, 4).map((item) => <MiniItem key={item.id} item={item} />)}{!data.favorites?.length && <MiniItem emptyText="还没有收藏，遇到好物就点收藏吧。" />}</CardContent>
            </Card>
            <Card className="profile-card">
              <CardHeader><CardTitle><History /> 历史浏览</CardTitle></CardHeader>
              <CardContent>{(data.history || []).slice(0, 4).map((item) => <MiniItem key={`${item.item_type}-${item.item_id}`} item={item} />)}{!data.history?.length && <MiniItem emptyText="浏览商品或任务后会出现在这里。" />}</CardContent>
            </Card>
            <Card className="profile-card">
              <CardHeader><CardTitle><ShoppingBag /> 我发布的</CardTitle></CardHeader>
              <CardContent>{publishedList.slice(0, 5).map((item) => <MiniItem key={`${item.type}-${item.id}`} item={item} />)}{!publishedList.length && <MiniItem emptyText="还没有发布内容，去首页发布第一件好物。" />}</CardContent>
            </Card>
            <Card className="profile-card">
              <CardHeader><CardTitle><Star /> 待评价</CardTitle></CardHeader>
              <CardContent>{(data.pending_reviews || []).slice(0, 4).map((item) => <MiniItem key={item.id} item={{ ...item, price_label: `¥${item.amount}` }} />)}{!data.pending_reviews?.length && <MiniItem emptyText="暂无待评价订单。" />}</CardContent>
            </Card>
          </div>
        </div>

        <aside className="profile-side-column">
          <Card className="profile-card settings-card">
            <CardHeader><CardTitle><UserRoundCog /> 设置</CardTitle></CardHeader>
            <CardContent>
              {SETTING_KEYS.map((key) => {
                const Icon = SETTING_ICONS[key] || UserRoundCog
                return (
                  <button key={key} type="button" onClick={() => chooseSetting(key)}>
                    <Icon />
                    <span>{SETTING_LABELS[key]}</span>
                  </button>
                )
              })}
              <button type="button" className="is-danger" onClick={onLogout}>
                <LogOut /> 退出登录
              </button>
            </CardContent>
          </Card>

          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogContent className="profile-settings-dialog">
              <DialogHeader>
                <DialogTitle>{SETTING_LABELS[activePanel] || '设置'}</DialogTitle>
                <DialogDescription>修改后会同步到数据库，并更新首页展示。</DialogDescription>
              </DialogHeader>
              <div className="settings-dialog-body">
              {activePanel === 'address' && (
                <div className="settings-form">
                  <Input value={addressForm.receiver_name} onChange={(event) => setAddressForm({ ...addressForm, receiver_name: event.target.value })} placeholder="收件人" />
                  <Input value={addressForm.phone} onChange={(event) => setAddressForm({ ...addressForm, phone: event.target.value })} placeholder="手机号，可选" />
                  <Input value={addressForm.detail} onChange={(event) => setAddressForm({ ...addressForm, detail: event.target.value })} placeholder="宿舍楼 / 教学楼 / 取货点" />
                  <Button onClick={saveAddress}>添加地址</Button>
                  {(data.addresses || []).map((address) => (
                    <div key={address.id} className="profile-setting-chip">
                      <strong>{address.label} · {address.receiver_name}</strong>
                      <span>{address.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              {activePanel === 'school' && (
                <div className="settings-form">
                  {SCHOOLS.map((school) => (
                    <button key={school} type="button" className="profile-choice" onClick={() => saveSettingProfile({ school }, `已切换到${school}`)}>
                      <School /> {school} {form.school === school ? <Badge>当前</Badge> : null}
                    </button>
                  ))}
                </div>
              )}
              {activePanel === 'language' && (
                <div className="settings-form">
                  {LANGUAGES.map((language) => (
                    <button key={language.value} type="button" className="profile-choice" onClick={() => saveSettingProfile({ language: language.value }, `语言已切换为 ${language.label}`)}>
                      <Globe2 /> {language.label} {form.language === language.value ? <Badge>当前</Badge> : null}
                    </button>
                  ))}
                </div>
              )}
              {(activePanel === 'payment' || activePanel === 'payout') && (
                <div className="settings-form">
                  <Input value={payForm.channel} onChange={(event) => setPayForm({ ...payForm, channel: event.target.value })} placeholder="微信 / 支付宝 / 校园卡" />
                  <Input value={payForm.display_name} onChange={(event) => setPayForm({ ...payForm, display_name: event.target.value })} placeholder="显示名称" />
                  <Input value={payForm.account_mask} onChange={(event) => setPayForm({ ...payForm, account_mask: event.target.value })} placeholder="账号尾号或备注，不要填写完整敏感信息" />
                  <Button onClick={savePayment}>{activePanel === 'payment' ? '保存支付方式' : '保存收款方式'}</Button>
                  {(data.payment_methods || []).filter((method) => method.method_type === activePanel).map((method) => (
                    <div key={method.id} className="profile-setting-chip">
                      <strong>{method.channel} · {method.display_name}</strong>
                      <span>{method.account_mask || '未填写账号备注'}</span>
                    </div>
                  ))}
                </div>
              )}
              {activePanel === 'security' && (
                <div className="settings-form">
                  <Label>账户名</Label>
                  <Input value={securityForm.username} onChange={(event) => setSecurityForm({ ...securityForm, username: event.target.value })} placeholder="新的用户名" />
                  <Label>当前密码</Label>
                  <Input type="password" value={securityForm.current_password} onChange={(event) => setSecurityForm({ ...securityForm, current_password: event.target.value })} placeholder="修改密码时必填" />
                  <Label>新密码</Label>
                  <Input type="password" value={securityForm.new_password} onChange={(event) => setSecurityForm({ ...securityForm, new_password: event.target.value })} placeholder="至少 6 位，留空则不改密码" />
                  <Button onClick={saveSecurity}>保存账号安全</Button>
                </div>
              )}
              {activePanel === 'profile' && (
                <div className="settings-form">
                  <Button onClick={() => setEditOpen(true)}><PencilLine /> 打开资料编辑窗口</Button>
                  <div className="profile-background-palette">
                    {BACKGROUND_THEMES.map((theme) => (
                      <button key={theme.value} type="button" data-theme={theme.value} onClick={() => saveProfile({ background_theme: theme.value, background_url: '' }, `已切换背景：${theme.label}`)}>
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </DialogContent>
          </Dialog>

          <div className="profile-order-strip">
            <div><strong>{data.sold?.length || 0}</strong><span>我卖出的</span></div>
            <div><strong>{data.bought?.length || 0}</strong><span>我买到的</span></div>
            <div><strong>{data.pending_reviews?.length || 0}</strong><span>待评价</span></div>
          </div>
        </aside>
      </section>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="profile-edit-dialog">
          <DialogHeader>
            <DialogTitle>更改个人资料</DialogTitle>
            <DialogDescription>头像会自动保存，昵称、学校和留言点击保存后同步到数据库。</DialogDescription>
          </DialogHeader>
          <div className="profile-edit-form">
            <div>
              <Label>昵称</Label>
              <Input value={form.nickname || ''} onChange={(event) => updateForm('nickname', event.target.value)} placeholder="设置昵称" />
            </div>
            <div>
              <Label>学校</Label>
              <select value={form.school || ''} onChange={(event) => updateForm('school', event.target.value)}>
                {SCHOOLS.map((school) => <option key={school} value={school}>{school}</option>)}
              </select>
            </div>
            <div>
              <Label>主页背景风格</Label>
              <select value={form.background_theme || 'teal'} onChange={(event) => updateForm('background_theme', event.target.value)}>
                {BACKGROUND_THEMES.map((theme) => <option key={theme.value} value={theme.value}>{theme.label}</option>)}
              </select>
            </div>
            <div className="profile-field-wide">
              <Label>个性化留言</Label>
              <Textarea value={form.signature || ''} onChange={(event) => updateForm('signature', event.target.value)} placeholder="比如：二手教材优先面交，诚信交易。" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={async () => {
              const saved = await saveProfile(form)
              if (saved) setEditOpen(false)
            }} disabled={saving}>{saving ? '保存中...' : '保存资料'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
