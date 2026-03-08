import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Eye, ShieldCheck, User, ShoppingBag, Baby } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  preferred_language: string;
  phone: string | null;
  city: string | null;
  postal_code: string | null;
  created_at: string;
}

const AdminUsers: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [detailUser, setDetailUser] = useState<Profile | null>(null);

  // Fetch all profiles
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch orders for selected user
  const { data: userOrders = [] } = useQuery({
    queryKey: ['admin-user-orders', detailUser?.id],
    queryFn: async () => {
      if (!detailUser) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, status, created_at')
        .eq('user_id', detailUser.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!detailUser,
  });

  // Fetch birth lists for selected user
  const { data: userLists = [] } = useQuery({
    queryKey: ['admin-user-lists', detailUser?.id],
    queryFn: async () => {
      if (!detailUser) return [];
      const { data, error } = await supabase
        .from('list_owners')
        .select('list_id, is_primary, birth_lists(id, baby_name, status, list_code)')
        .eq('user_id', detailUser.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!detailUser,
  });

  // Update role mutation
  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('admin.userRoleUpdated'));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q) ||
      (u.city || '').toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">{t('admin.users')}</h1>
        <Badge variant="outline" className="text-sm">
          {users.length} {t('admin.usersTotal')}
        </Badge>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t('admin.searchUsers')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.userName')}</TableHead>
              <TableHead>{t('admin.userCity')}</TableHead>
              <TableHead>{t('admin.userPhone')}</TableHead>
              <TableHead>{t('admin.userRole')}</TableHead>
              <TableHead>{t('admin.userRegistered')}</TableHead>
              <TableHead className="text-right">{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(user => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {user.role === 'admin' ? (
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    {user.full_name || '—'}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.city || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.phone || '—'}</TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={role => updateRole.mutate({ userId: user.id, role })}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(user.created_at), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setDetailUser(user)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t('admin.noUsers')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* User Detail Dialog */}
      <Dialog open={!!detailUser} onOpenChange={() => setDetailUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailUser?.role === 'admin' ? (
                <ShieldCheck className="h-5 w-5 text-primary" />
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
              {detailUser?.full_name || '—'}
            </DialogTitle>
            <DialogDescription>
              {t('admin.userDetailDesc')}
            </DialogDescription>
          </DialogHeader>

          {detailUser && (
            <div className="space-y-6">
              {/* Profile info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">{t('account.profile')}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('admin.userRole')}:</span>{' '}
                    <Badge variant={detailUser.role === 'admin' ? 'default' : 'secondary'}>
                      {detailUser.role}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('account.language')}:</span>{' '}
                    {detailUser.preferred_language.toUpperCase()}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('account.phone')}:</span>{' '}
                    {detailUser.phone || '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('account.city')}:</span>{' '}
                    {detailUser.city || '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('account.postalCode')}:</span>{' '}
                    {detailUser.postal_code || '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('admin.userRegistered')}:</span>{' '}
                    {format(new Date(detailUser.created_at), 'dd/MM/yyyy HH:mm')}
                  </div>
                </CardContent>
              </Card>

              {/* Orders */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    {t('account.orders')} ({userOrders.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('account.noOrders')}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('admin.orderNumber')}</TableHead>
                          <TableHead>{t('admin.orderDate')}</TableHead>
                          <TableHead>{t('admin.status')}</TableHead>
                          <TableHead className="text-right">{t('admin.orderTotal')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userOrders.map((order: any) => (
                          <TableRow key={order.id}>
                            <TableCell className="text-sm font-medium">{order.order_number}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(order.created_at), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{order.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {Number(order.total).toFixed(2)} €
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Birth Lists */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Baby className="h-4 w-4" />
                    {t('admin.lists')} ({userLists.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userLists.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('admin.noUserLists')}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('list.babyName')}</TableHead>
                          <TableHead>{t('list.listCode')}</TableHead>
                          <TableHead>{t('admin.status')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userLists.map((lo: any) => (
                          <TableRow key={lo.list_id}>
                            <TableCell className="text-sm font-medium">
                              {lo.birth_lists?.baby_name || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {lo.birth_lists?.list_code}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{lo.birth_lists?.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailUser(null)}>
              {t('admin.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
