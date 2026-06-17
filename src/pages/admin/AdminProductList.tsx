import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminProducts, useDeleteProduct } from '@/hooks/useAdminProducts';

const AdminProductList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const { data: products, isLoading } = useAdminProducts();
  const deleteProduct = useDeleteProduct();
  const [search, setSearch] = useState('');

  const filtered = (products || []).filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    const name = p.product_translations.find(t => t.language === lang)?.name || '';
    return name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.slug.toLowerCase().includes(s);
  });

  const getName = (p: typeof filtered[0]) =>
    p.product_translations.find(t => t.language === lang)?.name || p.slug;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(price);

  const stockBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      in_stock: { label: t('products.inStock'), variant: 'default' },
      on_order: { label: t('products.onOrder'), variant: 'secondary' },
      out_of_stock: { label: t('products.outOfStock'), variant: 'destructive' },
    };
    const info = map[status] || map.in_stock;
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

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

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('common.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>{t('admin.products')}</TableHead>
                <TableHead>SKU</TableHead>
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('common.noResults')}
                  </TableCell>
                </TableRow>
              ) : filtered.map(p => {
                const img = p.product_images.find(i => i.is_primary) || p.product_images[0];
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
                    <TableCell className="font-medium">{formatPrice(p.base_price)}</TableCell>
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
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('common.delete')} "{getName(p)}"?</AlertDialogTitle>
                              <AlertDialogDescription>Aquesta acció no es pot desfer.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteProduct.mutate(p.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t('common.delete')}
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
