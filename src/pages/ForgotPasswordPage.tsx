import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Mail } from 'lucide-react';

const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(t('errors.generic'));
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="container py-16 max-w-sm mx-auto text-center">
        <Mail className="h-12 w-12 mx-auto text-primary mb-4" />
        <h1 className="font-display text-2xl font-bold mb-4">{t('auth.recoverPassword')}</h1>
        <p className="text-muted-foreground mb-6">{t('auth.recoverSent')}</p>
        <Link to="/login">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('auth.login')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-16 max-w-sm mx-auto">
      <h1 className="font-display text-3xl font-bold text-center mb-2">{t('auth.recoverPassword')}</h1>
      <p className="text-muted-foreground text-center text-sm mb-8">{t('auth.recoverDesc')}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t('common.loading') : t('auth.sendResetLink')}
        </Button>
        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">{t('auth.login')}</Link>
        </div>
      </form>
    </div>
  );
};

export default ForgotPasswordPage;
