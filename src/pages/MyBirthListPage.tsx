import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Plus, Trash2, Search, Copy, Eye, EyeOff, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/hooks/useTaxRates';

interface ListItem {
  id?: string;
  product_id: string;
  variant_id: string | null;
  quantity_desired: number;
  priority: string;
  sort_order: number;
  productName?: string;
  price?: number;
}

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MUSSOLET-' + new Date().getFullYear() + '-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const MyBirthListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  const [listId, setListId] = useState<string | null>(null);
  const [form, setForm] = useState({
    list_code: generateCode(),
    password: '',
    baby_name: '',
    expected_date: '',
    status: 'draft',
    notes: '',
    first_name: '',
    last_name: '',
    items: [] as ListItem[],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Load existing list owned by this user
  const { data: existing, isLoading } = useQuery({
    queryKey: ['my-birth-list', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: ownerships } = await supabase
        .from('list_owners')
        .select('list_id, first_name, last_name')
        .eq('user_id', user!.id)
        .limit(1);
      if (!ownerships || ownerships.length === 0) return null;

      const listIdLocal = ownerships[0].list_id;
      const [{ data: list }, { data: items }] = await Promise.all([
        supabase.from('birth_lists').select('*').eq('id', listIdLocal).single(),
        supabase
          .from('list_items')
          .select(`
            id, product_id, variant_id, quantity_desired, priority, sort_order,
            product:products(id, base_price, product_translations(language, name))
          `)
          .eq('list_id', listIdLocal)
          .order('sort_order', { ascending: true }),
      ]);
      return { list, items: items || [], owner: ownerships[0] };
    },
  });

  useEffect(() => {
    if (existing?.list) {
      setListId(existing.list.id);
      setForm(prev => ({
        ...prev,
        list_code: existing.list.list_code,
        password: '',
        baby_name: existing.list.baby_name || '',
        expected_date: existing.list.expected_date || '',
        status: existing.list.status || 'draft',
        notes: existing.list.notes || '',
        first_name: existing.owner.first_name || '',
        last_name: existing.owner.last_name || '',
        items: (existing.items || []).map((item: any) => {
          const tr = item.product?.product_translations?.find((t: any) => t.language === lang)
            || item.product?.product_translations?.[0];
          return {
            id: item.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity_desired: item.quantity_desired,
            priority: item.priority,
            sort_order: item.sort_order,
            productName: tr?.name || item.product_id,
            price: item.product?.base_price,
          };
        }),
      }));
    } else if (existing === null && profile) {
      // Pre-fill name from profile
      const parts = (profile.full_name || '').trim().split(' ');
      setForm(prev => ({
        ...prev,
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || '',
      }));
    }
  }, [existing, lang, profile]);

  const handleProductSearch = async (query: string) => {
    setProductSearch(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('products')
      .select(`id, base_price, slug, product_translations(language, name)`)
      .eq('is_active', true)
      .limit(20);
    const filtered = (data || []).filter(p => {
      const tr = (p as any).product_translations?.find((t: any) => t.language === lang)
        || (p as any).product_translations?.[0];
      return tr?.name?.toLowerCase().includes(query.toLowerCase());
    });
    setSearchResults(filtered);
  };

  const addProduct = (product: any) => {
    if (form.items.some(i => i.product_id === product.id)) {
      toast.info(t('list.productAlreadyAdded'));
      return;
    }
    const tr = product.product_translations?.find((t: any) => t.language === lang)
      || product.product_translations?.[0];
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: product.id,
        variant_id: null,
        quantity_desired: 1,
        priority: 'medium',
        sort_order: prev.items.length,
        productName: tr?.name || product.slug,
        price: product.base_price,
      }],
    }));
    setProductSearch('');
    setSearchResults([]);
  };

  const removeItem = (idx: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, [field]: value } : it),
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.first_name.trim()) { toast.error(t('list.firstNameRequired')); return; }
    if (!listId && !form.password.trim()) { toast.error(t('list.passwordRequired')); return; }
    if (form.password && form.password.length < 6) { toast.error(t('list.passwordTooShort')); return; }

    setSaving(true);
    try {
      let currentId = listId;
      let passwordHash: string | undefined;

      if (form.password.trim()) {
        const { data: hashData, error: hashError } = await supabase.functions.invoke(
          'hash-password-util',
          { body: { password: form.password } }
        );
        if (hashError || !hashData?.hash) throw new Error('Hash error');
        passwordHash = hashData.hash;
      }

      if (!currentId) {
        // Create new list
        const { data, error } = await supabase
          .from('birth_lists')
          .insert({
            list_code: form.list_code.trim().toUpperCase(),
            password_hash: passwordHash!,
            baby_name: form.baby_name || null,
            expected_date: form.expected_date || null,
            status: form.status,
            notes: form.notes || null,
            created_by: user.id,
          })
          .select('id')
          .single();
        if (error) throw error;
        currentId = data.id;
        setListId(currentId);

        // Insert owner linked to this user
        const { error: ownerErr } = await supabase.from('list_owners').insert({
          list_id: currentId,
          user_id: user.id,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: user.email || '',
          is_primary: true,
        });
        if (ownerErr) throw ownerErr;
      } else {
        // Update list
        const updateData: any = {
          baby_name: form.baby_name || null,
          expected_date: form.expected_date || null,
          status: form.status,
          notes: form.notes || null,
        };
        if (passwordHash) updateData.password_hash = passwordHash;
        const { error } = await supabase.from('birth_lists').update(updateData).eq('id', currentId);
        if (error) throw error;

        // Update owner name
        await supabase.from('list_owners')
          .update({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
          })
          .eq('list_id', currentId)
          .eq('user_id', user.id);
      }

      // Sync items: delete + insert
      await supabase.from('list_items').delete().eq('list_id', currentId);
      if (form.items.length > 0) {
        const itemsToInsert = form.items.map((item, idx) => ({
          list_id: currentId!,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity_desired: item.quantity_desired,
          priority: item.priority,
          sort_order: idx,
        }));
        const { error } = await supabase.from('list_items').insert(itemsToInsert);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['my-birth-list', user.id] });
      toast.success(t('common.success'));
      setForm(prev => ({ ...prev, password: '' }));
    } catch (err: any) {
      toast.error(err.message || t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} ${t('list.copied')}`);
  };

  const shareWhatsApp = () => {
    const message = t('list.shareMessage', {
      babyName: form.baby_name || '',
      code: form.list_code,
      url: `${window.location.origin}/llista-naixement`,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // Determine current step: 1=create, 2=edit, 3=share
  const currentStep = !listId ? 1 : (form.status === 'active' || form.status === 'closed' ? 3 : 2);
  const steps = [
    { n: 1, label: t('list.stepCreate') },
    { n: 2, label: t('list.stepEdit') },
    { n: 3, label: t('list.stepShare') },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs / Steps */}
      <nav aria-label="Progress">
        <ol className="flex items-center gap-2 sm:gap-3 text-sm">
          {steps.map((s, i) => {
            const isActive = s.n === currentStep;
            const isDone = s.n < currentStep;
            return (
              <li key={s.n} className="flex items-center gap-2 sm:gap-3">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary font-medium'
                      : isDone
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  <span className={`flex items-center justify-center h-5 w-5 rounded-full text-xs font-semibold ${
                    isActive ? 'bg-primary-foreground text-primary' : isDone ? 'bg-primary text-primary-foreground' : 'bg-background'
                  }`}>
                    {s.n}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <span className="h-px w-4 sm:w-8 bg-border" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <Heart className="h-6 w-6 text-primary" />
        <div>
          <h2 className="font-display text-2xl font-bold">{t('list.myList')}</h2>
          <p className="text-sm text-muted-foreground">
            {currentStep === 1 ? t('list.myListCreateDesc')
              : currentStep === 2 ? t('list.myListEditDesc')
              : t('list.myListShareDesc')}
          </p>
        </div>
      </div>

      {/* Share credentials (only if exists) */}
      {listId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4" /> {t('list.shareCredentials')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 p-3 bg-background rounded-md border">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('list.listCode')}</p>
                <p className="font-mono text-sm font-semibold truncate">{form.list_code}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copy(form.list_code, t('list.listCode'))}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('list.shareHint')}</p>
            <Button variant="outline" size="sm" onClick={shareWhatsApp} className="gap-2">
              <Share2 className="h-3.5 w-3.5" /> {t('list.shareWhatsApp')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('admin.listInfo')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('list.listCode')}</Label>
              <Input value={form.list_code} disabled className="font-mono" />
              <p className="text-xs text-muted-foreground">{t('list.codeAutoGen')}</p>
            </div>
            <div className="space-y-2">
              <Label>
                {t('list.listPassword')} {listId && <span className="text-muted-foreground text-xs">({t('admin.leaveBlank')})</span>}
              </Label>
              <div className="flex gap-2">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={listId ? '••••••••' : ''}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('list.firstName')}</Label>
              <Input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('list.lastName')}</Label>
              <Input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('list.babyName')}</Label>
              <Input value={form.baby_name} onChange={e => setForm(p => ({ ...p, baby_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('list.expectedDate')}</Label>
              <Input
                type="date"
                value={form.expected_date}
                onChange={e => setForm(p => ({ ...p, expected_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('account.orderStatus')}</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t('admin.statusDraft')}</SelectItem>
                  <SelectItem value="active">{t('admin.statusActive')}</SelectItem>
                  <SelectItem value="closed">{t('admin.statusClosed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('admin.notes')}</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.listProducts')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={productSearch}
              onChange={e => handleProductSearch(e.target.value)}
              placeholder={t('admin.searchProductToAdd')}
              className="pl-10"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                {searchResults.map(p => {
                  const tr = p.product_translations?.find((t: any) => t.language === lang) || p.product_translations?.[0];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center"
                    >
                      <span>{tr?.name || p.slug}</span>
                      <span className="text-xs text-muted-foreground">{formatPrice(p.base_price)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {form.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('list.emptyList')}</p>
          ) : (
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 border border-border rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.productName}</p>
                    {item.price !== undefined && (
                      <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                    )}
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity_desired}
                      onChange={e => updateItem(idx, 'quantity_desired', parseInt(e.target.value) || 1)}
                      className="h-8"
                    />
                  </div>
                  <Select value={item.priority} onValueChange={v => updateItem(idx, 'priority', v)}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">{t('list.priorityHigh')}</SelectItem>
                      <SelectItem value="medium">{t('list.priorityMedium')}</SelectItem>
                      <SelectItem value="low">{t('list.priorityLow')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {listId ? t('common.save') : t('list.createList')}
        </Button>
      </div>
    </div>
  );
};

export default MyBirthListPage;
