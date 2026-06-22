import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Eye, ShieldCheck, User, ShoppingBag, Baby, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  preferred_language: string;
  phone: string | null;
  city: string | null;
  postal_code: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_email: string | null;
}

interface UserFormState {
  id?: string;
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: string;
  preferred_language: string;
  send_welcome_email: boolean;
}

const emptyForm: UserFormState = {
  email: '',
  password: '',
  full_name: '',
  phone: '',
  role: 'customer',
  preferred_language: 'ca',
  send_welcome_email: true,
};

const AdminUsers: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [detailUser, setDetailUser] = useState<Profile | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [editMode, setEditMode] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard' | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);

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

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.functions.invoke('admin-manage-users', {
        body: { action: 'update', user_id: userId, role },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Rol actualitzat');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveUser = useMutation({
    mutationFn: async () => {
      const action = editMode ? 'update' : 'create';
      const body: any = {
        action,
        full_name: form.full_name,
        phone: form.phone,
        role: form.role,
        preferred_language: form.preferred_language,
      };
      if (editMode) {
        body.user_id = form.id;
        if (form.password) body.password = form.password;
      } else {
        body.email = form.email;
        body.password = form.password;
        body.send_welcome_email = form.send_welcome_email;
      }
      const { data, error } = await supabase.functions.invoke('admin-manage-users', { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(editMode ? 'Usuari actualitzat' : 'Usuari creat');
      setFormOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'soft' | 'hard' }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-users', {
        body: { action: 'delete', user_id: id, delete_mode: mode },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return mode;
    },
    onSuccess: (mode) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(mode === 'hard' ? 'Usuari eliminat permanentment' : 'Usuari marcat com eliminat');
      setDeleteId(null);
      setDeleteMode(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const restoreUser = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-users', {
        body: { action: 'restore', user_id: id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuari restaurat');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditMode(false);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (u: Profile) => {
    setEditMode(true);
    setForm({
      id: u.id,
      email: '',
      password: '',
      full_name: u.full_name || '',
      phone: u.phone || '',
      role: u.role,
      preferred_language: u.preferred_language,
      send_welcome_email: false,
    });
    setFormOpen(true);
  };

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
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            {users.length} {t('admin.usersTotal')}
          </Badge>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nou usuari
          </Button>
        </div>
      </div>

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
              <TableRow key={user.id} className={user.deleted_at ? 'opacity-60' : ''}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {user.role === 'admin' ? (
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    {user.full_name || '—'}
                    {user.deleted_at && (
                      <Badge variant="destructive" className="text-[10px]">Eliminat</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.city || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.phone || '—'}</TableCell>
                <TableCell>
                  <select
                    value={user.role}
                    onChange={e => updateRole.mutate({ userId: user.id, role: e.target.value })}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    disabled={!!user.deleted_at}
                  >
                    <option value="customer">Customer</option>
                    <option value="admin">Admin</option>
                  </select>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(user.created_at), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDetailUser(user)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(user)} disabled={!!user.deleted_at}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {user.deleted_at ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restoreUser.mutate(user.id)}
                      >
                        Restaurar
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDeleteId(user.id); setDeleteMode(null); }}
                        disabled={user.id === currentUser?.id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
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

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode ? 'Editar usuari' : 'Crear nou usuari'}</DialogTitle>
            <DialogDescription>
              {editMode
                ? 'Modifica les dades de l\'usuari. Deixa la contrasenya en blanc per mantenir-la.'
                : 'Es crearà un compte amb les credencials indicades.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!editMode && (
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>Contrasenya {editMode && <span className="text-muted-foreground text-xs">(opcional)</span>}</Label>
              <Input
                type="text"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder={editMode ? 'Deixa buit per no canviar' : ''}
              />
            </div>
            <div>
              <Label>Nom complet</Label>
              <Input
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Telèfon</Label>
              <Input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rol</Label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <Label>Idioma</Label>
                <select
                  value={form.preferred_language}
                  onChange={e => setForm({ ...form, preferred_language: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="ca">Català</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>
            {!editMode && (
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="send-welcome"
                  checked={form.send_welcome_email}
                  onCheckedChange={v => setForm({ ...form, send_welcome_email: !!v })}
                />
                <Label htmlFor="send-welcome" className="font-normal cursor-pointer">
                  Enviar correu de benvinguda amb les credencials (via SMTP)
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel·lar</Button>
            <Button onClick={() => saveUser.mutate()} disabled={saveUser.isPending}>
              {saveUser.isPending ? 'Desant...' : 'Desar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete options dialog */}
      <Dialog open={!!deleteId && deleteMode === null} onOpenChange={o => { if (!o) { setDeleteId(null); setDeleteMode(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar usuari</DialogTitle>
            <DialogDescription>
              Tria com vols eliminar aquest usuari. Aquesta decisió és important.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => setDeleteMode('soft')}
              className="w-full text-left rounded-lg border border-border p-4 hover:border-primary hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Trash2 className="h-4 w-4 text-amber-700" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">Marcar com eliminat (recomanat)</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    L'usuari deixa de poder iniciar sessió i queda ocult.
                    Es conserven els seus pedidos, llistes i historial.
                    L'email queda reservat i ningú el podrà reutilitzar per registrar-se.
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setDeleteMode('hard')}
              className="w-full text-left rounded-lg border border-border p-4 hover:border-destructive hover:bg-destructive/5 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-destructive">Eliminació permanent</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    S'esborren l'usuari i totes les seves dades relacionades:
                    pedidos, articles de pedido, llistes de naixement on és l'únic propietari, etc.
                    Aquesta acció no es pot desfer.
                  </p>
                </div>
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteId(null); setDeleteMode(null); }}>
              Cancel·lar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final confirmation for the chosen mode */}
      <AlertDialog open={!!deleteId && deleteMode !== null} onOpenChange={o => { if (!o) setDeleteMode(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteMode === 'hard' ? 'Confirmar eliminació permanent' : 'Confirmar marcar com eliminat'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === 'hard'
                ? "S'eliminaran l'usuari i totes les seves dades (pedidos, articles, llistes pròpies). Aquesta acció no es pot desfer."
                : "L'usuari quedarà inactiu i el seu email no es podrà tornar a registrar. Podràs restaurar-lo més endavant."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteMode(null)}>Tornar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMode && deleteUser.mutate({ id: deleteId, mode: deleteMode })}
              className={deleteMode === 'hard'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''}
            >
              {deleteMode === 'hard' ? 'Eliminar permanentment' : 'Marcar com eliminat'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


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
