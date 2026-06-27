import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useListAccess } from '@/contexts/ListAccessContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import PublicListSteps from '@/components/list/PublicListSteps';
import NoIndex from '@/components/seo/NoIndex';

const BirthListAccessPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setAccess } = useListAccess();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [listCode, setListCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) setListCode(code.trim().toUpperCase());
  }, [searchParams]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listCode.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-list-access', {
        body: { listCode: listCode.trim(), password },
      });

      if (error || data?.error) {
        const errKey = data?.error === 'list_not_active' ? 'list.listNotActive' : 'list.invalidCredentials';
        notify.error(t(errKey));
        return;
      }

      setAccess({
        listId: data.listId,
        listCode: data.listCode,
        token: data.token,
        babyName: data.babyName,
        owners: (data.owners || []).map((o: any) => ({
          firstName: o.first_name,
          lastName: o.last_name,
        })),
        expectedDate: data.expectedDate,
      });

      navigate(`/llista-naixement/${data.listCode}`);
    } catch {
      notify.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-12 max-w-md mx-auto">
      <PublicListSteps current="access" />
      <div className="text-center mb-8">
        <Heart className="h-10 w-10 text-primary mx-auto mb-4" />
        <h1 className="font-display text-3xl font-bold mb-3">{t('list.accessTitle')}</h1>
        <p className="text-muted-foreground">{t('list.accessDesc')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-lg shadow-soft">
        <div className="space-y-2">
          <Label htmlFor="listCode">{t('list.listCode')}</Label>
          <Input
            id="listCode"
            value={listCode}
            onChange={(e) => setListCode(e.target.value.toUpperCase())}
            placeholder="MUSSOLET-2024-ABC"
            className="uppercase"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('list.listPassword')}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full gap-2" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('list.access')}
        </Button>
      </form>
    </div>
  );
};

export default BirthListAccessPage;
