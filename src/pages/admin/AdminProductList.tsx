import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, X, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminProducts, useDeleteProduct } from '@/hooks/useAdminProducts';
import { useCategories } from '@/hooks/useCategories';
import { useDefaultListSections, pickSectionName } from '@/hooks/useDefaultListSections';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';


const AdminProductList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const { data: products, isLoading } = useAdminProducts();
  const { data: categories = [] } = useCategories();
  const { data: sections = [] } = useDefaultListSections({ onlyActive: false });
  const deleteProduct = useDeleteProduct();
  const qc = useQueryClient();
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('products').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      notify.success(
        vars.is_active ? 'Producte restaurat' : 'Producte arxivat',
        {
          description: vars.is_active
            ? 'Torna a estar visible al catàleg públic.'
            : 'Ja no apareix al catàleg, però es manté a l\'historial.',
        },
      );
    },
    onError: (e: any) =>
      notify.error('No s\'ha pogut actualitzar l\'estat', {
        description: e?.message || 'Torna-ho a provar més tard.',
      }),
  });


  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all'); // catalog family
  const [sectionFilter, setSectionFilter] = useState<string>('all');   // list family
  const [stockFilter, setStockFilter] = useState<string>('all');       // availability
  const [activeFilter, setActiveFilter] = useState<string>('all');     // active flag

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach(c => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const sectionMap = useMemo(() => {
    const m = new Map<string, string>();
    sections.forEach(s => m.set(s.id, pickSectionName(s, lang)));
    return m;
  }, [sections, lang]);

  const filtered = (products || []).filter(p => {
    if (search) {
      const s = search.toLowerCase();
      const name = p.product_translations.find(t => t.language === lang)?.name || '';
      if (!name.toLowerCase().includes(s) && !p.sku.toLowerCase().includes(s) && !p.slug.toLowerCase().includes(s)) {
        return false;
      }
    }
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'none') { if (p.category_id) return false; }
      else if (p.category_id !== categoryFilter) return false;
    }
    if (sectionFilter !== 'all') {
      if (sectionFilter === 'none') { if (p.default_section_id) return false; }
      else if (p.default_section_id !== sectionFilter) return false;
    }
    if (stockFilter !== 'all' && p.stock_status !== stockFilter) return false;
    if (activeFilter === 'active' && !p.is_active) return false;
    if (activeFilter === 'inactive' && p.is_active) return false;
    return true;
  });

  const hasActiveFilters =
    !!search || categoryFilter !== 'all' || sectionFilter !== 'all' ||
    stockFilter !== 'all' || activeFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setSectionFilter('all');
    setStockFilter('all');
    setActiveFilter('all');
  };

  const getName = (p: typeof filtered[0]) =>
    p.product_translations.find(t => t.language === lang)?.name || p.slug;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(price);

  const stockBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      in_stock: { label: t('products.inStock'), variant: 'default' },
      on_order: { label: t('products.onOrder'), variant: 'secondary' },
      out_of_stock: { label: t('products.outOfStock'), variant: 'destructive' },
      discontinued: { label: lang === 'es' ? 'Descatalogado' : 'Descatalogat', variant: 'destructive' },
    };
    const info = map[status] || map.in_stock;
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const selectCls =
    'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">{t('admin.products')}</h1>
        <Link to="/admin/productes/nou">
          <Button className="gap-1">
            <Plus className="h-4 w-4" />
            {t('common.create')}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-md border bg-card p-3 sm:p-4 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">
              {lang === 'es' ? 'Familia del catálogo' : 'Família del catàleg'}
            </Label>
            <select className={selectCls} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">{lang === 'es' ? 'Todas' : 'Totes'}</option>
              <option value="none">{lang === 'es' ? '— Sin categoría —' : '— Sense categoria —'}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              {lang === 'es' ? 'Familia de la lista' : 'Família de la llista'}
            </Label>
            <select className={selectCls} value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
              <option value="all">{lang === 'es' ? 'Todas' : 'Totes'}</option>
              <option value="none">{lang === 'es' ? '— Sin familia —' : '— Sense família —'}</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{pickSectionName(s, lang)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('products.availability')}</Label>
            <select className={selectCls} value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
              <option value="all">{lang === 'es' ? 'Todas' : 'Totes'}</option>
              <option value="in_stock">{t('products.inStock')}</option>
              <option value="on_order">{t('products.onOrder')}</option>
              <option value="out_of_stock">{t('products.outOfStock')}</option>
              <option value="discontinued">{lang === 'es' ? 'Descatalogado' : 'Descatalogat'}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{lang === 'es' ? 'Estado' : 'Estat'}</Label>
            <select className={selectCls} value={activeFilter} onChange={e => setActiveFilter(e.target.value)}>
              <option value="all">{lang === 'es' ? 'Todos' : 'Tots'}</option>
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
            </select>
          </div>
        </div>
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {filtered.length} {lang === 'es' ? 'resultados' : 'resultats'}
            </span>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3.5 w-3.5" />
              {lang === 'es' ? 'Limpiar filtros' : 'Esborrar filtres'}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>{t('admin.products')}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>{lang === 'es' ? 'Familia del catálogo' : 'Família del catàleg'}</TableHead>
                <TableHead>{lang === 'es' ? 'Familia de la lista' : 'Família de la llista'}</TableHead>
                <TableHead>{t('products.price')}</TableHead>
                <TableHead className="text-center">{t('admin.stockUnits')}</TableHead>
                <TableHead>{t('products.availability')}</TableHead>
                <TableHead className="text-center">{t('common.active')}</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {t('common.noResults')}
                  </TableCell>
                </TableRow>
              ) : filtered.map(p => {
                const img = p.product_images.find(i => i.is_primary) || p.product_images[0];
                const variantStock = (p.product_variants || []).reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0);
                const totalStock = variantStock > 0 ? variantStock : (p.stock_quantity || 0);
                const catName = p.category_id ? categoryMap.get(p.category_id) : null;
                const secName = p.default_section_id ? sectionMap.get(p.default_section_id) : null;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      {img ? (
                        <img src={img.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to={`/admin/productes/${p.id}`} className="font-medium hover:underline">
                        {getName(p)}
                      </Link>
                      {p.brands && <span className="block text-xs text-muted-foreground">{p.brands.name}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.sku}</TableCell>
                    <TableCell className="text-sm">
                      {catName ? (
                        <Badge variant="outline">{catName}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {secName ? (
                        <Badge variant="outline">{secName}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{formatPrice(p.base_price)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-medium ${totalStock === 0 ? 'text-destructive' : totalStock < 5 ? 'text-amber-600' : 'text-foreground'}`}>
                        {totalStock}
                      </span>
                    </TableCell>
                    <TableCell>{stockBadge(p.stock_status)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.is_active ? 'default' : 'secondary'}>
                        {p.is_active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link to={`/admin/productes/${p.id}`}>
                          <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={p.is_active ? 'Arxivar (desactivar)' : 'Restaurar (activar)'}
                              disabled={toggleActive.isPending}
                            >
                              {p.is_active
                                ? <Archive className="h-4 w-4 text-amber-600" />
                                : <ArchiveRestore className="h-4 w-4 text-emerald-600" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {p.is_active
                                  ? `Arxivar "${getName(p)}"?`
                                  : `Restaurar "${getName(p)}"?`}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {p.is_active
                                  ? 'El producte deixarà d\'aparèixer al catàleg públic i a les llistes de naixement, però es conservarà al panell d\'administració i a l\'historial de comandes. Podràs restaurar-lo en qualsevol moment.'
                                  : 'El producte tornarà a ser visible al catàleg públic i podrà afegir-se a noves llistes i comandes.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => toggleActive.mutate({ id: p.id, is_active: !p.is_active })}
                                className={p.is_active
                                  ? 'bg-amber-600 text-white hover:bg-amber-600/90'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-600/90'}
                              >
                                {p.is_active ? 'Arxivar' : 'Restaurar'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Eliminar definitivament"
                              disabled={deleteProduct.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar definitivament "{getName(p)}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Aquesta acció no es pot desfer. El producte s'eliminarà del catàleg i de les llistes actives.
                                L'historial de comandes es manté intacte (nom, SKU i preu queden desats com a snapshot).
                                <br /><br />
                                Si el producte té vendes, et recomanem fer servir <strong>Arxivar</strong> en lloc d'eliminar.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteProduct.mutate(p.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar definitivament
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AdminProductList;
