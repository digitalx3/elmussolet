import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { notify } from '@/lib/notify';
import PasswordStrength, { getPasswordRules, getPasswordScore } from '@/components/auth/PasswordStrength';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const navigate = useNavigate();
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
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) {
      notify.error(error.message);
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
          <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <PasswordStrength password={password} />
        </div>
        <div>
          <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
          <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
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
