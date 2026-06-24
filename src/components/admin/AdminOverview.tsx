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

const chartConfig = {
  total: { label: 'Vendes (€)', color: 'hsl(var(--primary))' },
};

const AdminOverview: React.FC = () => {
  const { t } = useTranslation();
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
              <p className="text-sm text-muted-foreground">Cap producte amb estoc crític 🎉</p>
            ) : (
              <div className="space-y-3">
                {stats.lowStockProducts.map((p: any) => {
                  const name = p.product_translations?.find((t: any) => t.language === 'ca')?.name || p.sku;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium text-sm">{name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </div>
                      <Badge variant={p.stock_quantity === 0 ? 'destructive' : 'outline'} className="text-xs">
                        {p.stock_quantity} uds
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
