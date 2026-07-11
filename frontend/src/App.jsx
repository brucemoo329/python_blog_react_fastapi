import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import LoginCharacterTransition from './components/LoginCharacterTransition.jsx'
import { readStoredLanguage } from './lib/i18n'

const Landing = lazy(() => import('./pages/Landing.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const MarketplaceHome = lazy(() => import('./pages/MarketplaceHome.jsx'))

const ROUTE_PATHS = {
  landing: '/',
  login: '/login',
  register: '/register',
  app: '/app',
}

function getCurrentRoute() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/login') return 'login'
  if (path === '/register') return 'register'
  if (path === '/app' || path === '/marketplace') return 'app'
  return 'landing'
}

function readSavedUser() {
  try {
    const saved = localStorage.getItem('campus_user')
    return saved ? JSON.parse(saved) : null
  } catch {
    localStorage.removeItem('campus_user')
    return null
  }
}

function AppFallback() {
  return (
    <div className="app-route-loading" role="status">
      <span />
      <strong>校园集市</strong>
      <small>正在准备校园内容…</small>
    </div>
  )
}

function App() {
  const [route, setRoute] = useState(getCurrentRoute)
  const [user, setUser] = useState(readSavedUser)
  const [publicLanguage, setPublicLanguage] = useState(readStoredLanguage)
  const [showLoginTransition, setShowLoginTransition] = useState(false)
  const transitionTimersRef = useRef(new Set())

  useEffect(() => {
    const handlePopState = () => setRoute(getCurrentRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => () => {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    transitionTimersRef.current.clear()
  }, [])

  const navigate = (nextRoute, { replace = false } = {}) => {
    const path = ROUTE_PATHS[nextRoute] || '/'
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const handleLogin = (nextUser) => {
    const safeUser = nextUser || {}
    localStorage.setItem('campus_user', JSON.stringify(safeUser))
    setUser(safeUser)
    navigate('app', { replace: true })
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('campus_user')
    sessionStorage.removeItem('campus_pending_profile')
    setUser(null)
    navigate('landing', { replace: true })
  }

  const handleUserUpdate = (nextUser) => {
    localStorage.setItem('campus_user', JSON.stringify(nextUser || {}))
    setUser(nextUser || {})
  }

  const openLogin = () => {
    if (user) {
      navigate('app')
      return
    }
    if (showLoginTransition) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate('login')
      return
    }

    setShowLoginTransition(true)
    const schedule = (callback, delay) => {
      const timer = window.setTimeout(() => {
        transitionTimersRef.current.delete(timer)
        callback()
      }, delay)
      transitionTimersRef.current.add(timer)
    }
    schedule(() => navigate('login'), 630)
    schedule(() => setShowLoginTransition(false), 1480)
  }

  let content
  if (route === 'landing') {
    content = (
      <Landing
        isAuthenticated={Boolean(user)}
        language={publicLanguage}
        onLanguageChange={setPublicLanguage}
        onNavigateLogin={openLogin}
        onNavigateRegister={() => navigate(user ? 'app' : 'register')}
        onEnterMarket={() => navigate(user ? 'app' : 'login')}
      />
    )
  } else if (route === 'app') {
    content = user
      ? <MarketplaceHome user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      : <Login onLogin={handleLogin} onNavigateRegister={() => navigate('register')} onNavigateHome={() => navigate('landing')} />
  } else if (route === 'register' && !user) {
    content = <Register onNavigateLogin={() => navigate('login')} onNavigateHome={() => navigate('landing')} onLogin={handleLogin} />
  } else if (route === 'login' && !user) {
    content = <Login onLogin={handleLogin} onNavigateRegister={() => navigate('register')} onNavigateHome={() => navigate('landing')} />
  } else {
    content = <MarketplaceHome user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
  }

  return (
    <>
      <Suspense fallback={<AppFallback />}>{content}</Suspense>
      {showLoginTransition ? <LoginCharacterTransition /> : null}
    </>
  )
}

export default App
