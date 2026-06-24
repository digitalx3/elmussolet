import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Save, Loader2, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguages } from '@/hooks/useLanguages';
import LanguageTabs from '@/components/admin/LanguageTabs';
import AdminDefaultListSections from '@/pages/admin/AdminDefaultListSections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ProductTranslation {
  language: string;
  name: string;
  short_description: string | null;
  description?: string | null;
}

interface ProductRow {
  id: string;
  slug: string;
  base_price: number;
  product_translations: ProductTranslation[];
}

type DraftMap = Record<string, Record<string, { name: string; short_description: string; description: string }>>;

const PAGE_SIZE = 25;

const ProductsTranslationsPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: languages = [] } = useLanguages({ onlyEnabled: true });
  const lang = (i18n.language || 'ca').slice(0, 2);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-translations-products', { search, page }],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('id, slug, base_price, product_translations(language, name, short_description, description)', { count: 'exact' })
        .order('slug', { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (search.trim()) q = q.ilike('slug', `%${search.trim().toLowerCase()}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as ProductRow[], total: count ?? 0 };
    },
  });

  const products = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const getDraft = (p: ProductRow, code: string) => {
    const existing = drafts[p.id]?.[code];
    if (existing) return existing;
    const tr = p.product_translations.find(x => x.language === code);
    return {
      name: tr?.name ?? '',
      short_description: tr?.short_description ?? '',
      description: tr?.description ?? '',
    };
  };

  const updateDraft = (
    productId: string,
    code: string,
    field: 'name' | 'short_description' | 'description',
    value: string,
  ) => {
    setDrafts(d => ({
      ...d,
      [productId]: {
        ...(d[productId] || {}),
        [code]: { ...(d[productId]?.[code] || { name: '', short_description: '', description: '' }), [field]: value },
      },
    }));
  };

  const saveProduct = async (p: ProductRow) => {
    setSavingId(p.id);
    try {
      const productDrafts = drafts[p.id] || {};
      const rows: Array<{ product_id: string; language: string; name: string; short_description: string | null; description: string | null }> = [];
      const deletes: string[] = [];

      languages.forEach(l => {
        const cur = productDrafts[l.code] ?? (() => {
          const tr = p.product_translations.find(x => x.language === l.code);
          return tr ? { name: tr.name, short_description: tr.short_description ?? '', description: tr.description ?? '' } : null;
        })();
        if (!cur) return;
        const name = cur.name.trim();
        if (name) {
          rows.push({
            product_id: p.id,
            language: l.code,
            name,
            short_description: cur.short_description.trim() || null,
            description: cur.description.trim() || null,
          });
        } else if (p.product_translations.some(x => x.language === l.code)) {
          deletes.push(l.code);
        }
      });

      if (rows.length > 0) {
        const { error } = await supabase
          .from('product_translations')
          .upsert(rows, { onConflict: 'product_id,language' });
        if (error) throw error;
      }
      if (deletes.length > 0) {
        const { error } = await supabase
          .from('product_translations')
          .delete()
          .eq('product_id', p.id)
          .in('language', deletes);
        if (error) throw error;
      }

      setDrafts(d => { const { [p.id]: _, ...rest } = d; return rest; });
      await qc.invalidateQueries({ queryKey: ['admin-translations-products'] });
      toast({ title: t('common.success', 'Desat correctament') });
    } catch (e: any) {
      toast({ title: e.message || 'Error', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('admin.searchBySlug', 'Buscar per slug…')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-8"
          />
        </div>
        <div className="text-xs text-muted-foreground">{total} {t('admin.products', 'productes')}</div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {t('admin.noResults', 'Sense resultats')}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => {
            const primary = p.product_translations.find(x => x.language === lang)
              || p.product_translations[0];
            const dirty = !!drafts[p.id];
            const filledLangs = languages.filter(l => {
              const d = drafts[p.id]?.[l.code];
              if (d) return d.name.trim().length > 0;
              return p.product_translations.some(x => x.language === l.code && x.name);
            });
            return (
              <Card key={p.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{primary?.name || p.slug}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{p.slug}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {languages.map(l => (
                          <Badge
                            key={l.code}
                            variant={filledLangs.find(f => f.code === l.code) ? 'default' : 'outline'}
                            className="text-[10px] uppercase font-mono"
                          >
                            {l.code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => saveProduct(p)}
                      disabled={!dirty || savingId === p.id}
                      className="gap-1"
                    >
                      {savingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {t('common.save')}
                    </Button>
                  </div>

                  <LanguageTabs>
                    {(code) => {
                      const cur = getDraft(p, code);
                      return (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">{t('admin.name', 'Nom')}</Label>
                            <Input
                              value={cur.name}
                              onChange={e => updateDraft(p.id, code, 'name', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('admin.shortDescription', 'Descripció curta')}</Label>
                            <Textarea
                              rows={2}
                              value={cur.short_description}
                              onChange={e => updateDraft(p.id, code, 'short_description', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('admin.description', 'Descripció')}</Label>
                            <Textarea
                              rows={4}
                              value={cur.description}
                              onChange={e => updateDraft(p.id, code, 'description', e.target.value)}
                            />
                          </div>
                        </div>
                      );
                    }}
                  </LanguageTabs>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            {t('common.previous', 'Anterior')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            {t('common.next', 'Següent')}
          </Button>
        </div>
      )}
    </div>
  );
};

const AdminTranslations: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Globe className="h-6 w-6" /> {t('admin.translationsTitle', 'Traduccions')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('admin.translationsDesc', 'Edita els textos traduïbles del catàleg i les famílies per defecte des d’un sol lloc.')}
        </p>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">{t('admin.products', 'Productes')}</TabsTrigger>
          <TabsTrigger value="defaultSections">{t('admin.defaultSectionsTitle', 'Famílies per defecte')}</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-0">
          <ProductsTranslationsPanel />
        </TabsContent>
        <TabsContent value="defaultSections" className="mt-0">
          <AdminDefaultListSections />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminTranslations;
