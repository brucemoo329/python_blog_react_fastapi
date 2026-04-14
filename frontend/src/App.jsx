<<<<<<< HEAD
import { useState } from 'react';
import axios from 'axios';
import './App.css'; // 建议把下面的 CSS 放到这个文件里

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });
    
    try {
      const url = isLogin ? 'http://127.0.0.1:8000/login' : 'http://127.0.0.1:8000/register';
      const res = await axios.post(url, formData);
      setMsg({ type: 'success', text: isLogin ? `欢迎回来, ${res.data.username}!` : "账号创建成功！" });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || "连接网关失败" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="login-card">
        <div className="card-left">
          <div className="logo">Movora<span>X</span></div>
          <h2>{isLogin ? "验证身份" : "开启交易"}</h2>
          <p>{isLogin ? "进入全球顶级资产交易中心" : "加入 10,000+ 专业交易员的行列"}</p>
        </div>

        <div className="card-right">
          <form onSubmit={handleAction}>
            <div className="input-group">
              <label>用户名</label>
              <input 
                type="text" 
                required
                onChange={e => setFormData({...formData, username: e.target.value})} 
                placeholder="输入账户名"
              />
            </div>

            {!isLogin && (
              <div className="input-group">
                <label>电子邮箱</label>
                <input 
                  type="email" 
                  required
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  placeholder="name@example.com"
                />
              </div>
            )}

            <div className="input-group">
              <label>访问密钥</label>
              <input 
                type="password" 
                required
                onChange={e => setFormData({...formData, password: e.target.value})} 
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className={loading ? 'loading' : ''} disabled={loading}>
              {loading ? "处理中..." : (isLogin ? "安全登录" : "注册账户")}
            </button>
          </form>

          <div className="footer-links">
            <span onClick={() => {setIsLogin(!isLogin); setMsg({type:'', text:''})}}>
              {isLogin ? "还没有账号? 立即加入" : "已有权限? 返回登录"}
            </span>
          </div>

          {msg.text && (
            <div className={`status-msg ${msg.type}`}>
              {msg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
=======
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
>>>>>>> f1ff395 (后端更新“)
