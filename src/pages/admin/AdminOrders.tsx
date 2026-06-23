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
import { Separator } from '@/components/ui/separator';
import { Search, Eye, X, Pencil, Trash2, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ca, es } from 'date-fns/locale';

const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
type PaymentStatus = typeof PAYMENT_STATUSES[number];

const paymentColors: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  refunded: 'bg-gray-100 text-gray-800 border-gray-200',
};

interface OrderRow {
  id: string;
  order_number: string;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  delivery_method: string | null;
  subtotal: number;
  tax_amount: number | null;
  shipping_cost: number | null;
  total: number;
  notes: string | null;
  shipping_address: any;
  created_at: string;
  user_id: string;
  profiles: { full_name: string | null } | null;
}

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

  const isEditable = !!selectedOrder && selectedOrder.payment_status !== 'paid' && selectedOrder.payment_status !== 'refunded';

  const { data: orderStatuses = [] } = useOrderStatuses();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, profiles(full_name)')
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
      toast.success(t('admin.orderStatusUpdated'));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ id, payment_status }: { id: string; payment_status: string }) => {
      const { error } = await supabase.from('orders').update({ payment_status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success(t('admin.paymentStatusUpdated'));
    },
    onError: (e: any) => toast.error(e.message),
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
      await recomputeOrderTotals(item.product_id ? selectedOrder!.id : selectedOrder!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order-items', selectedOrder?.id] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success(t('common.success'));
    },
    onError: (e: any) => toast.error(e.message),
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
      toast.success(t('common.success'));
    },
    onError: (e: any) => toast.error(e.message),
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
      toast.success(t('common.success'));
    },
    onError: (e: any) => toast.error(e.message),
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
      o.profiles?.full_name?.toLowerCase().includes(s)
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
              <TableHead>{t('admin.paymentStatus')}</TableHead>
              <TableHead className="text-right">{t('admin.orderTotal')}</TableHead>
              <TableHead className="text-right">{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map(order => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-sm font-medium">{order.order_number}</TableCell>
                <TableCell>{order.profiles?.full_name || '—'}</TableCell>
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
                <TableCell>
                  <Select
                    value={order.payment_status || 'pending'}
                    onValueChange={payment_status => updatePaymentStatusMutation.mutate({ id: order.id, payment_status })}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <Badge className={`text-xs border ${paymentColors[(order.payment_status || 'pending') as PaymentStatus]}`}>
                        {getPaymentLabel(order.payment_status || 'pending')}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{getPaymentLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right font-medium">{formatPrice(order.total)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)}>
                    <Eye className="h-4 w-4" />
                  </Button>
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

              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('admin.customer')}</p>
                  <p className="text-sm font-medium">{selectedOrder.profiles?.full_name || '—'}</p>
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
                    {orderItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{getProductName(item)}</TableCell>
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
                    ))}
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
