import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { Store, CreditCard, Truck, ClipboardList, Receipt, Server, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import ImageUploader from '@/components/admin/ImageUploader';

const SETTINGS_KEYS = [
  'store_name', 'store_email', 'store_phone', 'store_address', 'store_nif',
  'payment_bizum_phone', 'payment_transfer_iban', 'payment_transfer_beneficiary',
  'free_shipping_threshold', 'default_language',
  // Branding
  'logo_header_url', 'logo_footer_url',
  // Deployment / self-hosting
  'site_canonical_url', 'media_base_url', 'assets_base_url', 'api_base_url', 'storage_provider',
];

const AdminSettings: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('site_settings').select('*');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const map: Record<string, string> = {};
    SETTINGS_KEYS.forEach(k => { map[k] = ''; });
    settings.forEach((s: any) => { map[s.key] = s.value; });
    setForm(map);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (entries: Record<string, string>) => {
      for (const [key, value] of Object.entries(entries)) {
        const { error } = await supabase
          .from('site_settings')
          .upsert({ key, value }, { onConflict: 'key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-settings'] });
      notify.success(t('admin.settingsSaved'));
    },
    onError: () => notify.error(t('errors.generic')),
  });

  const handleSave = () => saveMutation.mutate(form);
  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  if (isLoading) return <p className="text-muted-foreground py-8">{t('common.loading')}</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Config sub-navigation */}
      <div className="flex gap-2 flex-wrap">
        <Link to="/admin/configuracio/general">
          <Button variant="secondary" size="sm" className="gap-1">
            <Store className="h-4 w-4" />
            {t('admin.settingsGeneral')}
          </Button>
        </Link>
        <Link to="/admin/configuracio">
          <Button variant="outline" size="sm" className="gap-1">
            <Receipt className="h-4 w-4" />
            {t('admin.settingsTaxes')}
          </Button>
        </Link>
        <Link to="/admin/configuracio/estats">
          <Button variant="outline" size="sm" className="gap-1">
            <ClipboardList className="h-4 w-4" />
            {t('admin.orderStatuses')}
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold">{t('admin.settingsGeneral')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('admin.settingsGeneralDesc')}</p>
      </div>

      {/* Store Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="h-5 w-5" />
            {t('admin.storeInfo')}
          </CardTitle>
          <CardDescription>{t('admin.storeInfoDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>{t('admin.storeName')}</Label>
              <Input value={form.store_name || ''} onChange={e => update('store_name', e.target.value)} />
            </div>
            <div>
              <Label>{t('admin.storeEmail')}</Label>
              <Input type="email" value={form.store_email || ''} onChange={e => update('store_email', e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>{t('admin.storePhone')}</Label>
              <Input value={form.store_phone || ''} onChange={e => update('store_phone', e.target.value)} />
            </div>
            <div>
              <Label>{t('admin.storeNif')}</Label>
              <Input value={form.store_nif || ''} onChange={e => update('store_nif', e.target.value)} placeholder="B12345678" />
            </div>
          </div>
          <div>
            <Label>{t('admin.storeAddress')}</Label>
            <Input value={form.store_address || ''} onChange={e => update('store_address', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Branding / Logos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="h-5 w-5" />
            Logotips
          </CardTitle>
          <CardDescription>
            Logotips que es mostren a la capçalera i al peu. Si els deixes buits es fan servir els predeterminats.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-semibold">Logo de la capçalera (header)</Label>
            <p className="text-xs text-muted-foreground mb-2">Format horitzontal recomanat. Alçada ~48 px.</p>
            <ImageUploader
              value={form.logo_header_url || ''}
              onChange={v => update('logo_header_url', v)}
              pathPrefix="branding/header"
              label="Logo header"
              previewClassName="h-12"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold">Logo del peu (footer)</Label>
            <p className="text-xs text-muted-foreground mb-2">Format quadrat o vertical. Alçada ~80 px.</p>
            <ImageUploader
              value={form.logo_footer_url || ''}
              onChange={v => update('logo_footer_url', v)}
              pathPrefix="branding/footer"
              label="Logo footer"
              previewClassName="h-20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            {t('admin.paymentConfig')}
          </CardTitle>
          <CardDescription>{t('admin.paymentConfigDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bizum</Label>
            <div className="mt-2">
              <Label>{t('admin.bizumPhone')}</Label>
              <Input value={form.payment_bizum_phone || ''} onChange={e => update('payment_bizum_phone', e.target.value)} placeholder="600 123 456" />
            </div>
          </div>
          <Separator />
          <div>
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('admin.bankTransfer')}</Label>
            <div className="mt-2 space-y-3">
              <div>
                <Label>{t('admin.transferIban')}</Label>
                <Input value={form.payment_transfer_iban || ''} onChange={e => update('payment_transfer_iban', e.target.value)} placeholder="ES12 3456 7890 1234 5678 9012" />
              </div>
              <div>
                <Label>{t('admin.transferBeneficiary')}</Label>
                <Input value={form.payment_transfer_beneficiary || ''} onChange={e => update('payment_transfer_beneficiary', e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Free Shipping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5" />
            {t('admin.freeShipping')}
          </CardTitle>
          <CardDescription>{t('admin.freeShippingDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label>{t('admin.freeShippingThreshold')}</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.free_shipping_threshold || '0'}
                onChange={e => update('free_shipping_threshold', e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('admin.freeShippingHint')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Deployment / Self-hosting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5" />
            {t('admin.deployment')}
          </CardTitle>
          <CardDescription>{t('admin.deploymentDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('admin.siteCanonicalUrl')}</Label>
            <Input
              value={form.site_canonical_url || ''}
              onChange={e => update('site_canonical_url', e.target.value)}
              placeholder="https://elmussolet.com"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('admin.siteCanonicalUrlHint')}</p>
          </div>
          <div>
            <Label>{t('admin.mediaBaseUrl')}</Label>
            <Input
              value={form.media_base_url || ''}
              onChange={e => update('media_base_url', e.target.value)}
              placeholder="https://media.elmussolet.com"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('admin.mediaBaseUrlHint')}</p>
          </div>
          <div>
            <Label>{t('admin.assetsBaseUrl')}</Label>
            <Input
              value={form.assets_base_url || ''}
              onChange={e => update('assets_base_url', e.target.value)}
              placeholder="https://cdn.elmussolet.com/assets"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('admin.assetsBaseUrlHint')}</p>
          </div>
          <div>
            <Label>{t('admin.apiBaseUrl')}</Label>
            <Input
              value={form.api_base_url || ''}
              onChange={e => update('api_base_url', e.target.value)}
              placeholder="https://api.elmussolet.com"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('admin.apiBaseUrlHint')}</p>
          </div>
          <div>
            <Label>{t('admin.storageProvider')}</Label>
            <select
              value={form.storage_provider || 'supabase'}
              onChange={e => update('storage_provider', e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="supabase">Supabase Storage</option>
              <option value="vps">VPS (api_base_url)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">{t('admin.storageProviderHint')}</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveMutation.isPending} size="lg">
        {saveMutation.isPending ? t('common.loading') : t('common.save')}
      </Button>
    </div>
  );
};

export default AdminSettings;
