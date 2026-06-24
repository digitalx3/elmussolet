import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Search, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Owner {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  is_primary: boolean;
}

interface ListItem {
  id?: string;
  product_id: string;
  variant_id: string | null;
  quantity_desired: number;
  priority: string;
  sort_order: number;
  // joined
  productName?: string;
  variantLabel?: string;
  price?: number;
}

interface ListForm {
  list_code: string;
  password: string;
  baby_name: string;
  expected_date: string;
  status: string;
  notes: string;
  owners: Owner[];
  items: ListItem[];
}

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MUSSOLET-';
  code += new Date().getFullYear() + '-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const AdminBirthListForm: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'nova';
  const queryClient = useQueryClient();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  const [form, setForm] = useState<ListForm>({
    list_code: generateCode(),
    password: '',
    baby_name: '',
    expected_date: '',
    status: 'draft',
    notes: '',
    owners: [{ first_name: '', last_name: '', email: '', is_primary: true }],
    items: [],
  });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Load existing list
  const { data: existingList, isLoading } = useQuery({
    queryKey: ['admin-birth-list', id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('birth_lists')
        .select('id, list_code, status, baby_name, expected_date, template_id, notes, created_by, created_at, updated_at')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingOwners } = useQuery({
    queryKey: ['admin-birth-list-owners', id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_owners')
        .select('*')
        .eq('list_id', id!);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: existingItems } = useQuery({
    queryKey: ['admin-birth-list-items', id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          id, product_id, variant_id, quantity_desired, quantity_purchased, priority, sort_order,
          product:products(
            id, base_price,
            product_translations(language, name)
          )
        `)
        .eq('list_id', id!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (existingList && !isNew) {
      setForm(prev => ({
        ...prev,
        list_code: existingList.list_code,
        password: '', // don't show existing password
        baby_name: existingList.baby_name || '',
        expected_date: existingList.expected_date || '',
        status: existingList.status || 'draft',
        notes: existingList.notes || '',
      }));
    }
  }, [existingList, isNew]);

  useEffect(() => {
    if (existingOwners && existingOwners.length > 0) {
      setForm(prev => ({
        ...prev,
        owners: existingOwners.map(o => ({
          id: o.id,
          first_name: o.first_name,
          last_name: o.last_name,
          email: o.email,
          is_primary: o.is_primary ?? false,
        })),
      }));
    }
  }, [existingOwners]);

  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setForm(prev => ({
        ...prev,
        items: existingItems.map((item: any) => {
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
    }
  }, [existingItems, lang]);

  // Product search
  const handleProductSearch = async (query: string) => {
    setProductSearch(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }

    const { data } = await supabase
      .from('products')
      .select(`id, base_price, slug, product_translations(language, name)`)
      .eq('is_active', true)
      .limit(10);

    const filtered = (data || []).filter(p => {
      const tr = (p as any).product_translations?.find((t: any) => t.language === lang)
        || (p as any).product_translations?.[0];
      return tr?.name?.toLowerCase().includes(query.toLowerCase());
    });

    setSearchResults(filtered);
  };

  const addProduct = (product: any) => {
    const alreadyAdded = form.items.some(i => i.product_id === product.id);
    if (alreadyAdded) { toast.info('Producte ja afegit'); return; }

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
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const addOwner = () => {
    if (form.owners.length >= 2) return;
    setForm(prev => ({
      ...prev,
      owners: [...prev.owners, { first_name: '', last_name: '', email: '', is_primary: false }],
    }));
  };

  const removeOwner = (idx: number) => {
    setForm(prev => ({ ...prev, owners: prev.owners.filter((_, i) => i !== idx) }));
  };

  const updateOwner = (idx: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      owners: prev.owners.map((o, i) => i === idx ? { ...o, [field]: value } : o),
    }));
  };

  const handleSave = async () => {
    if (!form.list_code.trim()) { toast.error('Codi de llista requerit'); return; }
    if (isNew && !form.password.trim()) { toast.error('Contrasenya requerida'); return; }
    if (form.owners.length === 0 || !form.owners[0].first_name.trim()) {
      toast.error('Mínim un propietari'); return;
    }

    setSaving(true);
    try {
      let listId = id;
      let passwordHash: string | undefined;

      // Hash password if provided
      if (form.password.trim()) {
        const { data: hashData, error: hashError } = await supabase.functions.invoke('hash-password-util', {
          body: { password: form.password },
        });
        if (hashError || !hashData?.hash) throw new Error('Error hashing password');
        passwordHash = hashData.hash;
      }

      if (isNew) {
        const { data, error } = await supabase
          .from('birth_lists')
          .insert({
            list_code: form.list_code.trim().toUpperCase(),
            password_hash: passwordHash!,
            baby_name: form.baby_name || null,
            expected_date: form.expected_date || null,
            status: form.status,
            notes: form.notes || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        listId = data.id;
      } else {
        const updateData: any = {
          list_code: form.list_code.trim().toUpperCase(),
          baby_name: form.baby_name || null,
          expected_date: form.expected_date || null,
          status: form.status,
          notes: form.notes || null,
        };
        if (passwordHash) updateData.password_hash = passwordHash;

        const { error } = await supabase
          .from('birth_lists')
          .update(updateData)
          .eq('id', listId!);
        if (error) throw error;
      }

      // Upsert owners: delete existing + insert new
      await supabase.from('list_owners').delete().eq('list_id', listId!);
      if (form.owners.length > 0) {
        const ownersToInsert = form.owners
          .filter(o => o.first_name.trim())
          .map(o => ({
            list_id: listId!,
            first_name: o.first_name.trim(),
            last_name: o.last_name.trim(),
            email: o.email.trim(),
            is_primary: o.is_primary,
          }));
        if (ownersToInsert.length > 0) {
          const { error } = await supabase.from('list_owners').insert(ownersToInsert);
          if (error) throw error;
        }
      }

      // Upsert items: delete existing + insert new
      await supabase.from('list_items').delete().eq('list_id', listId!);
      if (form.items.length > 0) {
        const itemsToInsert = form.items.map((item, idx) => ({
          list_id: listId!,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity_desired: item.quantity_desired,
          priority: item.priority,
          sort_order: idx,
        }));
        const { error } = await supabase.from('list_items').insert(itemsToInsert);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['admin-birth-lists'] });
      queryClient.invalidateQueries({ queryKey: ['admin-birth-list', listId] });
      toast.success(t('common.success'));
      navigate('/admin/llistes');
    } catch (err: any) {
      toast.error(err.message || t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const [deleteStep, setDeleteStep] = useState<'idle' | 'first' | 'orders' | 'final'>('idle');
  const [ordersCount, setOrdersCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewCounts, setPreviewCounts] = useState<{
    orders: number;
    order_items: number;
    list_items: number;
    list_sections: number;
    list_owners: number;
  }>({ orders: 0, order_items: 0, list_items: 0, list_sections: 0, list_owners: 0 });
  const REQUIRED_PHRASE = 'ELIMINAR';
  const canConfirmDelete = confirmChecked && confirmPhrase.trim().toUpperCase() === REQUIRED_PHRASE;

  // Reset confirmation state whenever the final dialog opens/closes
  useEffect(() => {
    if (deleteStep !== 'final') {
      setConfirmChecked(false);
      setConfirmPhrase('');
    }
  }, [deleteStep]);

  const openDeleteDialog = async () => {
    if (isNew || !id) return;
    if (loadingPreview || deleting) return; // guard against double click
    setLoadingPreview(true);
    try {
      // Get orders + their ids (to count order_items)
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select('id')
        .eq('list_id', id);
      if (ordersErr) throw ordersErr;
      const orderIds = (ordersData ?? []).map((o: any) => o.id);

      const headCount = async (table: any, col: string, val: any) => {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq(col, val);
        if (error) throw error;
        return count ?? 0;
      };

      let orderItemsCount = 0;
      if (orderIds.length > 0) {
        const { count, error } = await supabase
          .from('order_items')
          .select('id', { count: 'exact', head: true })
          .in('order_id', orderIds);
        if (error) throw error;
        orderItemsCount = count ?? 0;
      }

      const [listItems, listSections, listOwners] = await Promise.all([
        headCount('list_items', 'list_id', id),
        headCount('list_sections', 'list_id', id),
        headCount('list_owners', 'list_id', id),
      ]);

      const counts = {
        orders: orderIds.length,
        order_items: orderItemsCount,
        list_items: listItems,
        list_sections: listSections,
        list_owners: listOwners,
      };
      setPreviewCounts(counts);
      setOrdersCount(counts.orders);
      setDeleteStep(counts.orders > 0 ? 'orders' : 'final');
    } catch (err: any) {
      toast.error(err?.message || t('errors.generic'));
    } finally {
      setLoadingPreview(false);
    }
  };

  const performDelete = async () => {
    if (isNew || !id) return;
    if (deleting) return; // guard against double click
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-birth-list', {
        body: { list_id: id },
      });
      if (error) throw new Error(error.message || 'Edge function error');
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error('No s\'ha pogut eliminar la llista');
      queryClient.invalidateQueries({ queryKey: ['admin-birth-lists'] });
      toast.success(t('common.success'));
      navigate('/admin/llistes');
    } catch (err: any) {
      toast.error(err?.message || t('errors.generic'));
    } finally {
      setDeleting(false);
      setDeleteStep('idle');
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/llistes')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('common.back')}
        </Button>
        <h1 className="font-display text-2xl font-bold">
          {isNew ? t('admin.newList') : t('admin.editList')}
        </h1>
      </div>

      <div className="space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader><CardTitle>{t('admin.listInfo')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('list.listCode')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.list_code}
                    onChange={e => setForm(p => ({ ...p, list_code: e.target.value.toUpperCase() }))}
                    className="font-mono uppercase"
                  />
                  <Button variant="ghost" size="icon" onClick={() => {
                    navigator.clipboard.writeText(form.list_code);
                    toast.success(t('list.copyCode'));
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('list.listPassword')} {!isNew && `(${t('admin.leaveBlank')})`}</Label>
                <div className="flex gap-2">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder={isNew ? '' : '••••••••'}
                  />
                  <Button variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('list.babyName')}</Label>
                <Input
                  value={form.baby_name}
                  onChange={e => setForm(p => ({ ...p, baby_name: e.target.value }))}
                />
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
                    <SelectItem value="archived">{t('admin.statusArchived')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('admin.notes')}</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Owners */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('admin.owners')}</CardTitle>
            {form.owners.length < 2 && (
              <Button variant="outline" size="sm" onClick={addOwner} className="gap-1">
                <Plus className="h-4 w-4" /> {t('list.owner2')}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {form.owners.map((owner, idx) => (
              <div key={idx} className="space-y-3">
                {idx > 0 && <Separator />}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {idx === 0 ? t('list.owner1') : t('list.owner2')}
                  </span>
                  {idx > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => removeOwner(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('list.firstName')}</Label>
                    <Input
                      value={owner.first_name}
                      onChange={e => updateOwner(idx, 'first_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('list.lastName')}</Label>
                    <Input
                      value={owner.last_name}
                      onChange={e => updateOwner(idx, 'last_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('auth.email')}</Label>
                    <Input
                      type="email"
                      value={owner.email}
                      onChange={e => updateOwner(idx, 'email', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.listProducts')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.searchProductToAdd')}
                value={productSearch}
                onChange={e => handleProductSearch(e.target.value)}
                className="pl-10"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-elevated max-h-48 overflow-y-auto">
                  {searchResults.map(p => {
                    const tr = p.product_translations?.find((t: any) => t.language === lang)
                      || p.product_translations?.[0];
                    return (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 flex justify-between items-center text-sm"
                        onClick={() => addProduct(p)}
                      >
                        <span>{tr?.name || p.slug}</span>
                        <span className="text-muted-foreground">{p.base_price.toFixed(2)} €</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Items list */}
            {form.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('list.emptyList')}</p>
            ) : (
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      {item.price != null && (
                        <p className="text-xs text-muted-foreground">{item.price.toFixed(2)} €</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity_desired}
                        onChange={e => updateItem(idx, 'quantity_desired', parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-center text-sm"
                      />
                      <Select
                        value={item.priority}
                        onValueChange={v => updateItem(idx, 'priority', v)}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">{t('list.priorityHigh')}</SelectItem>
                          <SelectItem value="medium">{t('list.priorityMedium')}</SelectItem>
                          <SelectItem value="low">{t('list.priorityLow')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {!isNew && (
              <>
                <Button variant="destructive" size="sm" onClick={openDeleteDialog} disabled={deleting || loadingPreview}>
                  {loadingPreview ? t('common.loading') : t('common.delete')}
                </Button>

                {/* Step 1 (with orders): warn that orders will be deleted */}
                <AlertDialog open={deleteStep === 'orders'} onOpenChange={(o) => { if (!o && !deleting) setDeleteStep('idle'); }}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('admin.deleteListWithOrdersTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('admin.deleteListWithOrdersDesc', { count: ordersCount })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                      <div className="font-medium mb-1">{t('admin.deletePreviewTitle', { defaultValue: 'Se eliminarán los siguientes registros:' })}</div>
                      <div className="flex justify-between"><span>Orders</span><span className="font-mono">{previewCounts.orders}</span></div>
                      <div className="flex justify-between"><span>Order items</span><span className="font-mono">{previewCounts.order_items}</span></div>
                      <div className="flex justify-between"><span>List items</span><span className="font-mono">{previewCounts.list_items}</span></div>
                      <div className="flex justify-between"><span>List sections</span><span className="font-mono">{previewCounts.list_sections}</span></div>
                      <div className="flex justify-between"><span>List owners</span><span className="font-mono">{previewCounts.list_owners}</span></div>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => setDeleteStep('final')} disabled={deleting}>
                        {t('admin.deleteListWithOrdersConfirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Final step: double confirmation (checkbox + typed phrase) */}
                <AlertDialog open={deleteStep === 'final'} onOpenChange={(o) => { if (!o && !deleting) setDeleteStep('idle'); }}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('admin.deleteListFinalTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {ordersCount > 0
                          ? t('admin.deleteListFinalDesc', { count: ordersCount })
                          : t('admin.deleteListConfirm')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                      <div className="font-medium mb-1">{t('admin.deletePreviewTitle', { defaultValue: 'Se eliminarán los siguientes registros:' })}</div>
                      <div className="flex justify-between"><span>Orders</span><span className="font-mono">{previewCounts.orders}</span></div>
                      <div className="flex justify-between"><span>Order items</span><span className="font-mono">{previewCounts.order_items}</span></div>
                      <div className="flex justify-between"><span>List items</span><span className="font-mono">{previewCounts.list_items}</span></div>
                      <div className="flex justify-between"><span>List sections</span><span className="font-mono">{previewCounts.list_sections}</span></div>
                      <div className="flex justify-between"><span>List owners</span><span className="font-mono">{previewCounts.list_owners}</span></div>
                    </div>

                    <div className="space-y-4 py-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={confirmChecked}
                          onCheckedChange={(v) => setConfirmChecked(v === true)}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-foreground">
                          {t('admin.deleteListAckCheckbox', {
                            defaultValue:
                              'Entiendo que esta acción es permanente y eliminará la lista, sus propietarios, sus regalos y todos los pedidos asociados.',
                          })}
                        </span>
                      </label>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-phrase" className="text-sm">
                          {t('admin.deleteListTypePhrase', {
                            phrase: REQUIRED_PHRASE,
                            defaultValue: `Para confirmar, escribe "${REQUIRED_PHRASE}" a continuación:`,
                          })}
                        </Label>
                        <Input
                          id="confirm-phrase"
                          value={confirmPhrase}
                          onChange={(e) => setConfirmPhrase(e.target.value)}
                          placeholder={REQUIRED_PHRASE}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={performDelete}
                        disabled={deleting || !canConfirmDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? t('common.loading') : t('common.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/admin/llistes')}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBirthListForm;
