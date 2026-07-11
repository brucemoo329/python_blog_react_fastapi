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
import LandingHeader from '../components/LandingHeader.jsx'
import SpotlightCard from '../components/SpotlightCard.jsx'
import BorderGlow from '../components/reactbits/BorderGlow.jsx'
import BlurText from '../components/reactbits/BlurText.jsx'
import CardSwap, { SwapCard } from '../components/reactbits/CardSwap.jsx'
import GlassSurface from '../components/reactbits/GlassSurface.jsx'
import ScrollReveal from '../components/reactbits/ScrollReveal.jsx'
import ScrollStack, { ScrollStackItem } from '../components/reactbits/ScrollStack.jsx'
import { normalizeLang } from '../lib/i18n'
import '../styles/landing.css'

const NAV_ITEMS = [
  { label: '首页', href: '#landing-top' },
  { label: '校园场景', href: '#landing-scenes' },
  { label: '平台能力', href: '#landing-features' },
  { label: '同学反馈', href: '#landing-voices' },
]

const LANDING_COPY = {
  'zh-CN': {
    nav: ['首页', '校园场景', '平台能力', '同学反馈'], login: '登录', join: '加入校园', market: '进入集市', continue: '继续逛逛',
    kicker: '全国高校 · 校园生活流转站', title: 'Campus Pulse 校园集市', lead: '二手交易、跑腿代取、游戏交易、求购与校园话题，在同一个可信校园社区里自然发生；内容会优先按你填写的学校归类展示。',
    primary: '创建校园账号', explore: '先看看能做什么', proof: ['校园身份场景', '真实用户数据', '持久化消息'],
    showcase: [['二手市场', '西方经济学教材', '¥18'], ['跑腿代取', '东门外卖送到宿舍', '¥6'], ['游戏与数码', '机械键盘 · 校内面交', '¥129']],
    metrics: ['类校园需求统一入口', '套关注、通知与私信关系', '每位同学的初始信任分'],
    introLabel: '不只是一个二手平台', intro: '让闲置继续有用，让顺路变成互助，让每一次校园需求都能更快找到回应。',
    scenesLabel: 'CAMPUS SCENES', scenes: '从一件教材，到一整个校园生活圈', scenesLead: '内容类型不同，详情、评论、收藏、分享与私信体验保持一致。',
    featuresLabel: 'BUILT FOR CAMPUS', features: '漂亮的交互，也要服务真实交易', featuresLead: '动效只出现在需要反馈和引导的位置，信息阅读仍然保持干净、快速。',
    voices: '同学需要的，是少绕一步', voicesLead: '下面是围绕典型校园场景编写的体验反馈样例，用来展示社区口碑模块。',
    finalTitle: '从完善一张校园名片开始', finalLead: '注册后用几步设置头像、学校、背景和个性签名，让同学先认识真实的你。', finalAction: '免费加入', footer: '让校园里的物品、时间和善意继续流转。', register: '注册',
  },
  'en-US': {
    nav: ['Home', 'Campus scenes', 'Platform', 'Student voices'], login: 'Log in', join: 'Join campus', market: 'Open market', continue: 'Keep exploring',
    kicker: 'Universities nationwide · Campus exchange', title: 'Campus Pulse Marketplace', lead: 'Second-hand finds, errands, game trades, requests, and campus topics all meet in one trusted student community, organized around each student’s school.',
    primary: 'Create an account', explore: 'See what is here', proof: ['Campus-first context', 'Real member data', 'Saved messages'],
    showcase: [['Second hand', 'Economics textbook', '¥18'], ['Campus errand', 'Takeout to dorm', '¥6'], ['Games & digital', 'Mechanical keyboard', '¥129']],
    metrics: ['campus needs in one place', 'social, notifications and messages', 'starting trust score for everyone'],
    introLabel: 'More than second hand', intro: 'Keep useful things in motion, turn a spare trip into help, and make every campus need easier to answer.',
    scenesLabel: 'CAMPUS SCENES', scenes: 'From one textbook to a whole campus life', scenesLead: 'Different content types share one clear experience for details, comments, saves, sharing, and messages.',
    featuresLabel: 'BUILT FOR CAMPUS', features: 'Polished interaction, grounded in real trade', featuresLead: 'Motion appears only where it gives feedback or direction. Reading stays clean and fast.',
    voices: 'Students need fewer detours', voicesLead: 'Sample feedback based on everyday campus scenarios shows how the community can feel.',
    finalTitle: 'Start with your campus card', finalLead: 'Set your avatar, school, background, and signature in a few steps so classmates can meet the real you.', finalAction: 'Join for free', footer: 'Keep objects, time, and goodwill moving around campus.', register: 'Sign up',
  },
  'ja-JP': {
    nav: ['ホーム', 'キャンパス', '機能', '学生の声'], login: 'ログイン', join: '参加する', market: 'マーケットへ', continue: '続けて見る',
    kicker: '全国の大学 · 学生のための交換コミュニティ', title: 'Campus Pulse キャンパス市場', lead: '中古品、代行、ゲーム取引、募集、キャンパストピックを、学校ごとに信頼できる学生コミュニティでつなぎます。',
    primary: 'アカウントを作成', explore: 'できることを見る', proof: ['キャンパス優先', '実在ユーザーデータ', '保存されるメッセージ'],
    showcase: [['中古市場', '経済学の教科書', '¥18'], ['代行サービス', '寮までフード配達', '¥6'], ['ゲーム・デジタル', 'メカニカルキーボード', '¥129']],
    metrics: ['種類のニーズを一か所に', 'つながり・通知・メッセージ', '全員の初期信頼スコア'],
    introLabel: '中古市場だけではない', intro: '使える物をつなぎ、ついでの移動を助け合いにし、キャンパスの要望にすばやく応えます。',
    scenesLabel: 'CAMPUS SCENES', scenes: '一冊の教科書からキャンパスライフ全体へ', scenesLead: '詳細、コメント、保存、共有、メッセージを一貫した体験で提供します。',
    featuresLabel: 'BUILT FOR CAMPUS', features: 'きれいな操作感を、実際の取引のために', featuresLead: '動きは必要なフィードバックだけに使い、読む体験は軽快に保ちます。',
    voices: '学生に必要なのは、少ない遠回り', voicesLead: '日常のキャンパス場面を基にしたサンプルの声です。',
    finalTitle: '自分のキャンパスカードから始めよう', finalLead: 'アバター、学校、背景、自己紹介を設定して、仲間にあなたを知ってもらいましょう。', finalAction: '無料で参加', footer: '物、時間、優しさをキャンパスで循環させよう。', register: '新規登録',
  },
  'ko-KR': {
    nav: ['홈', '캠퍼스', '기능', '학생 후기'], login: '로그인', join: '캠퍼스 참여', market: '마켓 열기', continue: '계속 보기',
    kicker: '전국 대학 · 캠퍼스 생활 교류', title: 'Campus Pulse 캠퍼스 마켓', lead: '중고 거래, 심부름, 게임 거래, 구매 요청과 캠퍼스 이야기를 각 학교의 신뢰할 수 있는 학생 커뮤니티에서 연결합니다.',
    primary: '계정 만들기', explore: '무엇을 할 수 있나요', proof: ['캠퍼스 중심', '실제 사용자 데이터', '저장되는 메시지'],
    showcase: [['중고 마켓', '경제학 교재', '¥18'], ['심부름', '기숙사 배달', '¥6'], ['게임·디지털', '기계식 키보드', '¥129']],
    metrics: ['가지 캠퍼스 수요', '관계·알림·메시지', '모두의 초기 신뢰 점수'],
    introLabel: '중고 거래 그 이상', intro: '쓸모 있는 물건을 계속 돌리고, 가는 길을 도움으로 만들고, 캠퍼스의 모든 필요에 더 빨리 답합니다.',
    scenesLabel: 'CAMPUS SCENES', scenes: '교재 한 권에서 캠퍼스 생활 전체까지', scenesLead: '상세, 댓글, 저장, 공유, 메시지를 일관된 경험으로 제공합니다.',
    featuresLabel: 'BUILT FOR CAMPUS', features: '멋진 인터랙션도 실제 거래를 위해', featuresLead: '움직임은 필요한 피드백에만 쓰고 정보는 깨끗하고 빠르게 읽힙니다.',
    voices: '학생에게 필요한 건 덜 돌아가는 것', voicesLead: '일상적인 캠퍼스 장면을 바탕으로 한 후기 예시입니다.',
    finalTitle: '나만의 캠퍼스 카드부터 시작하세요', finalLead: '아바타, 학교, 배경과 소개를 설정해 동료들이 진짜 나를 알 수 있게 하세요.', finalAction: '무료 참여', footer: '물건, 시간, 친절이 캠퍼스 안에서 계속 흐르게 합니다.', register: '회원가입',
  },
  'fil-PH': {
    nav: ['Home', 'Campus', 'Features', 'Students'], login: 'Mag-login', join: 'Sumali', market: 'Buksan ang market', continue: 'Magpatuloy',
    kicker: 'Mga unibersidad sa buong bansa · Campus exchange', title: 'Campus Pulse Marketplace', lead: 'Second-hand items, errands, game trades, requests, at campus topics sa student community ng bawat paaralan.',
    primary: 'Gumawa ng account', explore: 'Tingnan ang features', proof: ['Campus-first', 'Tunay na user data', 'Naka-save na mensahe'],
    showcase: [['Second hand', 'Economics textbook', '¥18'], ['Campus errand', 'Takeout sa dorm', '¥6'], ['Games at digital', 'Mechanical keyboard', '¥129']],
    metrics: ['uri ng campus needs', 'social, notifications at messages', 'panimulang trust score'],
    introLabel: 'Higit sa second hand', intro: 'Panatilihing gumagalaw ang useful na bagay, gawing tulong ang isang spare trip, at sagutin ang needs ng campus nang mas mabilis.',
    scenesLabel: 'CAMPUS SCENES', scenes: 'Mula sa isang textbook hanggang campus life', scenesLead: 'Iisang malinaw na experience para sa detalye, comments, saves, sharing at messages.',
    featuresLabel: 'BUILT FOR CAMPUS', features: 'Magandang interaction para sa tunay na trade', featuresLead: 'Ginagamit ang motion sa kailangan lang na feedback; malinis at mabilis ang pagbabasa.',
    voices: 'Mas kaunting detour ang kailangan ng students', voicesLead: 'Sample na feedback mula sa araw-araw na campus scenarios.',
    finalTitle: 'Magsimula sa campus card mo', finalLead: 'I-set ang avatar, school, background at signature para makilala ka ng classmates.', finalAction: 'Sumali nang libre', footer: 'Panatilihing umiikot ang gamit, oras at kabaitan sa campus.', register: 'Mag-register',
  },
}

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

