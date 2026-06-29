import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrderStatuses } from '@/hooks/useOrderStatuses';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Search, Eye, X, Pencil, Trash2, Plus, Check, Ban, History, Printer } from 'lucide-react';
import { notify } from '@/lib/notify';
import { format } from 'date-fns';
import { ca, es } from 'date-fns/locale';
import { printDeliveryNote } from '@/lib/printDeliveryNote';

interface OrderRow {
  id: string;
  order_number: string;
  status: string | null;
  payment_method: string | null;
  delivery_method: string | null;
  subtotal: number;
  tax_amount: number | null;
  shipping_cost: number | null;
  total: number;
  notes: string | null;
  shipping_address: any;
  created_at: string;
  customer_id: string;
  customers: { id: string; full_name: string | null; email: string | null } | null;
}

// Derive payment state from the order status. Anything past "pending"
// (and not cancelled/failed) is considered paid.
const isOrderPaid = (status: string | null | undefined) =>
  !!status && !['pending', 'cancelled', 'failed'].includes(status);
const isOrderPendingPayment = (status: string | null | undefined) =>
  !status || status === 'pending' || status === 'failed';


interface OrderItemRow {
  id: string;
  quantity: number;
  unit_price: number;
  base_unit_price: number | null;
  tax_percentage: number | null;
  tax_amount: number | null;
  total_price: number;
  product_id: string;
  variant_id: string | null;
  products: { product_translations: { name: string; language: string }[] } | null;
  product_variants: { value: string; variant_type_id: string } | null;
}

