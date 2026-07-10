import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import AnimatedAuthShowcase, { CharacterAuthBrand } from '../components/AnimatedAuthShowcase.jsx';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  login,
  loginWithEmailCode,
  resetPasswordWithEmail,
  sendEmailCode,
} from '../api/auth.js';
import { updateUserProfile } from '@/api/marketplace';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { readStoredLanguage, t as translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import '../styles/animated-login.css';

function getErrorMessage(error, language) {
  const t = (key, fallback = '') => translate(language, key, fallback);
  if (error.code === 'ECONNABORTED') return t('login.timeout', '服务器连接超时，请检查后端是否启动');
  if (!error.response) return t('login.connFail', '服务器连接失败，请确认 FastAPI 后端正在运行');
  const serverMessage = error.response.data?.detail || error.response.data?.message;
  if (serverMessage) return typeof serverMessage === 'string' ? serverMessage : JSON.stringify(serverMessage);
  if (error.response.status === 404) return t('login.notFound', '登录接口不存在，请检查后端路由 /login');
  if (error.response.status === 422) return t('login.badRequest', '请求格式错误，请检查账号和密码字段');
  if (error.response.status >= 500) return t('login.serverError', '服务器或数据库校验失败，请查看后端控制台');
  return t('login.fail', '登录失败，请稍后再试');
}

export default function Login({ onLogin, onNavigateRegister }) {
  const [language, setLanguage] = useState(() => readStoredLanguage());
  const [mode, setMode] = useState('password'); // password | email
  const [form, setForm] = useState(() => ({
    account: localStorage.getItem('remembered_account') || '',
    password: '',
    remember: Boolean(localStorage.getItem('remembered_account')),
    email: localStorage.getItem('remembered_email') || '',
    code: '',
  }));
  const accountInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetForm, setResetForm] = useState({ email: '', code: '', newPassword: '' });
  const [resetCooldown, setResetCooldown] = useState(0);
  const [resetLoading, setResetLoading] = useState(false);
  const t = (key, fallback = '') => translate(language, key, fallback);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (resetCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setResetCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resetCooldown]);

  const handleLanguageChange = (next) => {
    setLanguage(next);
  };

  const finishLogin = async (response, accountLabel) => {
    const token = response.access_token || response.token || response.user?.token || '';
    if (token) {
      localStorage.setItem('token', token);
    }

    if (form.remember) {
      if (mode === 'password') localStorage.setItem('remembered_account', accountLabel);
      else localStorage.setItem('remembered_email', accountLabel);
    } else {
      localStorage.removeItem('remembered_account');
      localStorage.removeItem('remembered_email');
    }

    const nextUser = response.user || { username: accountLabel, email: accountLabel };
    nextUser.profile = { ...(nextUser.profile || {}), language };
    try {
      if (token) {
        const profileResponse = await updateUserProfile({ language });
        nextUser.profile = { ...(nextUser.profile || {}), ...(profileResponse.profile || {}), language };
      }
    } catch {
      // Keep local language even if profile sync fails.
    }

    setMessage({ type: 'success', text: t('login.success') });
    window.setTimeout(() => onLogin(nextUser), 350);
  };

  const handleSendLoginCode = async () => {
    const email = form.email.trim();
    if (!email) {
      setMessage({ type: 'error', text: t('login.emailRequired') });
      return;
    }
    setCodeLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await sendEmailCode({ email, purpose: 'login' });
      const hint = response.dev_code
        ? `${response.message || t('login.codeSent')}（开发码 ${response.dev_code}）`
        : (response.message || t('login.codeSent'));
      setMessage({ type: 'success', text: hint });
      setCooldown(response.cooldown || 60);
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, language) });
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (mode === 'email') {
      const email = form.email.trim();
      if (!email) {
        setMessage({ type: 'error', text: t('login.emailRequired') });
        return;
      }
      if (!form.code.trim()) {
        setMessage({ type: 'error', text: t('login.codeRequired') });
        return;
      }
      setLoading(true);
      setMessage({ type: '', text: '' });
      try {
        const response = await loginWithEmailCode({ email, verify_code: form.code.trim() });
        await finishLogin(response, email);
      } catch (error) {
        setMessage({ type: 'error', text: getErrorMessage(error, language) });
      } finally {
        setLoading(false);
      }
      return;
    }

    const account = form.account.trim();
    if (!account) {
      setMessage({ type: 'error', text: t('login.accountRequired') });
      return;
    }
    if (!form.password) {
      setMessage({ type: 'error', text: t('login.passwordRequired') });
      return;
    }
    if (form.password.length < 3) {
      setMessage({ type: 'error', text: t('login.passwordShort') });
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

    try {
      const response = await login(data);
      await finishLogin(response, account);
    } catch (error) {
      console.error('login error:', error);
      setMessage({ type: 'error', text: getErrorMessage(error, language) });
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetCode = async () => {
    const email = resetForm.email.trim();
    if (!email) {
      setMessage({ type: 'error', text: t('login.emailRequired') });
      return;
    }
    setResetLoading(true);
    try {
      const response = await sendEmailCode({ email, purpose: 'reset' });
      const hint = response.dev_code
        ? `${response.message || t('login.codeSent')}（开发码 ${response.dev_code}）`
        : (response.message || t('login.codeSent'));
      setMessage({ type: 'success', text: hint });
      setResetCooldown(response.cooldown || 60);
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, language) });
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetForm.email.trim() || !resetForm.code.trim() || !resetForm.newPassword) {
      setMessage({ type: 'error', text: '请填写邮箱、验证码和新密码' });
      return;
    }
    if (resetForm.newPassword.length < 6) {
      setMessage({ type: 'error', text: '新密码至少 6 位' });
      return;
    }
    setResetLoading(true);
    try {
      const response = await resetPasswordWithEmail({
        email: resetForm.email.trim(),
        verify_code: resetForm.code.trim(),
        new_password: resetForm.newPassword,
      });
      setMessage({ type: 'success', text: response.message || t('login.resetOk') });
      setResetOpen(false);
      setMode('password');
      setForm((current) => ({
        ...current,
        account: resetForm.email.trim(),
        password: '',
      }));
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, language) });
    } finally {
      setResetLoading(false);
    }
  };

  const passwordFocused = focusedField === 'password' || focusedField === 'newPassword';
  const accountFocused = focusedField === 'account' || focusedField === 'email' || focusedField === 'code';

  return (
    <main className="character-login-page">
      <div className="auth-lang-switcher">
        <LanguageSwitcher
          language={language}
          onChange={handleLanguageChange}
          appearance="login"
          align="end"
        />
      </div>

      <AnimatedAuthShowcase
        accountFocused={accountFocused}
        passwordFocused={passwordFocused}
        passwordVisible={showPassword}
      />

      <section className="grid min-h-screen min-w-0 place-items-center bg-background px-6 py-10 md:px-12 lg:px-16">
        <Card className="w-full max-w-[420px] gap-0 overflow-visible border-0 bg-transparent py-0 ring-0 shadow-none">
          <CardHeader className="px-0 pb-6 text-center">
            <CharacterAuthBrand mobile />
            <CardTitle className="text-4xl font-bold tracking-normal">{t('login.welcome')}</CardTitle>
            <CardDescription className="mt-2">{t('login.subtitle')}</CardDescription>
          </CardHeader>

          <CardContent className="px-0">
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                className={cn(
                  'h-10 rounded-lg text-sm font-medium transition',
                  mode === 'password' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
                onClick={() => setMode('password')}
              >
                {t('login.tabPassword')}
              </button>
              <button
                type="button"
                className={cn(
                  'h-10 rounded-lg text-sm font-medium transition',
                  mode === 'email' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
                onClick={() => setMode('email')}
              >
                {t('login.tabEmail')}
              </button>
            </div>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <FieldGroup>
                {mode === 'password' ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="login-account">{t('login.account')}</FieldLabel>
                      <Input
                        id="login-account"
                        ref={accountInputRef}
                        className="h-12 bg-background text-base"
                        value={form.account}
                        onChange={(event) => setForm({ ...form, account: event.target.value })}
                        onFocus={() => setFocusedField('account')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="name@campus.edu"
                        autoComplete="username"
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="login-password">{t('login.password')}</FieldLabel>
                      <InputGroup className="h-12 bg-background">
                        <InputGroupInput
                          id="login-password"
                          className="text-base"
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(event) => setForm({ ...form, password: event.target.value })}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField(null)}
                          placeholder={t('login.passwordPh')}
                          autoComplete="current-password"
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            size="icon-xs"
                            aria-label={showPassword ? 'hide' : 'show'}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setShowPassword((value) => !value)}
                          >
                            {showPassword ? <EyeOff /> : <Eye />}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                  </>
                ) : (
                  <>
                    <Field>
                      <FieldLabel htmlFor="login-email">{t('login.email')}</FieldLabel>
                      <Input
                        id="login-email"
                        ref={emailInputRef}
                        type="email"
                        className="h-12 bg-background text-base"
                        value={form.email}
                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        placeholder={t('login.emailPh')}
                        autoComplete="email"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="login-code">{t('login.code')}</FieldLabel>
                      <div className="flex gap-2">
                        <Input
                          id="login-code"
                          className="h-12 flex-1 bg-background text-base"
                          value={form.code}
                          onChange={(event) => setForm({ ...form, code: event.target.value })}
                          onFocus={() => setFocusedField('code')}
                          onBlur={() => setFocusedField(null)}
                          placeholder={t('login.codePh')}
                          autoComplete="one-time-code"
                          inputMode="numeric"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 shrink-0 px-3"
                          disabled={codeLoading || cooldown > 0}
                          onClick={handleSendLoginCode}
                        >
                          {codeLoading
                            ? t('login.sendingCode')
                            : cooldown > 0
                              ? `${cooldown}${t('login.resendIn')}`
                              : t('login.sendCode')}
                        </Button>
                      </div>
                    </Field>
                  </>
                )}
              </FieldGroup>

              <div className="flex items-center justify-between gap-4">
                <Field orientation="horizontal" className="w-auto gap-2">
                  <Checkbox
                    id="remember-account"
                    checked={form.remember}
                    onCheckedChange={(checked) => setForm({ ...form, remember: Boolean(checked) })}
                  />
                  <FieldLabel htmlFor="remember-account" className="font-normal text-muted-foreground">
                    {t('login.remember')}
                  </FieldLabel>
                </Field>

                <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="link" size="sm" className="px-0">
                      {t('login.forgot')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('login.resetTitle')}</DialogTitle>
                      <DialogDescription>{t('login.resetDesc')}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                      <Input
                        type="email"
                        placeholder={t('login.emailPh')}
                        value={resetForm.email}
                        onChange={(e) => setResetForm({ ...resetForm, email: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder={t('login.codePh')}
                          value={resetForm.code}
                          onChange={(e) => setResetForm({ ...resetForm, code: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={resetLoading || resetCooldown > 0}
                          onClick={handleSendResetCode}
                        >
                          {resetCooldown > 0 ? `${resetCooldown}s` : t('login.sendCode')}
                        </Button>
                      </div>
                      <Input
                        type="password"
                        placeholder={t('login.newPassword')}
                        value={resetForm.newPassword}
                        onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                      />
                    </div>
                    <DialogFooter className="gap-2">
                      <DialogClose asChild>
                        <Button type="button" variant="outline">{t('login.gotIt')}</Button>
                      </DialogClose>
                      <Button type="button" disabled={resetLoading} onClick={handleResetPassword}>
                        {t('login.resetSubmit')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {message.text && (
                <p
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-sm',
                    message.type === 'success'
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-destructive/30 bg-destructive/10 text-destructive',
                  )}
                  role={message.type === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {message.text}
                </p>
              )}

              <Button className="h-12 w-full text-base" type="submit" size="lg" disabled={loading}>
                {loading && <Spinner data-icon="inline-start" />}
                {loading ? t('login.submitting') : t('login.submit')}
              </Button>
            </form>

            {mode === 'password' ? (
              <Button
                className="mt-3 h-12 w-full text-base"
                variant="outline"
                size="lg"
                type="button"
                onClick={() => {
                  setMode('email');
                  window.setTimeout(() => emailInputRef.current?.focus(), 50);
                }}
              >
                <Mail data-icon="inline-start" />
                {t('login.campusMail')}
              </Button>
            ) : null}
          </CardContent>

          <CardFooter className="justify-center border-0 bg-transparent px-0 pt-7 pb-0 text-sm text-muted-foreground">
            <span>{t('login.noAccount')}</span>
            <Button type="button" variant="link" className="h-auto px-1" onClick={onNavigateRegister}>
              {t('login.register')}
            </Button>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}
