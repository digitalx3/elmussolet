import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { notify } from '@/lib/notify';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      notify.error(t('auth.loginError'));
      return;
    }
    // Route admins straight to the admin panel; everyone else to the storefront.
    let isAdmin = false;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data } = await supabase.rpc('is_admin', { _user_id: userData.user.id });
        isAdmin = !!data;
      }
    } catch {
      isAdmin = false;
    }
    setLoading(false);
    navigate(isAdmin ? '/admin' : '/');
  };

  return (
    <div className="container py-16 max-w-sm mx-auto">
      <h1 className="font-display text-3xl font-bold text-center mb-8">{t('auth.login')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t('common.loading') : t('auth.login')}
        </Button>
        <div className="text-center text-sm space-y-2">
          <Link to="/recuperar-contrasenya" className="text-primary hover:underline block">
            {t('auth.forgotPassword')}
          </Link>
          <p className="text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link to="/registre" className="text-primary hover:underline">{t('auth.register')}</Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default LoginPage;