const AdminOrders: React.FC = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const lang = i18n.language;
  const dateFnsLocale = lang === 'ca' ? ca : es;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);

  // Site settings for delivery note header (logo + fiscal data)
  const { data: siteSettings } = useQuery({
    queryKey: ['site-settings-delivery-note'],
    queryFn: async () => {
      const keys = ['store_name', 'store_nif', 'store_address', 'store_email', 'store_phone', 'logo_header_url'];
      const { data } = await supabase.from('site_settings').select('key, value').in('key', keys);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value || ''; });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditDetail, setAuditDetail] = useState<any | null>(null);

  const isEditable = !!selectedOrder && !isOrderPaid(selectedOrder.status);

  const { data: orderStatuses = [] } = useOrderStatuses();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, customers(id, full_name, email)')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OrderRow[];
    },
  });

  const { data: orderItems = [] } = useQuery({
    queryKey: ['admin-order-items', selectedOrder?.id],
    enabled: !!selectedOrder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*, products(product_translations(name, language)), product_variants(value, variant_type_id)')
        .eq('order_id', selectedOrder!.id);
      if (error) throw error;
      return data as unknown as OrderItemRow[];
    },
  });

  const { data: stockMovements = [] } = useQuery({
    queryKey: ['admin-stock-movements', selectedOrder?.id],
    enabled: !!selectedOrder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, created_at, delta, reason, product_id, variant_id, list_item_id, order_item_id, actor, products(product_translations(name, language)), product_variants(value)')
        .eq('order_id', selectedOrder!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: auditLog = [], isLoading: auditLoading } = useQuery({
    queryKey: ['admin-order-deletion-audit'],
    enabled: auditOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_deletion_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });




  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;

      // Trigger email notification
      try {
        await supabase.functions.invoke('send-order-status-email', {
          body: { order_id: id, new_status: status },
        });
      } catch (e) {
        console.warn('Email notification failed:', e);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      notify.success(t('admin.orderStatusUpdated'));
    },
    onError: (e: any) => notify.error(e.message),
  });




  const recomputeOrderTotals = async (orderId: string) => {
    const { data: items, error } = await supabase
      .from('order_items')
      .select('quantity, base_unit_price, unit_price, tax_amount')
      .eq('order_id', orderId);
    if (error) throw error;
    const subtotal = (items || []).reduce((s, it: any) => s + Number(it.base_unit_price ?? it.unit_price ?? 0) * Number(it.quantity), 0);
    const tax_amount = (items || []).reduce((s, it: any) => s + Number(it.tax_amount ?? 0), 0);
    const { data: ord, error: ordErr } = await supabase
      .from('orders').select('shipping_cost').eq('id', orderId).single();
    if (ordErr) throw ordErr;
    const shipping = Number(ord?.shipping_cost ?? 0);
    const total = subtotal + tax_amount + shipping;
    const { error: upErr } = await supabase.from('orders')
      .update({ subtotal, tax_amount, total })
      .eq('id', orderId);
    if (upErr) throw upErr;
    // refresh local selected order with new totals
    setSelectedOrder(prev => prev ? { ...prev, subtotal, tax_amount, total } : prev);
  };

  const updateItemQtyMutation = useMutation({
    mutationFn: async ({ item, quantity }: { item: OrderItemRow; quantity: number }) => {
      if (quantity < 1) throw new Error('Quantity must be >= 1');
      const basePrice = Number(item.base_unit_price ?? item.unit_price);
      const taxPct = Number(item.tax_percentage ?? 0);
      const taxAmount = basePrice * quantity * (taxPct / 100);
      const totalPrice = basePrice * quantity + taxAmount;
      const { error } = await supabase.from('order_items').update({
        quantity,
        tax_amount: taxAmount,
        total_price: totalPrice,
      }).eq('id', item.id);
      if (error) throw error;
      await recomputeOrderTotals(selectedOrder!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order-items', selectedOrder?.id] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      notify.success(t('common.success'));
    },
    onError: (e: any) => notify.error(e.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (item: OrderItemRow) => {
      const { error } = await supabase.from('order_items').delete().eq('id', item.id);
      if (error) throw error;
      await recomputeOrderTotals(selectedOrder!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order-items', selectedOrder?.id] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      notify.success(t('common.success'));
    },
    onError: (e: any) => notify.error(e.message),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // 1) Snapshot order + items before deletion (for audit trail).
      const { data: orderSnap, error: snapErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (snapErr) throw snapErr;

      const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      if (itemsErr) throw itemsErr;

      const itemsList = items || [];
      const listItemsAffected = new Set(
        itemsList.filter(i => i.list_item_id).map(i => i.list_item_id as string)
      ).size;

      // 2) Delete items one-by-one so the order_items_stock_trigger fires
      //    and restores stock / unlocks list_items.
      for (const it of itemsList) {
        const { error: delErr } = await supabase
          .from('order_items')
          .delete()
          .eq('id', it.id);
        if (delErr) throw delErr;
      }

      // 3) Count audit-worthy stock_movements generated by the deletion.
      const { count: stockCount } = await supabase
        .from('stock_movements')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', orderId)
        .eq('reason', 'order_item_delete');

      // 4) Delete the order itself.
      const { error: ordErr } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      if (ordErr) throw ordErr;

      // 5) Record audit entry.
      const { data: auth } = await supabase.auth.getUser();
      const actor = auth?.user;
      const { error: auditErr } = await supabase
        .from('order_deletion_audit')
        .insert({
          order_id: orderId,
          order_number: orderSnap?.order_number ?? null,
          order_status: orderSnap?.status ?? null,
          payment_status: orderSnap?.payment_status ?? null,
          list_id: orderSnap?.list_id ?? null,
          user_id: null,
          total: orderSnap?.total ?? null,
          order_items_deleted: itemsList.length,
          stock_movements_created: stockCount ?? 0,
          list_items_affected: listItemsAffected,
          order_snapshot: orderSnap as any,
          items_snapshot: itemsList as any,
          deleted_by: actor?.id ?? null,
          deleted_by_email: actor?.email ?? null,
        });
      if (auditErr) console.warn('Audit log failed:', auditErr.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order-items'] });
      qc.invalidateQueries({ queryKey: ['admin-stock-movements'] });
      qc.invalidateQueries({ queryKey: ['admin-order-deletion-audit'] });
      setSelectedOrder(null);
      setEditing(false);
      notify.success(t('admin.orderDeleted', 'Comanda eliminada i estoc alliberat'));
    },
    onError: (e: any) => notify.error(e.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async (product: any) => {
      if (!selectedOrder) return;
      const basePrice = Number(product.base_price ?? 0);
      const taxPct = Number(product.tax_rates?.percentage ?? 0);
      const quantity = 1;
      const taxAmount = basePrice * quantity * (taxPct / 100);
      const totalPrice = basePrice * quantity + taxAmount;
      const unitPrice = basePrice * (1 + taxPct / 100);
      const { error } = await supabase.from('order_items').insert({
        order_id: selectedOrder.id,
        product_id: product.id,
        variant_id: null,
        quantity,
        unit_price: unitPrice,
        base_unit_price: basePrice,
        tax_percentage: taxPct,
        tax_amount: taxAmount,
        total_price: totalPrice,
      });
      if (error) throw error;
      await recomputeOrderTotals(selectedOrder.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order-items', selectedOrder?.id] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      setProductSearch('');
      setProductResults([]);
      notify.success(t('common.success'));
    },
    onError: (e: any) => notify.error(e.message),
  });

  const handleProductSearch = async (q: string) => {
    setProductSearch(q);
    if (q.trim().length < 2) {
      setProductResults([]);
      return;
    }
    const { data } = await supabase
      .from('products')
      .select('id, slug, base_price, product_translations(name, language), tax_rates(percentage)')
      .eq('is_active', true)
      .limit(8);
    const lower = q.toLowerCase();
    const filtered = (data || []).filter((p: any) => {
      const names = (p.product_translations || []).map((tr: any) => tr.name?.toLowerCase() || '');
      return names.some((n: string) => n.includes(lower)) || p.slug?.toLowerCase().includes(lower);
    });
    setProductResults(filtered);
  };


  const filteredOrders = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(s) ||
      o.customers?.full_name?.toLowerCase().includes(s)
    );
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(price);

  const getProductName = (item: OrderItemRow) => {
    const translations = item.products?.product_translations || [];
    const tr = translations.find(t => t.language === lang) || translations[0];
    let name = tr?.name || '—';
    if (item.product_variants?.value) {
      name += ` (${item.product_variants.value})`;
    }
    return name;
  };

  const getStatusName = (statusSlug: string | null) => {
    if (!statusSlug) return '—';
    const found = orderStatuses.find(s => s.slug === statusSlug);
    return found?.name || statusSlug;
  };

  const getStatusColor = (statusSlug: string | null) => {
    if (!statusSlug) return '#6b7280';
    const found = orderStatuses.find(s => s.slug === statusSlug);
    return found?.color || '#6b7280';
  };

  const getPaymentLabel = (status: string) => t(`admin.payment_${status}`);

  const getDeliveryLabel = (method: string | null) => {
    if (!method) return '—';
    return t(`admin.delivery_${method}`, method);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">{t('admin.orders')}</h1>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setAuditOpen(true)}>
          <History className="h-4 w-4" />
          {t('admin.deletionAudit', 'Historial d\'eliminacions')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('admin.searchOrders')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {orderStatuses.map(s => (
              <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.orderNumber')}</TableHead>
              <TableHead>{t('admin.customer')}</TableHead>
              <TableHead>{t('admin.orderDate')}</TableHead>
              <TableHead>{t('admin.status')}</TableHead>
              
              <TableHead className="text-right">{t('admin.orderTotal')}</TableHead>
              <TableHead className="text-right">{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map(order => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-sm font-medium">{order.order_number}</TableCell>
                <TableCell>{order.customers?.full_name || '—'}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: dateFnsLocale })}
                </TableCell>
                <TableCell>
                  <Select
                    value={order.status || 'pending'}
                    onValueChange={status => updateStatusMutation.mutate({ id: order.id, status })}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <Badge
                        className="text-xs border text-white"
                        style={{ backgroundColor: getStatusColor(order.status) }}
                      >
                        {getStatusName(order.status || 'pending')}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {orderStatuses.map(s => (
                        <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right font-medium">{formatPrice(order.total)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title={t('admin.deleteOrder', 'Eliminar comanda')}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('admin.confirmDeleteOrderTitle', 'Eliminar comanda?')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('admin.confirmDeleteOrderDesc', 'S\'eliminarà la comanda {{n}} de manera permanent. L\'estoc dels productes es retornarà i, si pertany a una llista, els articles quedaran desbloquejats. Aquesta acció no es pot desfer.', { n: order.order_number })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deleteOrderMutation.isPending}>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={deleteOrderMutation.isPending}
                            onClick={() => deleteOrderMutation.mutate(order.id)}
                          >
                            {t('common.delete', 'Eliminar')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t('admin.noOrders')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(o) => { if (!o) { setSelectedOrder(null); setEditing(false); setProductSearch(''); setProductResults([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>{t('admin.orderDetail')} — {selectedOrder.order_number}</DialogTitle>
                <DialogDescription>
                  {format(new Date(selectedOrder.created_at), "d MMMM yyyy, HH:mm", { locale: dateFnsLocale })}
                </DialogDescription>
              </DialogHeader>

              <div className="flex justify-end gap-2 -mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    const lines = orderItems.map(it => ({
                      name: getProductName(it),
                      variant: it.product_variants?.value || null,
                      quantity: it.quantity,
                    }));
                    printDeliveryNote({
                      orderNumber: selectedOrder.order_number,
                      createdAt: selectedOrder.created_at,
                      customerName: selectedOrder.customers?.full_name || '',
                      shippingAddress: selectedOrder.shipping_address || null,
                      deliveryMethod: getDeliveryLabel(selectedOrder.delivery_method),
                      notes: selectedOrder.notes,
                      lines,
                      company: {
                        name: siteSettings?.store_name || 'El Mussolet',
                        nif: siteSettings?.store_nif || null,
                        address: siteSettings?.store_address || null,
                        email: siteSettings?.store_email || null,
                        phone: siteSettings?.store_phone || null,
                        logoUrl: siteSettings?.logo_header_url || null,
                      },
                      labels: {
                        title: t('admin.deliveryNoteTitle', 'Albarà'),
                        order: t('admin.orderNumber', 'Comanda'),
                        date: t('admin.date', 'Data'),
                        recipient: t('admin.recipient', 'Destinatari'),
                        shippingAddress: t('admin.shippingAddress'),
                        deliveryMethod: t('admin.deliveryMethod'),
                        notes: t('admin.notes'),
                        item: t('admin.item', 'Article'),
                        variant: t('admin.variant', 'Variant'),
                        quantity: t('admin.quantity', 'Quantitat'),
                        totalItems: t('admin.totalItems', 'Total articles'),
                        signature: t('admin.signature', 'Signatura'),
                        noPricesNotice: t(
                          'admin.deliveryNoteNoPrices',
                          'Document intern d\'enviament. No conté preus ni informació fiscal.',
                        ),
                        print: t('admin.print', 'Imprimir'),
                        downloadPdf: t('admin.downloadPdf', 'Descarregar PDF'),
                        close: t('admin.close', 'Tancar'),
                      },
                    });
                  }}
                >
                  <Printer className="h-3.5 w-3.5" />
                  {t('admin.printDeliveryNote', 'Imprimir albarà')}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1">
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('admin.deleteOrder', 'Eliminar comanda')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('admin.confirmDeleteOrderTitle', 'Eliminar comanda?')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('admin.confirmDeleteOrderDesc', 'S\'eliminarà la comanda {{n}} de manera permanent. L\'estoc dels productes es retornarà i, si pertany a una llista, els articles quedaran desbloquejats. Aquesta acció no es pot desfer.', { n: selectedOrder.order_number })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleteOrderMutation.isPending}>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deleteOrderMutation.isPending}
                        onClick={() => deleteOrderMutation.mutate(selectedOrder.id)}
                      >
                        {t('common.delete', 'Eliminar')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('admin.customer')}</p>
                  <p className="text-sm font-medium">{selectedOrder.customers?.full_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('admin.deliveryMethod')}</p>
                  <p className="text-sm font-medium">{getDeliveryLabel(selectedOrder.delivery_method)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('admin.paymentMethod')}</p>
                  <p className="text-sm font-medium">{selectedOrder.payment_method || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('admin.status')}</p>
                  <Badge className="text-xs border text-white" style={{ backgroundColor: getStatusColor(selectedOrder.status) }}>
                    {getStatusName(selectedOrder.status || 'pending')}
                  </Badge>
                </div>
              </div>

              {(() => {
                const status = selectedOrder.status || 'pending';
                const payment = selectedOrder.payment_status || 'pending';
                const canRelease = status !== 'cancelled' && (payment === 'pending' || payment === 'failed' || payment === 'refunded');
                if (!canRelease) return null;
                return (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex items-start justify-between gap-3">
                    <div className="text-xs text-amber-900">
                      <p className="font-semibold mb-0.5">
                        {t('admin.releaseBlockedTitle', 'Línies bloquejant estoc')}
                      </p>
                      <p>
                        {t('admin.releaseBlockedDesc', 'Cancel·la la comanda per alliberar l\'estoc reservat i desbloquejar els articles de la llista.')}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="gap-1 shrink-0">
                          <Ban className="h-3.5 w-3.5" />
                          {t('admin.cancelAndRelease', 'Cancel·lar i alliberar')}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('admin.confirmCancelTitle', 'Cancel·lar comanda?')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('admin.confirmCancelDesc', 'La comanda passarà a estat cancel·lada. L\'estoc i les reserves de la llista s\'alliberaran automàticament. Aquesta acció no es pot desfer.')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              updateStatusMutation.mutate(
                                { id: selectedOrder.id, status: 'cancelled' },
                                {
                                  onSuccess: async () => {
                                    const { data: fresh } = await supabase
                                      .from('orders')
                                      .select('*, customers(id, full_name, email)')
                                      .eq('id', selectedOrder.id)
                                      .single();
                                    if (fresh) setSelectedOrder(fresh as OrderRow);
                                    await Promise.all([
                                      qc.refetchQueries({ queryKey: ['admin-order-items', selectedOrder.id] }),
                                      qc.refetchQueries({ queryKey: ['admin-stock-movements', selectedOrder.id] }),
                                      qc.refetchQueries({ queryKey: ['admin-orders'] }),
                                    ]);
                                    notify.success(t('admin.stockReleased', 'Estoc alliberat'));
                                  },
                                }
                              );
                            }}
                          >
                            {t('admin.cancelAndRelease', 'Cancel·lar i alliberar')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })()}


              {selectedOrder.shipping_address && (
                <>
                  <Separator />
                  <div className="py-3">
                    <p className="text-xs text-muted-foreground mb-1">{t('admin.shippingAddress')}</p>
                    <p className="text-sm">
                      {selectedOrder.shipping_address.address_line1}
                      {selectedOrder.shipping_address.address_line2 && `, ${selectedOrder.shipping_address.address_line2}`}
                      <br />
                      {selectedOrder.shipping_address.postal_code} {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.province}
                    </p>
                  </div>
                </>
              )}

              {selectedOrder.notes && (
                <>
                  <Separator />
                  <div className="py-3">
                    <p className="text-xs text-muted-foreground mb-1">{t('admin.notes')}</p>
                    <p className="text-sm">{selectedOrder.notes}</p>
                  </div>
                </>
              )}

              <Separator />

              <div className="py-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">{t('admin.orderItems')}</p>
                  {isEditable ? (
                    <Button variant={editing ? 'default' : 'outline'} size="sm" onClick={() => setEditing(e => !e)} className="gap-1">
                      {editing ? <><Check className="h-3.5 w-3.5" />{t('common.done', 'Fet')}</> : <><Pencil className="h-3.5 w-3.5" />{t('common.edit')}</>}
                    </Button>
                  ) : (
                    selectedOrder.payment_status === 'paid' && (
                      <span className="text-xs text-muted-foreground italic">
                        {t('admin.orderPaidNoEdit', 'Comanda pagada · per modificar, crea una comanda nova')}
                      </span>
                    )
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('account.orderProduct')}</TableHead>
                      <TableHead className="text-center">{t('account.orderQty')}</TableHead>
                      <TableHead className="text-right">{t('account.orderBasePrice')}</TableHead>
                      <TableHead className="text-right">{t('account.orderTaxPct')}</TableHead>
                      <TableHead className="text-right">{t('account.orderTaxAmt')}</TableHead>
                      <TableHead className="text-right">{t('admin.orderTotal')}</TableHead>
                      {editing && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map(item => {
                      const orderStatus = selectedOrder.status || 'pending';
                      const paymentStatus = selectedOrder.payment_status || 'pending';
                      const isBlocking = orderStatus !== 'cancelled';
                      const isPendingPayment = paymentStatus === 'pending' || paymentStatus === 'failed';
                      const blockReason = isBlocking
                        ? (isPendingPayment
                            ? t('admin.stockBlockedPendingPayment', 'Estoc bloquejat per comanda pendent de pagament')
                            : t('admin.stockBlockedActiveOrder', 'Estoc bloquejat per comanda activa'))
                        : t('admin.stockReleasedCancelled', 'Estoc alliberat (comanda cancel·lada)');
                      return (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-1">
                            <span>{getProductName(item)}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                className={`text-[10px] border ${isBlocking ? (isPendingPayment ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-blue-100 text-blue-800 border-blue-200') : 'bg-gray-100 text-gray-700 border-gray-200'}`}
                                title={blockReason}
                              >
                                {isBlocking
                                  ? (isPendingPayment
                                      ? t('admin.blockedPendingPayment', 'Bloquejat · pagament pendent')
                                      : t('admin.blockedByOrder', 'Bloquejat per comanda'))
                                  : t('admin.released', 'Alliberat')}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {t('admin.orderStatusLabel', 'Estat')}: <span className="font-medium" style={{ color: getStatusColor(orderStatus) }}>{getStatusName(orderStatus)}</span>
                                {' · '}
                                {t('admin.paymentStatus')}: <span className="font-medium">{getPaymentLabel(paymentStatus)}</span>
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {editing ? (
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => {
                                const q = parseInt(e.target.value) || 1;
                                if (q !== item.quantity) updateItemQtyMutation.mutate({ item, quantity: q });
                              }}
                              className="w-16 h-8 text-center text-sm mx-auto"
                            />
                          ) : item.quantity}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatPrice(item.base_unit_price ?? item.unit_price)}</TableCell>
                        <TableCell className="text-right text-sm">{item.tax_percentage ?? 0}%</TableCell>
                        <TableCell className="text-right text-sm">{formatPrice(item.tax_amount ?? 0)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatPrice(item.total_price)}</TableCell>
                        {editing && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItemMutation.mutate(item)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {editing && (
                  <div className="mt-4 relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('admin.searchProductToAdd')}
                        value={productSearch}
                        onChange={e => handleProductSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {productResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-elevated max-h-48 overflow-y-auto">
                        {productResults.map((p: any) => {
                          const tr = p.product_translations?.find((t: any) => t.language === lang) || p.product_translations?.[0];
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted/50 flex justify-between items-center text-sm"
                              onClick={() => addItemMutation.mutate(p)}
                            >
                              <span className="flex items-center gap-2"><Plus className="h-3.5 w-3.5" />{tr?.name || p.slug}</span>
                              <span className="text-muted-foreground">{Number(p.base_price).toFixed(2)} €</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-1 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('cart.subtotal')}</span>
                  <span>{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IVA</span>
                  <span>{formatPrice(selectedOrder.tax_amount ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('cart.shipping')}</span>
                  <span>{formatPrice(selectedOrder.shipping_cost ?? 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold pt-1">
                  <span>{t('cart.total')}</span>
                  <span>{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              <Separator />

              <div className="py-3">
                <p className="text-sm font-semibold mb-2">
                  {t('admin.stockMovements', 'Moviments d\'estoc')}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({stockMovements.length})</span>
                </p>
                {stockMovements.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    {t('admin.noStockMovements', 'Encara no hi ha moviments d\'estoc per a aquesta comanda.')}
                  </p>
                ) : (
                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">{t('admin.movementDate', 'Data')}</TableHead>
                          <TableHead className="text-xs">{t('account.orderProduct')}</TableHead>
                          <TableHead className="text-xs">{t('admin.movementReason', 'Motiu')}</TableHead>
                          <TableHead className="text-xs text-right">{t('admin.movementDelta', 'Delta')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockMovements.map((mv: any) => {
                          const translations = mv.products?.product_translations || [];
                          const tr = translations.find((t: any) => t.language === lang) || translations[0];
                          const name = tr?.name || '—';
                          const variant = mv.product_variants?.value ? ` (${mv.product_variants.value})` : '';
                          const delta = Number(mv.delta);
                          const isConsume = delta > 0;
                          return (
                            <TableRow key={mv.id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {format(new Date(mv.created_at), 'dd/MM/yy HH:mm:ss', { locale: dateFnsLocale })}
                              </TableCell>
                              <TableCell className="text-xs">{name}{variant}</TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="text-[10px] font-mono">{mv.reason}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge className={`text-[10px] border ${isConsume ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                                  {isConsume ? '+' : ''}{delta}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>

          )}
        </DialogContent>
      </Dialog>

      {/* Deletion Audit Dialog */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.deletionAudit', 'Historial d\'eliminacions')}</DialogTitle>
            <DialogDescription>
              {t('admin.deletionAuditDesc', 'Registre de comandes eliminades: qui, quan i quins registres es van actualitzar.')}
            </DialogDescription>
          </DialogHeader>

          {auditLoading ? (
            <p className="text-muted-foreground">{t('common.loading')}</p>
          ) : auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4">
              {t('admin.noAuditEntries', 'Encara no hi ha eliminacions registrades.')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t('admin.movementDate', 'Data')}</TableHead>
                  <TableHead className="text-xs">{t('admin.orderNumber')}</TableHead>
                  <TableHead className="text-xs">{t('admin.deletedBy', 'Eliminat per')}</TableHead>
                  <TableHead className="text-xs text-right">{t('admin.auditItems', 'Línies')}</TableHead>
                  <TableHead className="text-xs text-right">{t('admin.auditStock', 'Mov. estoc')}</TableHead>
                  <TableHead className="text-xs text-right">{t('admin.auditListItems', 'Art. llista')}</TableHead>
                  <TableHead className="text-xs text-right">{t('admin.orderTotal')}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(a.created_at), 'dd/MM/yy HH:mm:ss', { locale: dateFnsLocale })}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{a.order_number || '—'}</TableCell>
                    <TableCell className="text-xs">{a.deleted_by_email || a.deleted_by || '—'}</TableCell>
                    <TableCell className="text-xs text-right">{a.order_items_deleted}</TableCell>
                    <TableCell className="text-xs text-right">{a.stock_movements_created}</TableCell>
                    <TableCell className="text-xs text-right">{a.list_items_affected}</TableCell>
                    <TableCell className="text-xs text-right">{formatPrice(Number(a.total ?? 0))}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAuditDetail(a)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Audit detail (snapshots) */}
      <Dialog open={!!auditDetail} onOpenChange={(o) => { if (!o) setAuditDetail(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {auditDetail && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t('admin.auditDetailTitle', 'Detall eliminació')} — {auditDetail.order_number || auditDetail.order_id}
                </DialogTitle>
                <DialogDescription>
                  {format(new Date(auditDetail.created_at), "d MMMM yyyy, HH:mm:ss", { locale: dateFnsLocale })}
                  {' · '}{auditDetail.deleted_by_email || auditDetail.deleted_by || '—'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 py-3 text-sm">
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">{t('admin.auditItems', 'Línies')}</p>
                  <p className="font-semibold">{auditDetail.order_items_deleted}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">{t('admin.auditStock', 'Mov. estoc')}</p>
                  <p className="font-semibold">{auditDetail.stock_movements_created}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">{t('admin.auditListItems', 'Art. llista')}</p>
                  <p className="font-semibold">{auditDetail.list_items_affected}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold mb-1">{t('admin.orderSnapshot', 'Snapshot comanda')}</p>
                  <pre className="text-[11px] bg-muted/40 p-2 rounded-md overflow-x-auto max-h-60">
{JSON.stringify(auditDetail.order_snapshot, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">{t('admin.itemsSnapshot', 'Snapshot línies')}</p>
                  <pre className="text-[11px] bg-muted/40 p-2 rounded-md overflow-x-auto max-h-60">
{JSON.stringify(auditDetail.items_snapshot, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
