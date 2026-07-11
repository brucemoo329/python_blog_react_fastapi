import { Camera, CheckCircle2, ImagePlus, MapPin, Sparkles, UserRound } from 'lucide-react'
import { useState } from 'react'
import { updateUserProfile } from '../api/marketplace.js'
import CampusBrand from '../components/CampusBrand.jsx'
import BlurText from '../components/reactbits/BlurText.jsx'
import GlassSurface from '../components/reactbits/GlassSurface.jsx'
import Stepper, { Step } from '../components/reactbits/Stepper.jsx'
import '../styles/onboarding.css'

const SCHOOLS = ['北京大学', '清华大学', '复旦大学', '上海交通大学', '浙江大学', '南京大学', '武汉大学', '中山大学', '南通理工学院']
const THEMES = [
  { id: 'teal', label: '薄荷校园' },
  { id: 'violet', label: '晚霞紫' },
  { id: 'sunset', label: '晨光橙' },
  { id: 'forest', label: '深海青' },
]

function compressImage(file, maxSize = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('图片格式无法识别'))
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function ProfileOnboarding({ user, onComplete, onSkip }) {
  const initialProfile = user?.profile || {}
  const [form, setForm] = useState({
    nickname: initialProfile.nickname || user?.username || '',
    avatar_url: initialProfile.avatar_url || '',
    school: initialProfile.school || '',
    signature: initialProfile.signature || '',
    background_url: initialProfile.background_url || '',
    background_theme: initialProfile.background_theme || 'teal',
  })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const handleImage = async (event, field, maxSize) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage('请选择图片文件')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage('图片不能超过 10MB')
      return
    }
    try {
      setMessage('正在处理图片…')
      const dataUrl = await compressImage(file, maxSize, field === 'avatar_url' ? 0.82 : 0.76)
      update(field, dataUrl)
      setMessage('')
    } catch (error) {
      setMessage(error.message || '图片处理失败')
    } finally {
      event.target.value = ''
    }
  }

  const validateStep = (step) => {
    setMessage('')
    if (step === 1 && !form.nickname.trim()) {
      setMessage('请先设置一个昵称')
      return false
    }
    if (step === 2 && !form.school.trim()) {
      setMessage('请选择学校')
      return false
    }
    if (form.signature.length > 180) {
      setMessage('个性签名不能超过 180 个字')
      return false
    }
    return true
  }

  const saveProfile = async () => {
    if (!validateStep(4)) return
    setBusy(true)
    setMessage('')
    try {
      const response = await updateUserProfile({
        ...form,
        nickname: form.nickname.trim(),
        school: form.school.trim(),
        signature: form.signature.trim(),
      })
      onComplete?.({ ...user, profile: { ...initialProfile, ...response.profile } })
    } catch (error) {
      setMessage(error.response?.data?.detail || '资料保存失败，请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  const previewStyle = form.background_url
    ? { backgroundImage: `url(${form.background_url})` }
    : undefined

  return (
    <main className="profile-onboarding">
      <img src="/marketplace/campus-sunset.png" alt="" className="profile-onboarding__background" />
      <div className="profile-onboarding__wash" />
      <header className="profile-onboarding__header">
        <CampusBrand inverted />
        <button type="button" onClick={() => onSkip?.(user)}>稍后设置</button>
      </header>

      <section className="profile-onboarding__layout">
        <div className="profile-onboarding__intro">
          <p><Sparkles /> 注册成功</p>
          <BlurText as="h1" text="让同学先认识真实的你" delay={65} />
          <div>用几步完成校园名片。头像、学校与个性签名会同步到主页、帖子、评论和私信。</div>
          <GlassSurface className="profile-onboarding__tip" backgroundOpacity={0.28} distortionScale={-62}>
            <span><CheckCircle2 /> 所有资料之后仍可在个人主页修改</span>
          </GlassSurface>
        </div>

        <Stepper
          onBeforeStepChange={validateStep}
          onFinalStepCompleted={saveProfile}
          busy={busy}
          disableStepIndicators
        >
          <Step>
            <div className="onboarding-step-heading">
              <span><UserRound /></span>
              <div><small>01 · 个人形象</small><h2>先选一张喜欢的头像</h2><p>头像会出现在帖子、评论、个人主页与私信里。</p></div>
            </div>
            <div className="onboarding-avatar-row">
              <label className="onboarding-avatar-picker">
                {form.avatar_url ? <img src={form.avatar_url} alt="头像预览" /> : <span>{(form.nickname || user?.username || '校').slice(0, 1)}</span>}
                <em><Camera /> 更换头像</em>
                <input type="file" accept="image/*" onChange={(event) => handleImage(event, 'avatar_url', 720)} />
              </label>
              <label className="onboarding-field">
                <span>昵称</span>
                <input value={form.nickname} maxLength={40} onChange={(event) => update('nickname', event.target.value)} placeholder="同学会怎样称呼你" />
                <small>{form.nickname.length}/40</small>
              </label>
            </div>
          </Step>

          <Step>
            <div className="onboarding-step-heading">
              <span><MapPin /></span>
              <div><small>02 · 校园身份</small><h2>告诉大家你在哪个校园</h2><p>学校会影响主页位置、附近内容和任务推荐。</p></div>
            </div>
            <div className="onboarding-fields">
              <label className="onboarding-field">
                <span>学校</span>
                <input list="onboarding-school-options" value={form.school} onChange={(event) => update('school', event.target.value)} placeholder="输入你的学校全称" />
                <datalist id="onboarding-school-options">{SCHOOLS.map((school) => <option key={school} value={school} />)}</datalist>
              </label>
              <label className="onboarding-field">
                <span>个性签名</span>
                <textarea value={form.signature} maxLength={180} onChange={(event) => update('signature', event.target.value)} placeholder="例如：喜欢数码，也愿意顺路帮同学带外卖。" />
                <small>{form.signature.length}/180</small>
              </label>
            </div>
          </Step>

          <Step>
            <div className="onboarding-step-heading">
              <span><ImagePlus /></span>
              <div><small>03 · 主页背景</small><h2>给主页留一点自己的颜色</h2><p>可以选择主题，也可以上传一张校园或生活照片。</p></div>
            </div>
            <div className="onboarding-theme-grid">
              {THEMES.map((theme) => (
                <button key={theme.id} type="button" className={`is-${theme.id} ${form.background_theme === theme.id && !form.background_url ? 'is-selected' : ''}`} onClick={() => setForm((current) => ({ ...current, background_theme: theme.id, background_url: '' }))}>
                  <span />{theme.label}{form.background_theme === theme.id && !form.background_url ? <CheckCircle2 /> : null}
                </button>
              ))}
            </div>
            <label className="onboarding-background-upload">
              <ImagePlus />
              <span><strong>上传自定义背景</strong><small>推荐横图，系统会自动压缩</small></span>
              <input type="file" accept="image/*" onChange={(event) => handleImage(event, 'background_url', 1600)} />
            </label>
          </Step>

          <Step>
            <div className="onboarding-step-heading is-final">
              <span><CheckCircle2 /></span>
              <div><small>04 · 完成</small><h2>你的校园名片准备好了</h2><p>确认后资料会保存到数据库，并同步到平台所有头像位置。</p></div>
            </div>
            <article className={`onboarding-profile-preview is-${form.background_theme}`} style={previewStyle}>
              <div className="onboarding-profile-preview__shade" />
              <div className="onboarding-profile-preview__profile">
                <span>{form.avatar_url ? <img src={form.avatar_url} alt="" /> : (form.nickname || '校').slice(0, 1)}</span>
                <div><h3>{form.nickname || user?.username}</h3><p><MapPin /> {form.school}</p></div>
              </div>
              <p>{form.signature || '还没有个性签名，去校园里发现一点新鲜事吧。'}</p>
            </article>
          </Step>
        </Stepper>
      </section>

      {message ? <div className="profile-onboarding__message" role="status">{message}</div> : null}
    </main>
  )
}
