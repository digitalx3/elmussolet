import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t('auth.passwordMinLength'));
      return;
    }
    if (password !== confirm) {
      toast.error(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(t('errors.generic'));
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/el-meu-compte'), 2000);
    }
  };

  if (success) {
    return (
      <div className="container py-16 max-w-sm mx-auto text-center">
        <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
        <h1 className="font-display text-2xl font-bold mb-2">{t('auth.passwordUpdated')}</h1>
        <p className="text-muted-foreground">{t('auth.redirecting')}</p>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="container py-16 max-w-sm mx-auto text-center">
        <p className="text-muted-foreground">{t('auth.invalidResetLink')}</p>
      </div>
    );
  }

  return (
    <div className="container py-16 max-w-sm mx-auto">
      <h1 className="font-display text-3xl font-bold text-center mb-8">{t('auth.newPassword')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="confirm">{t('auth.confirmPassword')}</Label>
          <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t('common.loading') : t('auth.updatePassword')}
        </Button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
