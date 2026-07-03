import { useRef, useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import AnimatedAuthShowcase, { CharacterAuthBrand } from '../components/AnimatedAuthShowcase.jsx';
import { login } from '../api/auth.js';
import '../styles/animated-login.css';

function getErrorMessage(error) {
  if (error.code === 'ECONNABORTED') return '服务器连接超时，请检查后端是否启动';
  if (!error.response) return '服务器连接失败，请确认 FastAPI 后端正在运行';
  if (error.response.status === 404) return '登录接口不存在，请检查后端路由 /login';
  if (error.response.status === 422) return '请求格式错误，请检查账号和密码字段';
  if (error.response.status >= 500) return '服务器或数据库校验失败，请查看后端控制台';
  return error.response.data?.detail || error.response.data?.message || '登录失败，请稍后再试';
}

export default function Login({ onLogin, onNavigateRegister }) {
  const [form, setForm] = useState(() => ({
    account: localStorage.getItem('remembered_account') || '',
    password: '',
    remember: Boolean(localStorage.getItem('remembered_account')),
  }));
  const accountInputRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const account = form.account.trim();

    if (!account) {
      setMessage({ type: 'error', text: '账号不能为空' });
      return;
    }

    if (!form.password) {
      setMessage({ type: 'error', text: '密码不能为空' });
      return;
    }

    if (form.password.length < 3) {
      setMessage({ type: 'error', text: '密码长度不能太短' });
      return;
    }

    const data = {
      account,
      username: account,
      email: account.includes('@') ? account : undefined,
      password: form.password,
    };

    setLoading(true);
    setMessage({ type: '', text: '' });
    console.log('login request:', data);

    try {
      const response = await login(data);
      console.log('login response:', response);
      const token = response.access_token || response.token || response.user?.token || '';
      if (token) {
        localStorage.setItem('token', token);
      }

      if (form.remember) {
        localStorage.setItem('remembered_account', account);
      } else {
        localStorage.removeItem('remembered_account');
      }

      setMessage({ type: 'success', text: '登录成功，正在进入校园集市' });
      window.setTimeout(() => onLogin(response.user || { username: account, email: account }), 350);
    } catch (error) {
      console.error('login error:', error);
      setMessage({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="character-login-page">
      <AnimatedAuthShowcase
        accountFocused={focusedField === 'account'}
        passwordFocused={focusedField === 'password'}
        passwordVisible={showPassword}
      />

      <section className="character-login-form-panel">
        <div className="character-login-form-shell">
          <CharacterAuthBrand mobile />

          <header className="character-login-heading">
            <h2>欢迎回来</h2>
            <p>请输入你的账号信息</p>
          </header>

          <form className="character-login-form" onSubmit={handleSubmit}>
            <label className="character-login-field">
              <span>邮箱或用户名</span>
              <input
                ref={accountInputRef}
                value={form.account}
                onChange={(event) => setForm({ ...form, account: event.target.value })}
                onFocus={() => setFocusedField('account')}
                onBlur={() => setFocusedField(null)}
                placeholder="name@campus.edu"
                autoComplete="username"
              />
            </label>

            <label className="character-login-field">
              <span>密码</span>
              <div className="character-login-password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>

            <div className="character-login-options">
              <label>
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(event) => setForm({ ...form, remember: event.target.checked })}
                />
                <span>记住我</span>
              </label>
              <button
                type="button"
                onClick={() => setMessage({ type: 'error', text: '请联系校园集市管理员重置密码' })}
              >
                忘记密码？
              </button>
            </div>

            {message.text && (
              <p className={`character-login-message ${message.type}`} aria-live="polite">
                {message.text}
              </p>
            )}

            <button className="character-login-submit" type="submit" disabled={loading}>
              {loading ? '正在登录...' : '登录'}
            </button>
          </form>

          <button
            className="character-login-campus-email"
            type="button"
            onClick={() => accountInputRef.current?.focus()}
          >
            <Mail size={19} />
            使用校园邮箱登录
          </button>

          <p className="character-login-register">
            还没有账号？
            <button type="button" onClick={onNavigateRegister}>立即注册</button>
          </p>
        </div>
      </section>
    </main>
  );
}
