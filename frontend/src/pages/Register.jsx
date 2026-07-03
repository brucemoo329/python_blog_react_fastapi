import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import AnimatedAuthShowcase, { CharacterAuthBrand } from '../components/AnimatedAuthShowcase.jsx';
import { register } from '../api/auth.js';
import '../styles/animated-login.css';

function getErrorMessage(error) {
  if (!error.response) return '服务器连接失败，请确认后端已启动';
  if (error.response.status === 404) return '注册接口不存在，请检查后端路由 /users/';
  if (error.response.status === 422) return '请求格式错误，请检查注册字段';
  return error.response.data?.detail || error.response.data?.message || '注册失败，请稍后再试';
}

export default function Register({ onNavigateLogin }) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    school: '',
    phone: '',
  });
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const passwordFocused = focusedField === 'password' || focusedField === 'confirmPassword';
  const activePasswordVisible = focusedField === 'confirmPassword' ? showConfirmPassword : showPassword;
  const accountFocused = Boolean(focusedField && !passwordFocused);

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

    if (form.password.length < 3) {
      setMessage({ type: 'error', text: '密码长度不能太短' });
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
      school: form.school.trim(),
      phone: form.phone.trim() || null,
    };

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await register(data);
      setMessage({ type: 'success', text: '注册成功，请登录。' });
      window.setTimeout(onNavigateLogin, 900);
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

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
            <p>创建你的校园集市账号</p>
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
                placeholder="you@school.edu"
                autoComplete="email"
              />
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
                  placeholder="请输入密码"
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
                placeholder="请输入学校"
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
        </div>
      </section>
    </main>
  );
}
