import { useEffect, useState } from 'react';
import { ArrowUpRight, LogOut, ShoppingBag, Sparkles } from 'lucide-react';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Ferrofluid from './components/Ferrofluid.jsx';
import './App.css';

const HOME_FLUID_COLORS = ['#ffffff', '#b9a7ff', '#7be7ff'];

function MarketplaceHome({ user, onLogout }) {
  const displayName = user?.username || user?.email || '同学';

  return (
    <main className="ferro-home">
      <Ferrofluid
        className="ferro-home-background"
        colors={HOME_FLUID_COLORS}
        backgroundColor="#05030d"
        speed={0.36}
        scale={1.3}
        turbulence={1.08}
        fluidity={0.13}
        rimWidth={0.22}
        sharpness={2.8}
        shimmer={1.2}
        glow={2.25}
        flowDirection="down"
        mouseStrength={1.15}
        mouseRadius={0.28}
      />
      <div className="ferro-home-shade" />

      <header className="ferro-home-header">
        <div className="ferro-home-brand">
          <span><Sparkles size={18} /></span>
          <span>校园集市</span>
        </div>
        <button className="ferro-home-logout" type="button" onClick={onLogout}>
          <LogOut size={17} />
          退出登录
        </button>
      </header>

      <section className="ferro-home-content">
        <p>欢迎回来，{displayName}</p>
        <h1>今天也去发现校园里的好物吧</h1>
        <div className="ferro-home-actions">
          <button type="button">
            <ShoppingBag size={19} />
            发布闲置
          </button>
          <button type="button" className="secondary">
            浏览商品
            <ArrowUpRight size={18} />
          </button>
        </div>
      </section>

      <p className="ferro-home-caption">让好物在校园里继续流转</p>
    </main>
  );
}

function getCurrentRoute() {
  return window.location.pathname === '/register' ? 'register' : 'login';
}

function App() {
  const [route, setRoute] = useState(getCurrentRoute);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('campus_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handlePopState = () => setRoute(getCurrentRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextRoute) => {
    const path = nextRoute === 'register' ? '/register' : '/';
    window.history.pushState({}, '', path);
    setRoute(nextRoute);
  };

  const handleLogin = (nextUser) => {
    localStorage.setItem('campus_user', JSON.stringify(nextUser || {}));
    setUser(nextUser || {});
    window.history.pushState({}, '', '/');
    setRoute('login');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('campus_user');
    setUser(null);
  };

  if (user) {
    return <MarketplaceHome user={user} onLogout={handleLogout} />;
  }

  if (route === 'register') {
    return <Register onNavigateLogin={() => navigate('login')} />;
  }

  return <Login onLogin={handleLogin} onNavigateRegister={() => navigate('register')} />;
}

export default App;
