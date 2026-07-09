import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MarketplaceHome from './pages/MarketplaceHome.jsx';

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

  const handleUserUpdate = (nextUser) => {
    localStorage.setItem('campus_user', JSON.stringify(nextUser || {}));
    setUser(nextUser || {});
  };

  if (user) {
    return <MarketplaceHome user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
  }

  if (route === 'register') {
    return <Register onNavigateLogin={() => navigate('login')} />;
  }

  return <Login onLogin={handleLogin} onNavigateRegister={() => navigate('register')} />;
}

export default App;
