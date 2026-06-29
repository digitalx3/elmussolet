import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, GripVertical, Upload, Star, AlertCircle, Sparkles, Loader2, ExternalLink } from 'lucide-react';
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
import { notify } from '@/lib/notify';
import { supabase } from '@/integrations/supabase/client';
import { useAdminProduct, useSaveProduct, useVariantTypes, type ProductFormData } from '@/hooks/useAdminProducts';
import { useCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';
import { useActiveTaxRates, priceWithTax } from '@/hooks/useTaxRates';
import { optimizeImage } from '@/lib/optimizeImage';
import { useLanguages, useDefaultLanguage } from '@/hooks/useLanguages';
import LanguageTabs from '@/components/admin/LanguageTabs';
import { useAiProvider, isAiReady } from '@/hooks/useAiProvider';
import RichTextEditor from '@/components/ui/rich-text-editor';
import RelatedProductsEditor from '@/components/admin/RelatedProductsEditor';
import ReplacementProductPicker from '@/components/admin/ReplacementProductPicker';
import { SlugInput, validateSlugValue } from '@/components/admin/SlugInput';
import { checkBaseSlugDuplicate, checkTranslationSlugDuplicate } from '@/lib/checkSlugDuplicate';
import { useDuplicateSlugErrors, hasAnySlugError } from '@/hooks/useDuplicateSlugErrors';


const emptyTranslation = { name: '', short_description: '', description: '', slug: '' };

const MAX_NAME = 200;
const MAX_SHORT = 500;
const MAX_DESC = 5000;

type TranslationFieldErrors = { name?: string; short_description?: string; description?: string };
type TranslationErrors = Record<string, TranslationFieldErrors>;

function validateTranslation(
  tr: { name: string; short_description: string; description: string },
  opts: { requireName: boolean; langLabel: string }
): TranslationFieldErrors {
  const errs: TranslationFieldErrors = {};
  const name = (tr.name ?? '').trim();
  if (opts.requireName && !name) {
    errs.name = `El nom és obligatori (${opts.langLabel})`;
  } else if (name.length > MAX_NAME) {
    errs.name = `Màx. ${MAX_NAME} caràcters`;
  }
  if ((tr.short_description ?? '').length > MAX_SHORT) {
    errs.short_description = `Màx. ${MAX_SHORT} caràcters`;
  }
  if ((tr.description ?? '').length > MAX_DESC) {
    errs.description = `Màx. ${MAX_DESC} caràcters`;
  }
  return errs;
}

const AdminProductForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'nou';

  const { data: product, isLoading } = useAdminProduct(isNew ? undefined : id);
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const { data: variantTypes = [] } = useVariantTypes();
  const { data: taxRates = [] } = useActiveTaxRates();
  const { data: languages = [] } = useLanguages({ onlyEnabled: true });
  const { data: defaultLang } = useDefaultLanguage();
  const saveProduct = useSaveProduct();

  const defaultCode = defaultLang?.code ?? languages[0]?.code ?? 'ca';

  const [form, setForm] = useState<ProductFormData>({
    slug: '', sku: '', base_price: 0, stock_quantity: 0, stock_status: 'in_stock',
    is_active: true, has_variants: false, weight_grams: 0,
    category_id: null, brand_id: null, default_section_id: null, tax_rate_id: null,
    sale_price_type: null, sale_value: null, sale_starts_at: null, sale_ends_at: null,
    is_featured: false, featured_order: null,
    replacement_product_id: null,
    translations: {},
    images: [],
    variants: [],
    related_product_ids: [],
    cross_sell_product_ids: [],
  });

  const [translationErrors, setTranslationErrors] = useState<TranslationErrors>({});
  const [activeLang, setActiveLang] = useState<string | undefined>(undefined);
  const [seoGenerating, setSeoGenerating] = useState<string | null>(null);
  const { data: aiStatus } = useAiProvider();
  const aiReady = isAiReady(aiStatus);

  // Live duplicate-slug detection (base + per language)
  const slugDupErrors = useDuplicateSlugErrors(
    () => [
      { key: 'base', run: () => checkBaseSlugDuplicate('products', form.slug, isNew ? null : id) },
      ...languages.map((lng) => ({
        key: lng.code,
        run: () => checkTranslationSlugDuplicate(
          { table: 'product_translations', fk: 'product_id', langCol: 'language' },
          lng.code,
          (form.translations[lng.code] as any)?.slug || '',
          isNew ? null : id,
        ),
      })),
    ],
    [
      form.slug,
      languages.map(l => l.code).join(','),
      JSON.stringify(Object.fromEntries(languages.map(l => [l.code, (form.translations[l.code] as any)?.slug || '']))),
      id, isNew,
    ],
  );

  type SeoField = 'short' | 'long';

  const generateSeoDescriptions = async (lang: string, fields: SeoField[] = ['short', 'long']) => {
    const tr = form.translations[lang] ?? emptyTranslation;
    const defaultTr = form.translations[defaultCode] ?? emptyTranslation;
    const productName = tr.name?.trim() || defaultTr.name?.trim();
    if (!productName) {
      notify.error('Cal omplir el nom del producte abans de generar la descripció');
      return;
    }
    if (!aiReady) {
      notify.error("Configura un proveïdor d'IA a /admin/ia abans d'utilitzar aquesta funció");
      return;
    }
    if (fields.length === 0) {
      notify.error('Selecciona almenys un camp per generar');
      return;
    }
    const language = languages.find(l => l.code === lang);
    const brand = brands.find((b: any) => b.id === form.brand_id);
    const category = categories.find((c: any) => c.id === form.category_id);
    setSeoGenerating(lang);
    try {
      const { invokeWithRetry } = await import('@/lib/aiTranslationLog');
      const data: any = await invokeWithRetry('ai-product-seo', {
        product_id: id,
        name: productName,
        sku: form.sku || undefined,
        brand: brand?.name || undefined,
        category: (category as any)?.name || undefined,
        language: lang,
        language_name: language?.native_name || lang,
        current_short: tr.short_description || '',
        current_long: tr.description || '',
        fields,
      });
      setForm(prev => {
        const prevTr = prev.translations[lang] ?? emptyTranslation;
        return {
          ...prev,
          translations: {
            ...prev.translations,
            [lang]: {
              ...prevTr,
              ...(fields.includes('short') ? { short_description: String(data?.short_description ?? prevTr.short_description) } : {}),
              ...(fields.includes('long') ? { description: String(data?.description ?? prevTr.description) } : {}),
            },
          },
        };
      });
      const labels = fields.map(f => (f === 'short' ? 'curta' : 'llarga')).join(' + ');
      notify.success(`Descripció ${labels} generada amb IA (${language?.native_name || lang})`);
    } catch (e: any) {
      notify.error(e?.message || 'Error generant descripcions');
    } finally {
      setSeoGenerating(null);
    }
  };

  // Ensure an entry exists for every enabled language
  useEffect(() => {
    if (!languages.length) return;
    setForm(prev => {
      const next = { ...prev.translations };
      let changed = false;
      for (const lng of languages) {
        if (!next[lng.code]) {
          next[lng.code] = { ...emptyTranslation };
          changed = true;
        }
      }
      return changed ? { ...prev, translations: next } : prev;
    });
  }, [languages]);

  useEffect(() => {
    if (product && !isNew) {
      const translations: ProductFormData['translations'] = {};
      // Seed every enabled language with empty values
      for (const lng of languages) {
        translations[lng.code] = { ...emptyTranslation };
      }
      // Fill in stored values (also keeps codes that exist in DB but aren't enabled)
      for (const tr of product.product_translations || []) {
        translations[tr.language] = {
          name: tr.name || '',
          short_description: tr.short_description || '',
          description: tr.description || '',
          slug: (tr as any).slug || '',
        };
      }

      const allRels = ((product as any).product_relations || []).slice();
      const relatedSorted = allRels
        .filter((r: any) => (r.relation_type ?? 'upsell') === 'upsell')
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
        .map((r: any) => r.related_product_id as string);
      const crossSellSorted = allRels
        .filter((r: any) => r.relation_type === 'cross_sell')
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
        .map((r: any) => r.related_product_id as string);
      setForm({
        slug: product.slug,
        sku: product.sku,
        base_price: product.base_price,
        stock_quantity: product.stock_quantity,
        stock_status: product.stock_status,
        is_active: product.is_active,
        has_variants: product.has_variants ?? false,
        weight_grams: product.weight_grams,
        category_id: product.category_id,
        brand_id: product.brand_id,
        default_section_id: (product as any).default_section_id ?? null,
        tax_rate_id: (product as any).tax_rate_id ?? null,
        sale_price_type: (product as any).sale_price_type ?? null,
        sale_value: (product as any).sale_value != null ? Number((product as any).sale_value) : null,
        sale_starts_at: (product as any).sale_starts_at ?? null,
        sale_ends_at: (product as any).sale_ends_at ?? null,
        is_featured: !!(product as any).is_featured,
        featured_order: (product as any).featured_order ?? null,
        replacement_product_id: (product as any).replacement_product_id ?? null,
        translations,
        images: (product.product_images || []).sort((a, b) => a.sort_order - b.sort_order).map(img => ({
          id: img.id, image_url: img.image_url, alt_text: img.alt_text || '', is_primary: img.is_primary, sort_order: img.sort_order,
        })),
        variants: (product.product_variants || []).map(v => ({
          id: v.id, value: v.value, price_override: v.price_override,
          price_modifier: (v as any).price_modifier != null ? Number((v as any).price_modifier) : 0,
          stock_quantity: v.stock_quantity, sku_suffix: v.sku_suffix || '',
          is_active: v.is_active, variant_type_id: v.variant_type_id,
        })),
        related_product_ids: relatedSorted,
        cross_sell_product_ids: crossSellSorted,
      });
    }
  }, [product, isNew, languages]);

  const updateField = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const updateTranslation = (lang: string, field: string, value: string) => {
    setForm(prev => {
      const prevTr = prev.translations[lang] ?? emptyTranslation;
      const nextTr: any = { ...prevTr, [field]: value };
      // Auto-fill per-language slug from name when slug is empty/untouched
      if (field === 'name') {
        const slugify = (s: string) => s
          .toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/['"`´]/g, '').replace(/&/g, '-and-')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
        const prevAuto = slugify(prevTr.name || '');
        if (!prevTr.slug || prevTr.slug === prevAuto) {
          nextTr.slug = slugify(value);
        }
      }
      return {
        ...prev,
        translations: { ...prev.translations, [lang]: nextTr },
      };
    });
    setTranslationErrors(prev => {
      if (!prev[lang]?.[field as keyof TranslationFieldErrors]) return prev;
      const langErrs = { ...prev[lang] };
      delete langErrs[field as keyof TranslationFieldErrors];
      return { ...prev, [lang]: langErrs };
    });
  };

  // Auto-generate base slug from the default language name (only if still empty)
  const autoSlug = () => {
    const name = form.translations[defaultCode]?.name ?? '';
    if (name && !form.slug) {
      updateField('slug', name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };


  // Image upload (with automatic resize + WebP optimization)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const original of Array.from(files)) {
      const file = await optimizeImage(original, { maxDimension: 1600, quality: 0.85 });
      const ext = file.name.split('.').pop() || 'webp';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, file, { contentType: file.type });
      if (error) { notify.error('Error pujant imatge'); continue; }
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
        value: '', price_override: null, price_modifier: 0, stock_quantity: 0,
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

    // Validate each enabled language
    const newErrors: TranslationErrors = {};
    let firstInvalidLang: string | null = null;
    for (const lng of languages) {
      const tr = form.translations[lng.code] ?? emptyTranslation;
      const langLabel = (lng.native_name || lng.name || lng.code).toString();
      const errs = validateTranslation(tr, { requireName: true, langLabel });
      if (Object.keys(errs).length > 0) {
        newErrors[lng.code] = errs;
        if (!firstInvalidLang) firstInvalidLang = lng.code;
      }
    }
    setTranslationErrors(newErrors);

    if (firstInvalidLang) {
      setActiveLang(firstInvalidLang);
      notify.error('Revisa les traduccions: hi ha camps amb errors.');
      return;
    }

    // Slug validation (base + per-language). Empty allowed (auto-generated).
    const baseSlugErr = validateSlugValue(form.slug || '', true);
    if (baseSlugErr) {
      notify.error(`Slug base no vàlid: ${baseSlugErr}`);
      return;
    }
    for (const lng of languages) {
      const trSlug = (form.translations[lng.code] as any)?.slug || '';
      const err = validateSlugValue(trSlug, true);
      if (err) {
        setActiveLang(lng.code);
        notify.error(`Slug (${lng.code.toUpperCase()}) no vàlid: ${err}`);
        return;
      }
    }

    // Duplicate slug check (server-side validated, surfaced inline already)
    if (hasAnySlugError(slugDupErrors)) {
      const dupLang = languages.find(l => slugDupErrors[l.code]);
      if (dupLang) setActiveLang(dupLang.code);
      notify.error('Hi ha slugs duplicats. Revisa els camps marcats en vermell.');
      return;
    }

    if (!form.sku) {
      notify.error('Omple els camps obligatoris: SKU');
      return;
    }



    // Sale price validation
    if (form.sale_price_type) {
      const v = form.sale_value;
      if (v == null || isNaN(v)) {
        notify.error("Indica el valor de l'oferta o desactiva-la.");
        return;
      }
      if (v <= 0) {
        notify.error("El valor de l'oferta ha de ser superior a 0.");
        return;
      }
      if (form.sale_price_type === 'percent' && v >= 100) {
        notify.error('El percentatge de descompte ha de ser inferior a 100.');
        return;
      }
      if (form.sale_price_type === 'fixed' && form.base_price > 0 && v >= form.base_price) {
        notify.error("El preu d'oferta ha de ser inferior al preu base.");
        return;
      }
      if (form.sale_starts_at && form.sale_ends_at) {
        const s = new Date(form.sale_starts_at).getTime();
        const e2 = new Date(form.sale_ends_at).getTime();
        if (!isNaN(s) && !isNaN(e2) && s > e2) {
          notify.error("La data d'inici de l'oferta ha de ser anterior a la data de fi.");
          return;
        }
      }
    }

    // Replacement product validation (only when discontinued)
    if (form.stock_status === 'discontinued' && form.replacement_product_id) {
      if (form.replacement_product_id === id) {
        notify.error('El producte substitut no pot ser el mateix producte.');
        return;
      }
      const { data: repl, error: replErr } = await supabase
        .from('products')
        .select('id, is_active, stock_status')
        .eq('id', form.replacement_product_id)
        .maybeSingle();
      if (replErr || !repl) {
        notify.error('El producte substitut seleccionat no existeix.');
        return;
      }
      if (!repl.is_active) {
        notify.error('El producte substitut no està actiu.');
        return;
      }
      if (repl.stock_status === 'discontinued') {
        notify.error('El producte substitut també està descatalogat. Tria un altre.');
        return;
      }
    }


    try {
      await saveProduct.mutateAsync({ id: isNew ? undefined : id, data: form });
      notify.success(isNew ? 'Producte creat' : 'Producte actualitzat');
      navigate('/admin/productes');
    } catch (err: any) {
      notify.error(err.message || 'Error guardant producte');
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
          {!isNew && form.slug && (
            <Button
              type="button"
              variant="outline"
              className="gap-1"
              onClick={() => window.open(`/producte/${form.slug}`, '_blank', 'noopener,noreferrer')}
              title="Veure al catàleg"
            >
              <ExternalLink className="h-4 w-4" />
              Preview
            </Button>
          )}
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
          <LanguageTabs value={activeLang} onChange={setActiveLang}>
            {(lang) => {
              const tr = form.translations[lang] ?? emptyTranslation;
              const errs = translationErrors[lang] ?? {};
              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
                    <div className="text-xs text-muted-foreground">
                      {aiReady
                        ? "Genera amb IA: selecciona quins camps vols regenerar."
                        : "Configura un proveïdor d'IA per habilitar la generació amb IA."}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button" size="sm" variant="outline"
                        disabled={!aiReady || seoGenerating === lang || !(tr.name?.trim() || (form.translations[defaultCode]?.name?.trim()))}
                        onClick={() => generateSeoDescriptions(lang, ['short'])}
                        title="Genera només la descripció curta"
                      >
                        {seoGenerating === lang ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        IA: Curta
                      </Button>
                      <Button
                        type="button" size="sm" variant="outline"
                        disabled={!aiReady || seoGenerating === lang || !(tr.name?.trim() || (form.translations[defaultCode]?.name?.trim()))}
                        onClick={() => generateSeoDescriptions(lang, ['long'])}
                        title="Genera només la descripció llarga"
                      >
                        {seoGenerating === lang ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        IA: Llarga
                      </Button>
                      <Button
                        type="button" size="sm"
                        disabled={!aiReady || seoGenerating === lang || !(tr.name?.trim() || (form.translations[defaultCode]?.name?.trim()))}
                        onClick={() => generateSeoDescriptions(lang, ['short', 'long'])}
                      >
                        {seoGenerating === lang ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        Generar tot
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Nom *</Label>
                    <Input
                      value={tr.name}
                      onChange={e => updateTranslation(lang, 'name', e.target.value)}
                      onBlur={lang === defaultCode ? autoSlug : undefined}
                      placeholder={`Nom (${lang.toUpperCase()})`}
                      maxLength={MAX_NAME}
                      aria-invalid={!!errs.name}
                      className={cn(errs.name && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <div className="flex justify-between mt-1">
                      {errs.name ? (
                        <p className="text-[11px] text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errs.name}
                        </p>
                      ) : <span />}
                      <span className="text-[11px] text-muted-foreground">{tr.name.length}/{MAX_NAME}</span>
                    </div>
                  </div>
                  <SlugInput
                    label={`Slug (${lang.toUpperCase()})`}
                    value={(tr as any).slug || ''}
                    onChange={(next) => updateTranslation(lang, 'slug', next)}
                    placeholder="es-generara-automaticament-des-del-nom"
                    hint="S'omple automàticament des del nom. Edita per personalitzar l'URL SEO en aquest idioma."
                    externalError={slugDupErrors[lang] ?? null}
                  />

                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Descripció curta</Label>
                      <Button
                        type="button" size="sm" variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={!aiReady || seoGenerating === lang || !(tr.name?.trim() || (form.translations[defaultCode]?.name?.trim()))}
                        onClick={() => generateSeoDescriptions(lang, ['short'])}
                        title="Regenera només aquest camp amb IA"
                      >
                        {seoGenerating === lang ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        IA
                      </Button>
                    </div>


                    <RichTextEditor
                      value={tr.short_description || ''}
                      onChange={(html) => updateTranslation(lang, 'short_description', html)}
                      placeholder="Descripció curta (admet HTML / format ric)"
                      className={cn(errs.short_description && 'border-destructive')}
                    />
                    <div className="flex justify-between mt-1">
                      {errs.short_description ? (
                        <p className="text-[11px] text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errs.short_description}
                        </p>
                      ) : <span />}
                      <span className="text-[11px] text-muted-foreground">{(tr.short_description || '').length}/{MAX_SHORT}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Descripció</Label>
                      <Button
                        type="button" size="sm" variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={!aiReady || seoGenerating === lang || !(tr.name?.trim() || (form.translations[defaultCode]?.name?.trim()))}
                        onClick={() => generateSeoDescriptions(lang, ['long'])}
                        title="Regenera només aquest camp amb IA"
                      >
                        {seoGenerating === lang ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        IA
                      </Button>
                    </div>
                    <RichTextEditor
                      value={tr.description || ''}
                      onChange={(html) => updateTranslation(lang, 'description', html)}
                      placeholder="Descripció llarga (admet HTML / format ric)"
                      className={cn(errs.description && 'border-destructive')}
                    />
                    <div className="flex justify-between mt-1">
                      {errs.description ? (
                        <p className="text-[11px] text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errs.description}
                        </p>
                      ) : <span />}
                      <span className="text-[11px] text-muted-foreground">{(tr.description || '').length}/{MAX_DESC}</span>
                    </div>
                  </div>
                </div>
              );
            }}
          </LanguageTabs>
        </CardContent>
      </Card>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle>Informació bàsica</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <SlugInput
            label="Slug base"
            value={form.slug}
            onChange={(next) => updateField('slug', next)}
            placeholder="Es generarà automàticament en desar"
            hint="S'omple sol des del nom de l'idioma per defecte si el deixes buit."
            externalError={slugDupErrors.base ?? null}
          />


          <div>
            <Label>SKU *</Label>
            <Input value={form.sku} onChange={e => updateField('sku', e.target.value)} />
          </div>
          <div>
            <Label>Preu sense IVA (€) *</Label>
            <Input type="number" step="0.01" min="0" value={form.base_price}
              onChange={e => updateField('base_price', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Tipus impositiu</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.tax_rate_id || ''} onChange={e => updateField('tax_rate_id', e.target.value || null)}>
              <option value="">— Cap —</option>
              {taxRates.map(tr => <option key={tr.id} value={tr.id}>{tr.name} ({tr.percentage}%)</option>)}
            </select>
          </div>
          {(() => {
            const selectedTax = taxRates.find(tr => tr.id === form.tax_rate_id);
            const taxPct = selectedTax?.percentage ?? 0;
            const pvp = Math.round(priceWithTax(form.base_price, taxPct) * 100) / 100;
            return (
              <>
                <div>
                  <Label>Preu amb IVA (€) *</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={pvp}
                    onChange={e => {
                      const gross = parseFloat(e.target.value) || 0;
                      const net = taxPct > 0 ? gross / (1 + taxPct / 100) : gross;
                      updateField('base_price', Math.round(net * 10000) / 10000);
                    }}
                  />
                </div>
                <div className="sm:col-span-2 p-3 rounded-lg bg-muted/50 text-sm">
                  <span className="text-muted-foreground">Preus sincronitzats — </span>
                  <span className="font-semibold">{form.base_price.toFixed(4)} €</span>
                  <span className="text-muted-foreground"> sense IVA · </span>
                  <span className="font-semibold">{pvp.toFixed(2)} €</span>
                  <span className="text-muted-foreground"> amb IVA</span>
                  {selectedTax && <span className="text-muted-foreground ml-2">({selectedTax.name} {selectedTax.percentage}%)</span>}
                </div>
              </>
            );
          })()}
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
              <option value="discontinued">Descatalogat</option>
            </select>
            {form.stock_status === 'discontinued' && (
              <div className="mt-3">
                <ReplacementProductPicker
                  excludeId={id}
                  value={form.replacement_product_id}
                  onChange={(rid) => updateField('replacement_product_id', rid)}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={form.is_active} onCheckedChange={v => updateField('is_active', v)} />
            <Label>Producte actiu</Label>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={form.is_featured} onCheckedChange={v => updateField('is_featured', v)} />
            <Label className="flex items-center gap-1">
              <Star className={cn('h-4 w-4', form.is_featured && 'fill-yellow-400 text-yellow-500')} />
              Producte destacat (apareix a portada)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Sale price */}
      <Card>
        <CardHeader><CardTitle>Preu en oferta</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Tipus d'oferta</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.sale_price_type ?? ''}
              onChange={e => updateField('sale_price_type', (e.target.value || null) as any)}
            >
              <option value="">— Sense oferta —</option>
              <option value="fixed">Preu fix (€)</option>
              <option value="percent">Percentatge (%)</option>
            </select>
          </div>
          <div>
            <Label>
              Valor {form.sale_price_type === 'percent' ? '(%)' : '(€, IVA inclòs)'}
            </Label>
            {(() => {
              const selectedTax = taxRates.find(tr => tr.id === form.tax_rate_id);
              const taxPct = selectedTax?.percentage ?? 0;
              const isFixed = form.sale_price_type === 'fixed';
              const displayed = isFixed && form.sale_value != null
                ? Math.round(form.sale_value * (1 + taxPct / 100) * 100) / 100
                : (form.sale_value ?? '');
              return (
                <Input
                  type="number" step="0.01" min="0"
                  max={form.sale_price_type === 'percent' ? 100 : undefined}
                  disabled={!form.sale_price_type}
                  value={displayed}
                  onChange={e => {
                    const raw = e.target.value ? parseFloat(e.target.value) : null;
                    if (raw == null) { updateField('sale_value', null); return; }
                    if (isFixed) {
                      // Stored as net (sale_value); the trigger will sync sale_value_with_tax = raw.
                      const net = taxPct > 0 ? raw / (1 + taxPct / 100) : raw;
                      updateField('sale_value', Math.round(net * 10000) / 10000);
                    } else {
                      updateField('sale_value', raw);
                    }
                  }}
                  placeholder={form.sale_price_type === 'percent' ? 'ex: 15' : 'ex: 19.99'}
                />
              );
            })()}
          </div>
          <div>
            <Label>Inici (opcional)</Label>
            <Input
              type="datetime-local"
              disabled={!form.sale_price_type}
              value={form.sale_starts_at ? form.sale_starts_at.slice(0, 16) : ''}
              onChange={e => updateField('sale_starts_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </div>
          <div>
            <Label>Fi (opcional)</Label>
            <Input
              type="datetime-local"
              disabled={!form.sale_price_type}
              value={form.sale_ends_at ? form.sale_ends_at.slice(0, 16) : ''}
              onChange={e => updateField('sale_ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </div>
          {form.sale_price_type && form.sale_value != null && form.base_price > 0 && (() => {
            const base = form.base_price;
            const final = form.sale_price_type === 'percent'
              ? base * (1 - Math.max(0, Math.min(100, form.sale_value)) / 100)
              : Math.max(0, form.sale_value);
            const pct = base > 0 ? Math.round((1 - final / base) * 100) : 0;
            const invalid = final >= base;
            return (
              <div className={cn(
                "sm:col-span-2 p-3 rounded-lg text-sm",
                invalid ? "bg-destructive/10 text-destructive" : "bg-muted/50"
              )}>
                <span className="text-muted-foreground">Preu resultant (sense IVA): </span>
                <span className="font-bold">{final.toFixed(2)} €</span>
                {!invalid && <span className="ml-2 text-muted-foreground">(estalvi {pct}% sobre {base.toFixed(2)} €)</span>}
                {invalid && <span className="ml-2">⚠ El preu oferta ha de ser inferior al preu base</span>}
              </div>
            );
          })()}
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
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={v.variant_type_id} onChange={e => updateVariant(i, 'variant_type_id', e.target.value)}>
                      <option value="">— Selecciona —</option>
                      {variantTypes.map((vt: any) => {
                        const name = vt.variant_type_translations?.find((t: any) => t.language === 'ca')?.name || vt.slug;
                        return <option key={vt.id} value={vt.id}>{name}</option>;
                      })}
                    </select>
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
                    <Label className="text-xs" title="Si la variant no té preu fix, aquest valor (positiu o negatiu) se suma al preu base">
                      Modificador (±€)
                    </Label>
                    <Input
                      type="number" step="0.01"
                      value={v.price_modifier ?? 0}
                      onChange={e => updateVariant(i, 'price_modifier', e.target.value ? parseFloat(e.target.value) : 0)}
                      placeholder="0"
                      disabled={v.price_override != null}
                    />
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

      {/* Upsell — shown on product page + in cart pop-up */}
      <RelatedProductsEditor
        productId={isNew ? undefined : id}
        value={form.related_product_ids}
        onChange={(ids) => updateField('related_product_ids', ids)}
        title="Productes UP-SELL (pop-up i fitxa de producte)"
        description="Es mostraran a la fitxa del producte (bloc 'Productes relacionats...') i en un pop-up quan el client afegeixi aquest producte a la cistella."
      />

      {/* Cross-sell — shown only on product page */}
      <RelatedProductsEditor
        productId={isNew ? undefined : id}
        value={form.cross_sell_product_ids}
        onChange={(ids) => updateField('cross_sell_product_ids', ids)}
        title="Productes CROSS-SELL (només fitxa de producte)"
        description="Es mostraran només a la fitxa del producte (bloc 'Productes que et poden interessar...'). No apareixen al pop-up."
      />

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
