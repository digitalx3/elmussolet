import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, AlertTriangle, Mail, PackageX } from 'lucide-react';

type Notification = {
  id: string;
  order_id: string | null;
  depleted_products: { id: string; name: string }[];
  affected_lists: {
    list_id: string;
    list_code: string;
    baby_name: string | null;
    products: string[];
    owner_emails: string[];
  }[];
  admin_emails: string[];
  owner_emails: string[];
  emails_sent: number;
  emails_failed: number;
  status: string;
  error: string | null;
  created_at: string;
};

const statusVariant = (s: string) =>
  s === 'ok' ? 'default' : s === 'partial' ? 'secondary' : 'destructive';

export default function AdminStockNotifications() {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['stock-depletion-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_depletion_notifications' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as Notification[];
    },
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === 'ca' ? 'ca-ES' : 'es-ES');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <PackageX className="h-6 w-6" />
          {t('admin.stockNotifications.title', 'Historial de notificacions sense estoc')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t(
            'admin.stockNotifications.subtitle',
            'Registre dels avisos enviats quan un producte queda sense estoc i afecta llistes de naixement actives.',
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('admin.stockNotifications.events', 'Esdeveniments')} ({data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t('common.loading', 'Carregant...')}</p>
          ) : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('admin.stockNotifications.empty', 'Encara no hi ha notificacions registrades.')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t('admin.stockNotifications.date', 'Data')}</TableHead>
                  <TableHead>{t('admin.stockNotifications.depleted', 'Productes')}</TableHead>
                  <TableHead>{t('admin.stockNotifications.lists', 'Llistes')}</TableHead>
                  <TableHead>{t('admin.stockNotifications.emails', 'Correus')}</TableHead>
                  <TableHead>{t('admin.stockNotifications.status', 'Estat')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((n) => {
                  const isOpen = expanded.has(n.id);
                  return (
                    <React.Fragment key={n.id}>
                      <TableRow className="cursor-pointer" onClick={() => toggle(n.id)}>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm">{fmt(n.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{n.depleted_products?.length || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{n.affected_lists?.length || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="text-green-600">{n.emails_sent}</span>
                          {n.emails_failed > 0 && (
                            <span className="text-destructive"> / {n.emails_failed} ✕</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(n.status) as any}>{n.status}</Badge>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="space-y-4 p-2">
                              {n.error && (
                                <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                                  <span>{n.error}</span>
                                </div>
                              )}

                              <div>
                                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                                  {t('admin.stockNotifications.depletedProducts', 'Productes sense estoc')}
                                </div>
                                {n.depleted_products?.length ? (
                                  <ul className="list-disc list-inside text-sm">
                                    {n.depleted_products.map((p) => (
                                      <li key={p.id}>{p.name}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-muted-foreground">—</p>
                                )}
                              </div>

                              <div>
                                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                                  {t('admin.stockNotifications.affectedLists', 'Llistes afectades')}
                                </div>
                                {n.affected_lists?.length ? (
                                  <div className="space-y-2">
                                    {n.affected_lists.map((l) => (
                                      <div key={l.list_id} className="rounded-md border border-border bg-card p-3 text-sm">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                          <div>
                                            <span className="font-medium">{l.list_code}</span>
                                            {l.baby_name && (
                                              <span className="text-muted-foreground"> — {l.baby_name}</span>
                                            )}
                                          </div>
                                          <Badge variant="outline" className="gap-1">
                                            <Mail className="h-3 w-3" />
                                            {l.owner_emails?.length || 0}
                                          </Badge>
                                        </div>
                                        {l.products?.length > 0 && (
                                          <div className="mt-1 text-muted-foreground">
                                            {l.products.join(', ')}
                                          </div>
                                        )}
                                        {l.owner_emails?.length > 0 && (
                                          <div className="mt-1 text-xs text-muted-foreground">
                                            {l.owner_emails.join(', ')}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">—</p>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                                    {t('admin.stockNotifications.adminRecipients', 'Administradors notificats')}
                                  </div>
                                  <p className="text-sm">
                                    {n.admin_emails?.length ? n.admin_emails.join(', ') : '—'}
                                  </p>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                                    {t('admin.stockNotifications.orderId', 'Comanda')}
                                  </div>
                                  <p className="text-sm font-mono">{n.order_id || '—'}</p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
