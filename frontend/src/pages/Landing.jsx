import {
  ArrowRight,
  Bike,
  BookOpen,
  CheckCircle2,
  Gamepad2,
  HandCoins,
  MapPinned,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react'
import { createElement, forwardRef } from 'react'
import CampusBrand from '../components/CampusBrand.jsx'
import SpotlightCard from '../components/SpotlightCard.jsx'
import BorderGlow from '../components/reactbits/BorderGlow.jsx'
import BlurText from '../components/reactbits/BlurText.jsx'
import CardSwap, { SwapCard } from '../components/reactbits/CardSwap.jsx'
import GlassSurface from '../components/reactbits/GlassSurface.jsx'
import GooeyNav from '../components/reactbits/GooeyNav.jsx'
import ScrollReveal from '../components/reactbits/ScrollReveal.jsx'
import ScrollStack, { ScrollStackItem } from '../components/reactbits/ScrollStack.jsx'
import '../styles/landing.css'

const NAV_ITEMS = [
  { label: '首页', href: '#landing-top' },
  { label: '校园场景', href: '#landing-scenes' },
  { label: '平台能力', href: '#landing-features' },
  { label: '同学反馈', href: '#landing-voices' },
]

const MODULES = [
  {
    eyebrow: 'SECOND HAND',
    title: '闲置好物，不必离开校园',
    text: '教材、数码、宿舍用品和自行车，用学校与距离筛选，当面验货更安心。',
    image: '/marketplace/textbook.png',
    icon: ShoppingBag,
    chips: ['二手教材', '数码设备', '宿舍好物'],
    tone: 'mint',
  },
  {
    eyebrow: 'CAMPUS ERRANDS',
    title: '外卖、快递、文件，顺路就有人接',
    text: '发布起点、终点和期望时间，接单后进入消息与配送进度，校园位置更清楚。',
    image: '/marketplace/campus-sunset.png',
    icon: Bike,
    chips: ['外卖代取', '快递代拿', '校内帮办'],
    tone: 'violet',
  },
  {
    eyebrow: 'GAME & DIGITAL',
    title: '游戏与数码交易，也有完整详情',
    text: '价格、发布者、信任分、评论和私信都在同一页，交易前先把信息看明白。',
    image: '/marketplace/keyboard.png',
    icon: Gamepad2,
    chips: ['游戏账号', '外设装备', '数字服务'],
    tone: 'coral',
  },
  {
    eyebrow: 'COMMUNITY PULSE',
    title: '求购、话题和校园动态自然汇在一起',
    text: '带话题发布、转发原帖、评论回复和收藏，让交易之外的校园信息也能流动。',
    image: '/marketplace/tablet.png',
    icon: MessageCircle,
    chips: ['求购广场', '校园话题', '同学私信'],
    tone: 'yellow',
  },
]

const FEATURES = [
  { icon: MapPinned, title: '校园范围优先', text: '学校、位置和附近任务集中展示，先看到真正与自己有关的信息。' },
  { icon: ShieldCheck, title: '信任记录可追溯', text: '签到、交易完成、好评和核实后的违规共同影响每个人自己的信任分。' },
  { icon: MessageCircle, title: '从帖子直接私信', text: '快捷聊天和完整消息中心共用同一份记录，刷新后内容仍然保留。' },
  { icon: Search, title: '五类内容统一搜索', text: '二手、跑腿、游戏、求购与校园社区可以按类型和话题快速切换。' },
  { icon: Users, title: '真实同学关系', text: '关注、粉丝、附近同学、通知和主页数据都来自当前注册用户。' },
  { icon: HandCoins, title: '交易流程持续生长', text: '购买、接单、订单、评价和支付入口已经形成连贯路径，便于继续扩展。' },
]

const VOICES = [
  { initials: '林', name: '林同学 · 大三', text: '以前毕业季教材都在群里刷屏，现在按学校和分类找，信息清楚多了。', tag: '二手教材' },
  { initials: '周', name: '周同学 · 研一', text: '跑腿任务和私信放在一起，接单后不用再到处加联系方式。', tag: '跑腿代取' },
  { initials: '陈', name: '陈同学 · 大二', text: '我最喜欢主页能看到收藏、历史和关注的人，找回之前看过的东西很快。', tag: '校园社区' },
]

function scrollToItem(item) {
  document.querySelector(item.href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const ShowcaseCard = forwardRef(function ShowcaseCard({ image, label, title, price, icon, children, style, onClick }, ref) {
  return (
    <SwapCard ref={ref} className="landing-swap-card" style={style} onClick={onClick}>
      <div className="landing-swap-card__bar">
        <CampusBrand compact />
        <span>{createElement(icon)} {label}</span>
      </div>
      {image ? <img src={image} alt="" /> : null}
      <div className="landing-swap-card__content">
        <div>
          <small>{label}</small>
          <h3>{title}</h3>
        </div>
        {price ? <strong>{price}</strong> : null}
        {children}
      </div>
    </SwapCard>
  )
})
ShowcaseCard.displayName = 'ShowcaseCard'

export default function Landing({ onNavigateLogin, onNavigateRegister, onEnterMarket, isAuthenticated = false }) {
  const primaryAction = isAuthenticated ? onEnterMarket : onNavigateRegister

  return (
    <main className="campus-landing" id="landing-top">
      <header className="landing-header">
        <GlassSurface className="landing-header__glass" height={66} backgroundOpacity={0.34}>
          <nav className="landing-header__inner" aria-label="站点导航">
            <button type="button" className="landing-brand-button" onClick={() => scrollToItem(NAV_ITEMS[0])}>
              <CampusBrand inverted />
            </button>
            <GooeyNav items={NAV_ITEMS} onItemChange={scrollToItem} />
            <div className="landing-header__actions">
              <button type="button" className="landing-link-button" onClick={isAuthenticated ? onEnterMarket : onNavigateLogin}>
                {isAuthenticated ? '进入集市' : '登录'}
              </button>
              <button type="button" className="landing-solid-button" onClick={primaryAction}>
                {isAuthenticated ? '继续逛逛' : '加入校园'} <ArrowRight />
              </button>
            </div>
          </nav>
        </GlassSurface>
      </header>

      <section className="landing-hero">
        <img className="landing-hero__image" src="/marketplace/campus-sunset.png" alt="傍晚校园操场与教学楼" />
        <div className="landing-hero__shade" />
        <div className="landing-hero__content">
          <div className="landing-hero__copy">
            <p className="landing-kicker"><Sparkles /> 南通理工学院 · 校园生活流转站</p>
            <BlurText as="h1" text="Campus Pulse 校园集市" delay={55} className="landing-hero__title" />
            <p className="landing-hero__lead">二手交易、跑腿代取、游戏交易、求购与校园话题，在同一个可信校园社区里自然发生。</p>
            <div className="landing-hero__actions">
              <button type="button" className="landing-primary-cta" onClick={primaryAction}>
                {isAuthenticated ? '进入我的校园集市' : '创建校园账号'} <ArrowRight />
              </button>
              <button type="button" className="landing-secondary-cta" onClick={() => scrollToItem(NAV_ITEMS[1])}>
                先看看能做什么
              </button>
            </div>
            <div className="landing-proof">
              <span><CheckCircle2 /> 校园身份场景</span>
              <span><CheckCircle2 /> 真实用户数据</span>
              <span><CheckCircle2 /> 持久化消息</span>
            </div>
          </div>

          <div className="landing-hero__showcase" aria-label="平台功能预览">
            <CardSwap width={520} height={356} cardDistance={26} verticalDistance={24} delay={3900} skewAmount={1.5} onCardClick={primaryAction}>
              <ShowcaseCard image="/marketplace/textbook.png" label="二手市场" title="西方经济学教材" price="¥18" icon={BookOpen} />
              <ShowcaseCard image="/marketplace/campus-sunset.png" label="跑腿代取" title="东门外卖送到宿舍" price="¥6" icon={Bike} />
              <ShowcaseCard image="/marketplace/keyboard.png" label="游戏与数码" title="机械键盘 · 校内面交" price="¥129" icon={Gamepad2} />
            </CardSwap>
          </div>
        </div>

        <GlassSurface className="landing-hero__metrics" width="min(1020px, calc(100% - 40px))" height="auto" backgroundOpacity={0.24}>
          <div className="landing-metric-grid">
            <div><strong>5</strong><span>类校园需求统一入口</span></div>
            <div><strong>1</strong><span>套关注、通知与私信关系</span></div>
            <div><strong>800</strong><span>每位同学的初始信任分</span></div>
          </div>
        </GlassSurface>
      </section>

      <section className="landing-intro">
        <p className="landing-section-label">不只是一个二手平台</p>
        <ScrollReveal className="landing-intro__statement">
          让闲置继续有用，让顺路变成互助，让每一次校园需求都能更快找到回应。
        </ScrollReveal>
      </section>

      <section className="landing-modules" id="landing-scenes">
        <header className="landing-section-heading">
          <div>
            <p className="landing-section-label">CAMPUS SCENES</p>
            <h2>从一件教材，到一整个校园生活圈</h2>
          </div>
          <p>内容类型不同，详情、评论、收藏、分享与私信体验保持一致。</p>
        </header>
        <ScrollStack>
          {MODULES.map((module, index) => {
            const Icon = module.icon
            return (
              <ScrollStackItem className={`landing-module-panel is-${module.tone}`} key={module.title}>
                <div className="landing-module-panel__copy">
                  <span className="landing-module-index">0{index + 1}</span>
                  <p>{module.eyebrow}</p>
                  <h3>{module.title}</h3>
                  <div className="landing-module-panel__text">{module.text}</div>
                  <div className="landing-module-panel__chips">{module.chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
                  <Icon className="landing-module-panel__icon" aria-hidden="true" />
                </div>
                <div className="landing-module-panel__media">
                  <img src={module.image} alt={module.title} />
                </div>
              </ScrollStackItem>
            )
          })}
        </ScrollStack>
      </section>

      <section className="landing-features" id="landing-features">
        <header className="landing-section-heading is-centered">
          <div>
            <p className="landing-section-label">BUILT FOR CAMPUS</p>
            <h2>漂亮的交互，也要服务真实交易</h2>
          </div>
          <p>动效只出现在需要反馈和引导的位置，信息阅读仍然保持干净、快速。</p>
        </header>
        <div className="landing-feature-grid">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon
            const content = (
              <div className="landing-feature-card">
                <span><Icon /></span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            )
            return index < 3 ? (
              <BorderGlow className="landing-feature-border" animated={index === 0} key={feature.title}>{content}</BorderGlow>
            ) : (
              <SpotlightCard className="landing-feature-spotlight" spotlightColor={index === 3 ? 'rgba(91,74,232,.18)' : 'rgba(15,159,131,.18)'} key={feature.title}>{content}</SpotlightCard>
            )
          })}
        </div>
      </section>

      <section className="landing-voices" id="landing-voices">
        <header className="landing-section-heading">
          <div>
            <p className="landing-section-label">STUDENT VOICES</p>
            <h2>同学需要的，是少绕一步</h2>
          </div>
          <p>下面是围绕典型校园场景编写的体验反馈样例，用来展示社区口碑模块。</p>
        </header>
        <div className="landing-voice-grid">
          {VOICES.map((voice, index) => (
            <SpotlightCard className="landing-voice-card" spotlightColor={index === 1 ? 'rgba(255,139,92,.2)' : 'rgba(15,159,131,.18)'} key={voice.name}>
              <div className="landing-voice-card__quote">“</div>
              <p>{voice.text}</p>
              <footer>
                <span className="landing-voice-avatar">{voice.initials}</span>
                <span><strong>{voice.name}</strong><small>{voice.tag}</small></span>
              </footer>
            </SpotlightCard>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <GlassSurface className="landing-final-cta__glass" backgroundOpacity={0.48}>
          <div className="landing-final-cta__content">
            <div>
              <p className="landing-section-label">READY WHEN YOU ARE</p>
              <h2>{isAuthenticated ? '你的校园集市还在继续' : '从完善一张校园名片开始'}</h2>
              <p>{isAuthenticated ? '返回信息流，继续查看附近好物、任务和同学动态。' : '注册后用几步设置头像、学校、背景和个性签名，让同学先认识真实的你。'}</p>
            </div>
            <button type="button" onClick={primaryAction}>{isAuthenticated ? '返回校园集市' : '免费加入'} <ArrowRight /></button>
          </div>
        </GlassSurface>
      </section>

      <footer className="landing-footer">
        <CampusBrand />
        <p>让校园里的物品、时间和善意继续流转。</p>
        <div><button type="button" onClick={onNavigateLogin}>登录</button><button type="button" onClick={onNavigateRegister}>注册</button></div>
      </footer>
    </main>
  )
}
