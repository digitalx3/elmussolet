import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, CalendarDays, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, subDays, startOfMonth } from 'date-fns';
import { ca } from 'date-fns/locale';

const LOW_STOCK_THRESHOLD = 5;

function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const thirtyDaysAgo = format(subDays(now, 30), 'yyyy-MM-dd');

      const [pendingRes, todayRes, revenueRes, lowStockRes, recentOrdersRes, salesRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00`),
        supabase.from('orders').select('total').gte('created_at', `${monthStart}T00:00:00`),
        supabase.from('products').select('id, sku, slug, stock_quantity, base_price, product_translations(name, language)').eq('is_active', true).lte('stock_quantity', LOW_STOCK_THRESHOLD).order('stock_quantity', { ascending: true }).limit(10),
        supabase.from('orders').select('id, order_number, total, status, created_at, customers(full_name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('total, created_at').gte('created_at', `${thirtyDaysAgo}T00:00:00`),
      ]);

      const monthRevenue = (revenueRes.data || []).reduce((sum, o) => sum + Number(o.total), 0);

      // Aggregate sales by day
      const salesByDay: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = format(subDays(now, i), 'yyyy-MM-dd');
        salesByDay[d] = 0;
      }
      (salesRes.data || []).forEach(o => {
        const d = format(new Date(o.created_at), 'yyyy-MM-dd');
        if (salesByDay[d] !== undefined) salesByDay[d] += Number(o.total);
      });
      const salesChart = Object.entries(salesByDay).map(([date, total]) => ({
        date,
        label: format(new Date(date), 'dd/MM'),
        total: Math.round(total * 100) / 100,
      }));

      return {
        pendingOrders: pendingRes.count || 0,
        todayOrders: todayRes.count || 0,
        monthRevenue,
        lowStockProducts: lowStockRes.data || [],
        recentOrders: recentOrdersRes.data || [],
        salesChart,
      };
    },
    refetchInterval: 60000,
  });
}

const StatCard: React.FC<{
  title: string; value: string | number; icon: React.ReactNode; accent?: string;
}> = ({ title, value, icon, accent }) => (
  <Card>
    <CardContent className="flex items-center gap-4 p-6">
      <div className={`rounded-xl p-3 ${accent || 'bg-primary/10 text-primary'}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold font-display">{value}</p>
      </div>
    </CardContent>
  </Card>
);

// chartConfig built inside the component to use translations
const useChartConfig = () => {
  const { t } = useTranslation();
  return { total: { label: t('admin.overview.salesAxis'), color: 'hsl(var(--primary))' } };
};

const TopProductsChart: React.FC = () => {
  const { t } = useTranslation();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = React.useState<string>(defaultMonth);

  const topChartConfig = {
    units: { label: t('admin.overview.unitsSold'), color: 'hsl(var(--primary))' },
  };

  const { data: top = [], isLoading } = useQuery({
    queryKey: ['admin-top-products', month],
    queryFn: async () => {
      const [y, m] = month.split('-').map(Number);
      const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
      const to = new Date(Date.UTC(y, m, 1)).toISOString();
      const { data, error } = await supabase.rpc('get_top_products', {
        _from: from, _to: to, _limit: 10,
      });
      if (error) throw error;
      const rows = (data || []) as Array<{ product_id: string; slug: string; units: number; revenue: number }>;
      if (rows.length === 0) return [] as Array<{ product_id: string; name: string; units: number }>;
      const ids = rows.map(r => r.product_id);
      const { data: tr } = await supabase
        .from('product_translations')
        .select('product_id, name, language')
        .in('product_id', ids);
      const nameByProduct: Record<string, string> = {};
      (tr || []).forEach((t: any) => {
        if (!nameByProduct[t.product_id] || t.language === 'ca') nameByProduct[t.product_id] = t.name;
      });
      return rows.map(r => ({
        product_id: r.product_id,
        name: nameByProduct[r.product_id] || r.slug,
        units: Number(r.units) || 0,
      }));
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="font-display text-lg">{t('admin.overview.topProducts')}</CardTitle>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">{t('admin.common.loading')}</p>
        ) : top.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            {t('admin.overview.noSalesMonth')}
          </p>
        ) : (
          <ChartContainer config={topChartConfig} className="h-[300px] w-full">
            <BarChart data={top} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={160} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="units" fill="var(--color-units)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

const AdminOverview: React.FC = () => {
  const { t } = useTranslation();
  const chartConfig = useChartConfig();
  const { data, isLoading } = useAdminStats();

  if (isLoading) {
    return <p className="text-muted-foreground">{t('common.loading')}</p>;
  }

  const stats = data!;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">{t('admin.dashboard')}</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('admin.pendingOrders')}
          value={stats.pendingOrders}
          icon={<ShoppingCart className="h-5 w-5" />}
          accent="bg-accent/10 text-accent"
        />
        <StatCard
          title={t('admin.todayOrders')}
          value={stats.todayOrders}
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <StatCard
          title={t('admin.lowStock')}
          value={stats.lowStockProducts.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={stats.lowStockProducts.length > 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}
        />
        <StatCard
          title={t('admin.monthRevenue')}
          value={`${stats.monthRevenue.toFixed(2)} €`}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="bg-sage text-sage-foreground"
        />
      </div>

      {/* Sales chart */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">{t('admin.salesChart')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={stats.salesChart} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <TopProductsChart />


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">{t('admin.recentOrders')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.noOrders')}</p>
            ) : (
              <div className="space-y-3">
                {stats.recentOrders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.customers?.full_name || '—'} · {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ca })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{Number(order.total).toFixed(2)} €</p>
                      <Badge variant="outline" className="text-xs">{order.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Critical stock */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">{t('admin.criticalStock')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.overview.criticalStockOk')}</p>
            ) : (
              <div className="space-y-3">
                {stats.lowStockProducts.map((p: any) => {
                  const name = p.product_translations?.find((t: any) => t.language === i18n.language)?.name
                    || p.product_translations?.find((t: any) => t.language === 'ca')?.name
                    || p.sku;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium text-sm">{name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </div>
                      <Badge variant={p.stock_quantity === 0 ? 'destructive' : 'outline'} className="text-xs">
                        {p.stock_quantity} {t('admin.common.unitsShort')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
