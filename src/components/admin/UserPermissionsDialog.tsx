import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Props {
  user: { id: string; full_name: string | null; role: string } | null;
  onClose: () => void;
}

// Catalog of premium permissions. Keep in sync with the app_permission enum.
const PERMISSION_CATALOG: Array<{ key: string; label: string; description: string }> = [
  { key: 'ai_access', label: 'Funcions d\'IA', description: 'Generació de descripcions, SEO i traduccions automàtiques.' },
  { key: 'ai_translate', label: 'Traducció amb IA', description: 'Accés específic a la traducció automàtica de continguts.' },
  { key: 'ai_product_seo', label: 'SEO de producte amb IA', description: 'Generar metadades SEO assistides per IA.' },
];

export const UserPermissionsDialog: React.FC<Props> = ({ user, onClose }) => {
  const qc = useQueryClient();
  const [granted, setGranted] = useState<Set<string>>(new Set());

  const { data: rows = [] } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data ?? []) as Array<{ permission: string }>;
    },
    enabled: !!user,
  });

  useEffect(() => {
    setGranted(new Set(rows.map(r => r.permission)));
  }, [rows]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const current = new Set(rows.map(r => r.permission));
      const toAdd = [...granted].filter(p => !current.has(p));
      const toRemove = [...current].filter(p => !granted.has(p));

      if (toAdd.length) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(toAdd.map(p => ({ user_id: user.id, permission: p as any })));
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', user.id)
          .in('permission', toRemove as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-permissions', user?.id] });
      toast.success('Permisos actualitzats');
      onClose();
    },
    onError: (e: any) => toast.error(e.message || 'Error desant permisos'),
  });

  const toggle = (key: string, on: boolean) => {
    setGranted(prev => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  };

  return (
    <Dialog open={!!user} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Permisos avançats</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Concedeix accés a funcions premium per <span className="font-medium text-foreground">{user?.full_name || user?.id}</span>. Només els usuaris amb rol admin poden rebre aquests permisos.
          </p>
          <div className="space-y-3">
            {PERMISSION_CATALOG.map(p => (
              <div key={p.key} className="flex items-start justify-between gap-4 p-3 rounded-md border">
                <div>
                  <Label className="font-medium">{p.label}</Label>
                  <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                </div>
                <Switch
                  checked={granted.has(p.key)}
                  onCheckedChange={(v) => toggle(p.key, v)}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel·lar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Desant…' : 'Desar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
