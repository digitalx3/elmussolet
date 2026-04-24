import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatPrice } from '@/hooks/useTaxRates';
import { Package, ChevronDown, ChevronUp, User, ShoppingBag, Heart } from 'lucide-react';
import MyBirthListPage from './MyBirthListPage';

interface OrderItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  base_unit_price: number | null;
  tax_percentage: number | null;
  tax_amount: number | null;
  total_price: number;
  product_translations?: { name: string; language: string }[];
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string | null;
  payment_status: string | null;
  subtotal: number;
  shipping_cost: number | null;
  tax_amount: number | null;
  total: number;
  delivery_method: string | null;
  order_items: OrderItem[];
}

const statusColorMap: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  processing: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  shipped: 'bg-purple-100 text-purple-800 border-purple-300',
  delivered: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

const AccountDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const initialTab = typeof window !== 'undefined' && window.location.pathname.includes('la-meva-llista')
    ? 'my-list'
    : 'profile';

  return (
    <div className="container py-8 max-w-4xl">
      <h1 className="font-display text-3xl font-bold mb-6">{t('account.title')}</h1>
      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" />{t('account.profile')}</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2"><ShoppingBag className="h-4 w-4" />{t('account.orders')}</TabsTrigger>
          <TabsTrigger value="my-list" className="gap-2"><Heart className="h-4 w-4" />{t('account.myList')}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab profile={profile} refreshProfile={refreshProfile} />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="my-list">
          <MyBirthListPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ─── Profile Tab ─── */
function ProfileTab({ profile, refreshProfile }: { profile: any; refreshProfile: () => Promise<void> }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    province: '',
    preferred_language: 'ca',
    nif: '',
    company_name: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        address_line1: profile.address_line1 || '',
        address_line2: profile.address_line2 || '',
        city: profile.city || '',
        postal_code: profile.postal_code || '',
        province: profile.province || '',
        preferred_language: profile.preferred_language || 'ca',
        nif: profile.nif || '',
        company_name: profile.company_name || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update(form).eq('id', profile.id);
    setSaving(false);
    if (error) {
      toast.error(t('errors.generic'));
    } else {
      toast.success(t('account.saved'));
      await refreshProfile();
    }
  };

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Card>
      <CardHeader><CardTitle>{t('account.profile')}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {/* Personal Data */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t('account.personalData')}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>{t('auth.fullName')}</Label><Input value={form.full_name} onChange={e => update('full_name', e.target.value)} /></div>
            <div><Label>{t('account.phone')}</Label><Input value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
          </div>
          <div className="mt-4">
            <Label>{t('account.language')}</Label>
            <Select value={form.preferred_language} onValueChange={v => update('preferred_language', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ca">Català</SelectItem>
                <SelectItem value="es">Castellano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Fiscal Data */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t('account.fiscalData')}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>{t('account.nif')}</Label>
              <Input value={form.nif} onChange={e => update('nif', e.target.value)} placeholder="12345678A" />
              <p className="text-xs text-muted-foreground mt-1">{t('account.nifHelp')}</p>
            </div>
            <div><Label>{t('account.companyName')}</Label><Input value={form.company_name} onChange={e => update('company_name', e.target.value)} placeholder={t('account.companyName')} /></div>
          </div>
        </div>

        {/* Billing / Shipping Address */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t('account.billingAddress')}</h3>
          <div className="space-y-4">
            <div><Label>{t('account.addressLine1')}</Label><Input value={form.address_line1} onChange={e => update('address_line1', e.target.value)} /></div>
            <div><Label>{t('account.addressLine2')}</Label><Input value={form.address_line2} onChange={e => update('address_line2', e.target.value)} /></div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div><Label>{t('account.city')}</Label><Input value={form.city} onChange={e => update('city', e.target.value)} /></div>
              <div><Label>{t('account.postalCode')}</Label><Input value={form.postal_code} onChange={e => update('postal_code', e.target.value)} /></div>
              <div><Label>{t('account.province')}</Label><Input value={form.province} onChange={e => update('province', e.target.value)} /></div>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>{saving ? t('common.loading') : t('account.save')}</Button>
      </CardContent>
    </Card>
  );
}

/* ─── Orders Tab ─── */
function OrdersTab() {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(product_translations(name, language)))')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setOrders(data as unknown as Order[]);
      }
      setLoading(false);
    })();
  }, []);

  const toggle = (id: string) => setExpandedId(prev => (prev === id ? null : id));

  const statusLabel = (status: string | null) => {
    const key = `account.status_${status || 'pending'}`;
    const translated = t(key);
    return translated === key ? (status || 'pending') : translated;
  };

  if (loading) return <p className="text-muted-foreground py-8 text-center">{t('common.loading')}</p>;
  if (orders.length === 0) return (
    <Card>
      <CardContent className="py-12 text-center">
        <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">{t('account.noOrders')}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {orders.map(order => {
        const expanded = expandedId === order.id;
        // Group tax breakdown
        const taxGroups: Record<number, { base: number; tax: number }> = {};
        order.order_items.forEach(item => {
          const pct = item.tax_percentage ?? 0;
          if (!taxGroups[pct]) taxGroups[pct] = { base: 0, tax: 0 };
          taxGroups[pct].base += (item.base_unit_price ?? item.unit_price) * item.quantity;
          taxGroups[pct].tax += item.tax_amount ?? 0;
        });

        return (
          <Card key={order.id}>
            <button
              className="w-full text-left p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 hover:bg-muted/30 transition-colors rounded-lg"
              onClick={() => toggle(order.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{order.order_number}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString(lang === 'ca' ? 'ca-ES' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <Badge className={`${statusColorMap[order.status || 'pending'] || ''} text-xs`}>
                {statusLabel(order.status)}
              </Badge>
              <span className="font-bold text-sm whitespace-nowrap">{formatPrice(order.total)}</span>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>

            {expanded && (
              <CardContent className="pt-0 border-t">
                {/* Items table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('account.orderProduct')}</TableHead>
                        <TableHead className="text-right">{t('account.orderQty')}</TableHead>
                        <TableHead className="text-right">{t('account.orderBasePrice')}</TableHead>
                        <TableHead className="text-right">{t('account.orderTaxPct')}</TableHead>
                        <TableHead className="text-right">{t('account.orderTaxAmt')}</TableHead>
                        <TableHead className="text-right">{t('account.orderTotal')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.order_items.map(item => {
                        const translations = (item as any).products?.product_translations;
                        const name = Array.isArray(translations)
                          ? (translations.find((t: any) => t.language === lang)?.name || translations[0]?.name || item.product_id)
                          : item.product_id;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatPrice((item.base_unit_price ?? item.unit_price) * item.quantity)}</TableCell>
                            <TableCell className="text-right">{item.tax_percentage ?? 0}%</TableCell>
                            <TableCell className="text-right">{formatPrice(item.tax_amount ?? 0)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatPrice(item.total_price)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Tax breakdown summary */}
                <div className="mt-4 space-y-1 text-sm border-t pt-4">
                  {Object.entries(taxGroups)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([pct, { base, tax }]) => (
                      <div key={pct} className="flex justify-between text-muted-foreground">
                        <span>{t('account.taxBase')} {pct}%</span>
                        <span>{formatPrice(base)} + {formatPrice(tax)} IVA</span>
                      </div>
                    ))}
                  {(order.shipping_cost ?? 0) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t('cart.shipping')}</span>
                      <span>{formatPrice(order.shipping_cost!)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t text-foreground">
                    <span>{t('cart.total')}</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default AccountDashboard;
