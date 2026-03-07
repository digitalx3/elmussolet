import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, GripVertical, Upload, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAdminProduct, useSaveProduct, useVariantTypes, type ProductFormData } from '@/hooks/useAdminProducts';
import { useCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';

const emptyTranslation = { name: '', short_description: '', description: '' };

const AdminProductForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'nou';

  const { data: product, isLoading } = useAdminProduct(isNew ? undefined : id);
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const { data: variantTypes = [] } = useVariantTypes();
  const saveProduct = useSaveProduct();

  const [form, setForm] = useState<ProductFormData>({
    slug: '', sku: '', base_price: 0, stock_quantity: 0, stock_status: 'in_stock',
    is_active: true, has_variants: false, weight_grams: 0,
    category_id: null, brand_id: null,
    translations: { ca: { ...emptyTranslation }, es: { ...emptyTranslation } },
    images: [],
    variants: [],
  });

  useEffect(() => {
    if (product && !isNew) {
      const ca = product.product_translations.find(t => t.language === 'ca');
      const es = product.product_translations.find(t => t.language === 'es');
      setForm({
        slug: product.slug,
        sku: product.sku,
        base_price: product.base_price,
        stock_quantity: product.stock_quantity,
        stock_status: product.stock_status,
        is_active: product.is_active,
        has_variants: product.has_variants,
        weight_grams: product.weight_grams,
        category_id: product.category_id,
        brand_id: product.brand_id,
        translations: {
          ca: { name: ca?.name || '', short_description: ca?.short_description || '', description: ca?.description || '' },
          es: { name: es?.name || '', short_description: es?.short_description || '', description: es?.description || '' },
        },
        images: (product.product_images || []).sort((a, b) => a.sort_order - b.sort_order).map(img => ({
          id: img.id, image_url: img.image_url, alt_text: img.alt_text || '', is_primary: img.is_primary, sort_order: img.sort_order,
        })),
        variants: (product.product_variants || []).map(v => ({
          id: v.id, value: v.value, price_override: v.price_override,
          stock_quantity: v.stock_quantity, sku_suffix: v.sku_suffix || '',
          is_active: v.is_active, variant_type_id: v.variant_type_id,
        })),
      });
    }
  }, [product, isNew]);

  const updateField = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const updateTranslation = (lang: 'ca' | 'es', field: string, value: string) =>
    setForm(prev => ({
      ...prev,
      translations: {
        ...prev.translations,
        [lang]: { ...prev.translations[lang], [field]: value },
      },
    }));

  // Auto-generate slug from CA name
  const autoSlug = () => {
    const name = form.translations.ca.name;
    if (name && !form.slug) {
      updateField('slug', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };

  // Image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(path, file);
      if (error) { toast.error('Error pujant imatge'); continue; }
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      setForm(prev => ({
        ...prev,
        images: [...prev.images, {
          image_url: urlData.publicUrl,
          alt_text: '',
          is_primary: prev.images.length === 0,
          sort_order: prev.images.length,
        }],
      }));
    }
    e.target.value = '';
  };

  const setPrimaryImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.map((img, i) => ({ ...img, is_primary: i === index })),
    }));
  };

  const removeImage = (index: number) => {
    setForm(prev => {
      const newImages = prev.images.filter((_, i) => i !== index);
      if (newImages.length > 0 && !newImages.some(img => img.is_primary)) {
        newImages[0].is_primary = true;
      }
      return { ...prev, images: newImages };
    });
  };

  // Variants
  const addVariant = () => {
    setForm(prev => ({
      ...prev,
      variants: [...prev.variants, {
        value: '', price_override: null, stock_quantity: 0,
        sku_suffix: '', is_active: true,
        variant_type_id: variantTypes[0]?.id || '',
      }],
    }));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => i === index ? { ...v, [field]: value } : v),
    }));
  };

  const removeVariant = (index: number) => {
    setForm(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.translations.ca.name || !form.slug || !form.sku) {
      toast.error('Omple els camps obligatoris: nom (CA), slug i SKU');
      return;
    }
    try {
      await saveProduct.mutateAsync({ id: isNew ? undefined : id, data: form });
      toast.success(isNew ? 'Producte creat' : 'Producte actualitzat');
      navigate('/admin/productes');
    } catch (err: any) {
      toast.error(err.message || 'Error guardant producte');
    }
  };

  if (!isNew && isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/admin/productes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-display text-2xl font-bold">
            {isNew ? t('common.create') : t('common.edit')} {t('admin.products').toLowerCase()}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/productes')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={saveProduct.isPending}>
            {saveProduct.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* Translations */}
      <Card>
        <CardHeader><CardTitle>Traduccions</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="ca">
            <TabsList>
              <TabsTrigger value="ca">Català</TabsTrigger>
              <TabsTrigger value="es">Castellano</TabsTrigger>
            </TabsList>
            {(['ca', 'es'] as const).map(lang => (
              <TabsContent key={lang} value={lang} className="space-y-4 mt-4">
                <div>
                  <Label>Nom *</Label>
                  <Input
                    value={form.translations[lang].name}
                    onChange={e => updateTranslation(lang, 'name', e.target.value)}
                    onBlur={lang === 'ca' ? autoSlug : undefined}
                    placeholder={lang === 'ca' ? 'Nom del producte' : 'Nombre del producto'}
                  />
                </div>
                <div>
                  <Label>Descripció curta</Label>
                  <Input
                    value={form.translations[lang].short_description}
                    onChange={e => updateTranslation(lang, 'short_description', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Descripció</Label>
                  <Textarea
                    value={form.translations[lang].description}
                    onChange={e => updateTranslation(lang, 'description', e.target.value)}
                    rows={5}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle>Informació bàsica</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Slug *</Label>
            <Input value={form.slug} onChange={e => updateField('slug', e.target.value)} />
          </div>
          <div>
            <Label>SKU *</Label>
            <Input value={form.sku} onChange={e => updateField('sku', e.target.value)} />
          </div>
          <div>
            <Label>Preu base (€) *</Label>
            <Input type="number" step="0.01" min="0" value={form.base_price}
              onChange={e => updateField('base_price', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Pes (grams)</Label>
            <Input type="number" min="0" value={form.weight_grams}
              onChange={e => updateField('weight_grams', parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category_id || ''} onChange={e => updateField('category_id', e.target.value || null)}>
              <option value="">— Cap —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Marca</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.brand_id || ''} onChange={e => updateField('brand_id', e.target.value || null)}>
              <option value="">— Cap —</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Estoc</Label>
            <Input type="number" min="0" value={form.stock_quantity}
              onChange={e => updateField('stock_quantity', parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Estat d'estoc</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.stock_status} onChange={e => updateField('stock_status', e.target.value)}>
              <option value="in_stock">{t('products.inStock')}</option>
              <option value="on_order">{t('products.onOrder')}</option>
              <option value="out_of_stock">{t('products.outOfStock')}</option>
            </select>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={form.is_active} onCheckedChange={v => updateField('is_active', v)} />
            <Label>Producte actiu</Label>
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader><CardTitle>Imatges</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {form.images.map((img, i) => (
              <div key={i} className="relative group border rounded-lg overflow-hidden aspect-square">
                <img src={img.image_url} alt={img.alt_text} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button type="button" variant="secondary" size="icon" onClick={() => setPrimaryImage(i)}
                    className={img.is_primary ? 'bg-yellow-400 text-yellow-900' : ''}>
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="destructive" size="icon" onClick={() => removeImage(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {img.is_primary && (
                  <span className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Principal
                  </span>
                )}
              </div>
            ))}
            <label className="border-2 border-dashed rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Pujar imatge</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Variants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Variants</CardTitle>
            <div className="flex items-center gap-3">
              <Switch checked={form.has_variants} onCheckedChange={v => updateField('has_variants', v)} />
              <Label>Té variants</Label>
            </div>
          </div>
        </CardHeader>
        {form.has_variants && (
          <CardContent className="space-y-4">
            {form.variants.map((v, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Variant {i + 1}</span>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeVariant(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="text-xs">Tipus</Label>
                    <Select value={v.variant_type_id || undefined} onValueChange={val => updateVariant(i, 'variant_type_id', val)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {variantTypes.map((vt: any) => (
                          <SelectItem key={vt.id} value={vt.id}>{vt.slug}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Valor</Label>
                    <Input value={v.value} onChange={e => updateVariant(i, 'value', e.target.value)} placeholder="ex: Blau, 0-6m" />
                  </div>
                  <div>
                    <Label className="text-xs">Preu (€, buit = base)</Label>
                    <Input type="number" step="0.01" value={v.price_override ?? ''}
                      onChange={e => updateVariant(i, 'price_override', e.target.value ? parseFloat(e.target.value) : null)} />
                  </div>
                  <div>
                    <Label className="text-xs">Estoc</Label>
                    <Input type="number" min="0" value={v.stock_quantity}
                      onChange={e => updateVariant(i, 'stock_quantity', parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">Sufix SKU</Label>
                    <Input value={v.sku_suffix} onChange={e => updateVariant(i, 'sku_suffix', e.target.value)} placeholder="-BLU" />
                  </div>
                  <div className="flex items-end gap-2">
                    <Switch checked={v.is_active} onCheckedChange={val => updateVariant(i, 'is_active', val)} />
                    <Label className="text-xs">Activa</Label>
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addVariant} className="gap-1">
              <Plus className="h-4 w-4" /> Afegir variant
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Bottom actions */}
      <div className="flex justify-end gap-2 pb-8">
        <Button type="button" variant="outline" onClick={() => navigate('/admin/productes')}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saveProduct.isPending}>
          {saveProduct.isPending ? t('common.loading') : t('common.save')}
        </Button>
      </div>
    </form>
  );
};

export default AdminProductForm;