export default function Landing({ onNavigateLogin, onNavigateRegister, onEnterMarket, isAuthenticated = false, language = 'zh-CN', onLanguageChange }) {
  const copy = LANDING_COPY[normalizeLang(language)] || LANDING_COPY['zh-CN']
  const navItems = NAV_ITEMS.map((item, index) => ({ ...item, label: copy.nav[index] }))
  const primaryAction = isAuthenticated ? onEnterMarket : onNavigateRegister

  return (
    <main className="campus-landing" id="landing-top">
      <LandingHeader
        navItems={navItems}
        copy={copy}
        language={language}
        onLanguageChange={onLanguageChange}
        isAuthenticated={isAuthenticated}
        onNavigateLogin={onNavigateLogin}
        onEnterMarket={onEnterMarket}
        onPrimaryAction={primaryAction}
        onScrollToItem={scrollToItem}
      />

      <section className="landing-hero">
        <img className="landing-hero__image" src="/marketplace/campus-sunset.png" alt="傍晚校园操场与教学楼" />
        <div className="landing-hero__shade" />
        <div className="landing-hero__content">
          <div className="landing-hero__copy">
            <p className="landing-kicker"><Sparkles /> {copy.kicker}</p>
            <BlurText as="h1" text={copy.title} delay={55} className="landing-hero__title" />
            <p className="landing-hero__lead">{copy.lead}</p>
            <div className="landing-hero__actions">
              <button type="button" className="landing-primary-cta" onClick={primaryAction}>
                {isAuthenticated ? copy.market : copy.primary} <ArrowRight />
              </button>
              <button type="button" className="landing-secondary-cta" onClick={() => scrollToItem(NAV_ITEMS[1])}>
                {copy.explore}
              </button>
            </div>
            <div className="landing-proof">
              {copy.proof.map((item) => <span key={item}><CheckCircle2 /> {item}</span>)}
            </div>
          </div>

          <div className="landing-hero__showcase" aria-label="平台功能预览">
            <CardSwap width={520} height={356} cardDistance={26} verticalDistance={24} delay={3900} skewAmount={1.5} onCardClick={primaryAction}>
              <ShowcaseCard image="/marketplace/textbook.png" label={copy.showcase[0][0]} title={copy.showcase[0][1]} price={copy.showcase[0][2]} icon={BookOpen} />
              <ShowcaseCard image="/marketplace/campus-sunset.png" label={copy.showcase[1][0]} title={copy.showcase[1][1]} price={copy.showcase[1][2]} icon={Bike} />
              <ShowcaseCard image="/marketplace/keyboard.png" label={copy.showcase[2][0]} title={copy.showcase[2][1]} price={copy.showcase[2][2]} icon={Gamepad2} />
            </CardSwap>
          </div>
        </div>

        <GlassSurface className="landing-hero__metrics" width="min(1020px, calc(100% - 40px))" height="auto" backgroundOpacity={0.24}>
          <div className="landing-metric-grid">
            <div><strong>5</strong><span>{copy.metrics[0]}</span></div>
            <div><strong>1</strong><span>{copy.metrics[1]}</span></div>
            <div><strong>800</strong><span>{copy.metrics[2]}</span></div>
          </div>
        </GlassSurface>
      </section>

      <section className="landing-intro">
        <p className="landing-section-label">{copy.introLabel}</p>
        <ScrollReveal className="landing-intro__statement">
          {copy.intro}
        </ScrollReveal>
      </section>

      <section className="landing-modules" id="landing-scenes">
        <header className="landing-section-heading">
          <div>
            <p className="landing-section-label">{copy.scenesLabel}</p>
            <h2>{copy.scenes}</h2>
          </div>
          <p>{copy.scenesLead}</p>
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
            <p className="landing-section-label">{copy.featuresLabel}</p>
            <h2>{copy.features}</h2>
          </div>
          <p>{copy.featuresLead}</p>
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
            <h2>{copy.voices}</h2>
          </div>
          <p>{copy.voicesLead}</p>
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
              <h2>{isAuthenticated ? copy.continue : copy.finalTitle}</h2>
              <p>{isAuthenticated ? copy.explore : copy.finalLead}</p>
            </div>
            <button type="button" onClick={primaryAction}>{isAuthenticated ? copy.market : copy.finalAction} <ArrowRight /></button>
          </div>
        </GlassSurface>
      </section>

      <footer className="landing-footer">
        <CampusBrand />
        <p>{copy.footer}</p>
        <div><button type="button" onClick={onNavigateLogin}>{copy.login}</button><button type="button" onClick={onNavigateRegister}>{copy.register}</button></div>
      </footer>
    </main>
  )
}
