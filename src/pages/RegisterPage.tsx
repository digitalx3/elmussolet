import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { notify } from '@/lib/notify';
import PasswordStrength, { getPasswordRules, getPasswordScore } from '@/components/auth/PasswordStrength';
import { cn } from '@/lib/utils';

const PasswordField: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  showLabel: string;
  hideLabel: string;
}> = ({ id, value, onChange, showLabel, hideLabel }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        title={visible ? hideLabel : showLabel}
        className={cn(
          'absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground'
        )}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const rules = getPasswordRules(t);
  const passwordScore = getPasswordScore(password, rules);
  const passwordValid = passwordScore === rules.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      notify.error(t('auth.passwordRequirementsNotMet'));
      return;
    }
    if (password !== confirmPassword) {
      notify.error(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('secure-signup', {
      body: { email, password, full_name: fullName },
    });

    // Try to extract the JSON error body when the function returned non-2xx
    let payload: any = data;
    if (error && (error as any).context?.json) {
      try { payload = await (error as any).context.json(); } catch { /* ignore */ }
    } else if (error && (error as any).context?.text) {
      try { payload = JSON.parse(await (error as any).context.text()); } catch { /* ignore */ }
    }

    if (error || payload?.error) {
      setLoading(false);
      const code = payload?.error;
      if (code === 'weak_password' && Array.isArray(payload?.failed_rules)) {
        const ruleLabels = payload.failed_rules
          .map((k: string) => t(`auth.passwordRules.${k}`))
          .filter(Boolean);
        notify.error(`${t('auth.weakPasswordIntro')} ${ruleLabels.join(', ')}`);
      } else if (code === 'invalid_email') {
        notify.error(t('auth.invalidEmail'));
      } else if (typeof code === 'string' && /already|registered|exists/i.test(code)) {
        notify.error(t('auth.emailAlreadyRegistered'));
      } else {
        notify.error(typeof code === 'string' ? code : error?.message || 'Error');
      }
      return;
    }

    const { error: signInErr } = await signIn(email, password);
    setLoading(false);
    if (signInErr) {
      notify.success(t('auth.registerSuccess'));
      navigate('/login');
    } else {
      notify.success(t('auth.registerSuccess'));
      navigate('/el-meu-compte');
    }
  };

  return (
    <div className="container py-16 max-w-sm mx-auto">
      <h1 className="font-display text-3xl font-bold text-center mb-8">{t('auth.register')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="fullName">{t('auth.fullName')}</Label>
          <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">{t('auth.password')}</Label>
          <PasswordField
            id="password"
            value={password}
            onChange={setPassword}
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
          />
          <PasswordStrength password={password} />
        </div>
        <div>
          <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
          <PasswordField
            id="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
          />
          {confirmPassword && confirmPassword !== password && (
            <p className="mt-1 text-xs text-destructive">{t('auth.passwordMismatch')}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={loading || !passwordValid || password !== confirmPassword}>
          {loading ? t('common.loading') : t('auth.register')}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-primary hover:underline">{t('auth.login')}</Link>
        </p>
      </form>
    </div>
  );
};

export default RegisterPage;
