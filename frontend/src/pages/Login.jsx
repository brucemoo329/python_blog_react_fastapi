import { useRef, useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import AnimatedAuthShowcase, { CharacterAuthBrand } from '../components/AnimatedAuthShowcase.jsx';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { login } from '../api/auth.js';
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
  if (serverMessage) return serverMessage;
  if (error.response.status === 404) return t('login.notFound', '登录接口不存在，请检查后端路由 /login');
  if (error.response.status === 422) return t('login.badRequest', '请求格式错误，请检查账号和密码字段');
  if (error.response.status >= 500) return t('login.serverError', '服务器或数据库校验失败，请查看后端控制台');
  return t('login.fail', '登录失败，请稍后再试');
}

export default function Login({ onLogin, onNavigateRegister }) {
  const [language, setLanguage] = useState(() => readStoredLanguage());
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
  const t = (key, fallback = '') => translate(language, key, fallback);

  const handleLanguageChange = (next) => {
    setLanguage(next);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
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

      const nextUser = response.user || { username: account, email: account };
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
    } catch (error) {
      console.error('login error:', error);
      setMessage({ type: 'error', text: getErrorMessage(error, language) });
    } finally {
      setLoading(false);
    }
  };

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
        accountFocused={focusedField === 'account'}
        passwordFocused={focusedField === 'password'}
        passwordVisible={showPassword}
      />

      <section className="grid min-h-screen min-w-0 place-items-center bg-background px-6 py-10 md:px-12 lg:px-16">
        <Card className="w-full max-w-[420px] gap-0 overflow-visible border-0 bg-transparent py-0 ring-0 shadow-none">
          <CardHeader className="px-0 pb-8 text-center">
            <CharacterAuthBrand mobile />
            <CardTitle className="text-4xl font-bold tracking-normal">{t('login.welcome')}</CardTitle>
            <CardDescription className="mt-2">{t('login.subtitle')}</CardDescription>
          </CardHeader>

          <CardContent className="px-0">
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <FieldGroup>
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

                <Dialog>
                  <DialogTrigger asChild>
                    <Button type="button" variant="link" size="sm" className="px-0">
                      {t('login.forgot')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('login.resetTitle')}</DialogTitle>
                      <DialogDescription>
                        {t('login.resetDesc')}
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button">{t('login.gotIt')}</Button>
                      </DialogClose>
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

            <Button
              className="mt-3 h-12 w-full text-base"
              variant="outline"
              size="lg"
              type="button"
              onClick={() => accountInputRef.current?.focus()}
            >
              <Mail data-icon="inline-start" />
              {t('login.campusMail')}
            </Button>
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
