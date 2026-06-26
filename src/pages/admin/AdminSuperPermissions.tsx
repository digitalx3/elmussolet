import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { PREMIUM_PERMISSIONS, type PermissionKey } from '@/lib/permissions';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Search, ShieldCheck } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
}

type PermissionMap = Record<string, Set<PermissionKey>>; // user_id -> perms

const AdminSuperPermissions: React.FC = () => {
  const { t } = useTranslation();
  const { refreshProfile, user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [perms, setPerms] = useState<PermissionMap>({});
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      // 1) Get all user_roles with role='admin' (exclude super_admin users entirely)
      const { data: allRoles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesErr) throw rolesErr;

      const superAdminIds = new Set(
        (allRoles ?? []).filter(r => r.role === 'super_admin').map(r => r.user_id),
      );
      const adminIds = Array.from(
        new Set(
          (allRoles ?? [])
            .filter(r => r.role === 'admin' && !superAdminIds.has(r.user_id))
            .map(r => r.user_id),
        ),
      );

      // Also include legacy admins (profiles.role='admin' without entry in user_roles)
      const { data: profRows } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'admin');
      (profRows ?? []).forEach(p => {
        if (!superAdminIds.has(p.id) && !adminIds.includes(p.id)) adminIds.push(p.id);
      });

      if (adminIds.length === 0) {
        setAdmins([]);
        setPerms({});
        return;
      }

      // 2) Fetch profiles + permissions
      const [{ data: profiles }, { data: permRows }, { data: customers }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', adminIds),
        supabase.from('user_permissions').select('user_id, permission').in('user_id', adminIds),
        supabase.from('customers').select('auth_user_id, email').in('auth_user_id', adminIds),
      ]);

      const emailByUser = new Map<string, string>();
      (customers ?? []).forEach(c => {
        if (c.auth_user_id && c.email) emailByUser.set(c.auth_user_id, c.email);
      });

      const profilesById = new Map<string, { id: string; full_name: string | null }>();
      (profiles ?? []).forEach(p => profilesById.set(p.id, p));

      const list: AdminUser[] = adminIds.map(id => ({
        id,
        full_name: profilesById.get(id)?.full_name ?? null,
        email: emailByUser.get(id) ?? null,
      }));
      list.sort((a, b) =>
        (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''),
      );

      const map: PermissionMap = {};
      adminIds.forEach(id => (map[id] = new Set()));
      (permRows ?? []).forEach(r => {
        if (map[r.user_id]) map[r.user_id].add(r.permission as PermissionKey);
      });

      setAdmins(list);
      setPerms(map);
    } catch (e: any) {
      console.error('Failed to load admins:', e);
      toast({ title: t('admin.common.error'), description: e?.message ?? t('admin.super.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const togglePermission = async (userId: string, perm: PermissionKey, enabled: boolean) => {
    setSaving(`${userId}:${perm}`);
    try {
      if (enabled) {
        const { error } = await supabase
          .from('user_permissions')
          .upsert({ user_id: userId, permission: perm }, { onConflict: 'user_id,permission' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('permission', perm);
        if (error) throw error;
      }
      setPerms(prev => {
        const next = { ...prev };
        const set = new Set(next[userId] ?? []);
        if (enabled) set.add(perm); else set.delete(perm);
        next[userId] = set;
        return next;
      });
      toast({ title: t('admin.super.permUpdated') });
      if (currentUser?.id === userId) await refreshProfile();
    } catch (e: any) {
      console.error('Failed to update permission:', e);
      toast({ title: t('admin.common.error'), description: e?.message ?? t('admin.super.permError'), variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(a =>
      (a.full_name ?? '').toLowerCase().includes(q) ||
      (a.email ?? '').toLowerCase().includes(q),
    );
  }, [admins, search]);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold">Permisos d'administradors</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona quines funcions extra té habilitades cada administrador. El Super Admin sempre té accés total.
          </p>
        </div>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per nom o correu..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregant administradors...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {admins.length === 0 ? 'No hi ha cap administrador.' : 'Sense resultats per a la cerca.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(admin => (
            <Card key={admin.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {admin.full_name || admin.email || admin.id}
                </CardTitle>
                {admin.email && admin.full_name && (
                  <p className="text-xs text-muted-foreground">{admin.email}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PREMIUM_PERMISSIONS.map(p => {
                    const enabled = perms[admin.id]?.has(p.key) ?? false;
                    const key = `${admin.id}:${p.key}`;
                    return (
                      <label
                        key={p.key}
                        className="flex items-start justify-between gap-3 rounded-md border border-border p-3 hover:bg-muted/40"
                      >
                        <div>
                          <div className="font-medium">{p.fallback}</div>
                          <div className="text-xs text-muted-foreground">{p.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {saving === key && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          <Switch
                            checked={enabled}
                            disabled={saving === key}
                            onCheckedChange={(v) => togglePermission(admin.id, p.key, v)}
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSuperPermissions;
