import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import AnimatedAuthShowcase, { CharacterAuthBrand } from '../components/AnimatedAuthShowcase.jsx';
import { registerWithEmailCode, sendEmailCode } from '../api/auth.js';
import ProfileOnboarding from './ProfileOnboarding.jsx';
import '../styles/animated-login.css';

const PENDING_PROFILE_KEY = 'campus_pending_profile';

function getErrorMessage(error) {
  if (!error.response) return '服务器连接失败，请确认后端已启动';
  const detail = error.response.data?.detail || error.response.data?.message;
  if (detail) return typeof detail === 'string' ? detail : JSON.stringify(detail);
  if (error.response.status === 404) return '注册接口不存在，请检查后端路由';
  if (error.response.status === 422) return '请求格式错误，请检查注册字段';
  return '注册失败，请稍后再试';
}

export default function Register({ onNavigateLogin, onNavigateHome, onLogin }) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    code: '',
    password: '',
    confirmPassword: '',
    school: '',
    phone: '',
  });
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [registeredUser, setRegisteredUser] = useState(() => {
    try {
      const pending = sessionStorage.getItem(PENDING_PROFILE_KEY);
      return pending ? JSON.parse(pending) : null;
    } catch {
      return null;
    }
  });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const passwordFocused = focusedField === 'password' || focusedField === 'confirmPassword';
  const activePasswordVisible = focusedField === 'confirmPassword' ? showConfirmPassword : showPassword;
  const accountFocused = Boolean(focusedField && !passwordFocused);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = async () => {
    const email = form.email.trim();
    if (!email) {
      setMessage({ type: 'error', text: '请先填写邮箱' });
      return;
    }
    setCodeLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await sendEmailCode({ email, purpose: 'register' });
      const hint = response.dev_code
        ? `${response.message || '验证码已发送'}（开发码 ${response.dev_code}）`
        : (response.message || '验证码已发送，请查收邮件（QQ/Gmail/Outlook 等均可）');
      setMessage({ type: 'success', text: hint });
      setCooldown(Number(response.cooldown) || 30);
    } catch (error) {
      const detail = error.response?.data?.detail || '';
      const match = String(detail).match(/(\d+)\s*秒/);
      if (error.response?.status === 429 && match) {
        setCooldown(Number(match[1]) || 30);
      }
      setMessage({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.username.trim()) {
      setMessage({ type: 'error', text: '用户名不能为空' });
      return;
    }

    if (!form.email.trim()) {
      setMessage({ type: 'error', text: '邮箱不能为空' });
      return;
    }

    if (!form.code.trim()) {
      setMessage({ type: 'error', text: '请输入邮箱验证码' });
      return;
    }

    if (form.password.length < 6) {
      setMessage({ type: 'error', text: '密码至少 6 位' });
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的密码不一致' });
      return;
    }

    if (!form.school.trim()) {
      setMessage({ type: 'error', text: '学校不能为空' });
      return;
    }

    const data = {
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      verify_code: form.code.trim(),
      school: form.school.trim(),
      phone: form.phone.trim() || null,
    };

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await registerWithEmailCode(data);
      const token = response.access_token || response.token;
      if (token) localStorage.setItem('token', token);
      setMessage({ type: 'success', text: response.message || '注册成功' });
      if (onLogin && response.user && token) {
        sessionStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(response.user));
        setRegisteredUser(response.user);
      } else {
        window.setTimeout(onNavigateLogin, 900);
      }
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const finishOnboarding = (nextUser) => {
    sessionStorage.removeItem(PENDING_PROFILE_KEY);
    setRegisteredUser(null);
    onLogin?.(nextUser || registeredUser);
  };

  if (registeredUser) {
    return (
      <ProfileOnboarding
        user={registeredUser}
        onComplete={finishOnboarding}
        onSkip={finishOnboarding}
      />
    );
  }

  return (
    <main className="character-login-page character-register-page">
      <AnimatedAuthShowcase
        accountFocused={accountFocused}
        passwordFocused={passwordFocused}
        passwordVisible={activePasswordVisible}
      />

      <section className="character-login-form-panel character-register-form-panel">
        <div className="character-login-form-shell character-register-form-shell">
          <CharacterAuthBrand mobile />

          <header className="character-login-heading character-register-heading">
            <h2>立即注册</h2>
            <p>邮箱验证码注册 · 支持 QQ / Gmail / Outlook 等</p>
          </header>

          <form className="character-login-form character-register-form" onSubmit={handleSubmit}>
            <div className="character-register-grid">
            <label className="character-login-field">
              <span>用户名</span>
              <input
                value={form.username}
                onChange={(event) => update('username', event.target.value)}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                placeholder="例如 xiaoming"
                autoComplete="username"
              />
            </label>
            <label className="character-login-field">
              <span>邮箱</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="you@qq.com / Gmail / Outlook"
                autoComplete="email"
              />
            </label>
            <label className="character-login-field character-register-code-field">
              <span>邮箱验证码</span>
              <div className="character-login-code-row">
                <input
                  value={form.code}
                  onChange={(event) => update('code', event.target.value)}
                  onFocus={() => setFocusedField('code')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="6 位验证码"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="character-login-code-btn"
                  disabled={codeLoading || cooldown > 0}
                  onClick={handleSendCode}
                >
                  {codeLoading ? '发送中…' : cooldown > 0 ? `${cooldown}s` : '获取验证码'}
                </button>
              </div>
            </label>
            <label className="character-login-field">
              <span>密码</span>
              <div className="character-login-password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => update('password', event.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="至少 6 位"
                  autoComplete="new-password"
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
            <label className="character-login-field">
              <span>确认密码</span>
              <div className="character-login-password">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(event) => update('confirmPassword', event.target.value)}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="再次输入密码"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowConfirmPassword((value) => !value)}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
            <label className="character-login-field">
              <span>学校</span>
              <input
                value={form.school}
                onChange={(event) => update('school', event.target.value)}
                onFocus={() => setFocusedField('school')}
                onBlur={() => setFocusedField(null)}
                placeholder="例如：北京大学 / 上海交通大学"
                autoComplete="organization"
              />
            </label>
            <label className="character-login-field">
              <span>手机号，可选</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
                placeholder="方便同学联系"
                autoComplete="tel"
              />
            </label>
            </div>

            {message.text && (
              <p className={`character-login-message ${message.type}`} aria-live="polite">
                {message.text}
              </p>
            )}

            <button className="character-login-submit" type="submit" disabled={loading}>
              {loading ? '正在注册...' : '创建账号'}
            </button>
          </form>

          <p className="character-login-register">
            已有账号？
            <button type="button" onClick={onNavigateLogin}>返回登录</button>
          </p>
          {onNavigateHome ? <button type="button" className="character-login-home-link" onClick={onNavigateHome}>返回平台介绍</button> : null}
        </div>
      </section>
    </main>
  );
}
