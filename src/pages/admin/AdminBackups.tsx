import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ca } from 'date-fns/locale';
import { notify } from '@/lib/notify';
import {
  Download, Trash2, RefreshCw, ShieldAlert, Database, HardDrive, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

// Mirror of supabase/functions/_shared/backup-groups.ts (kept in sync manually).
type BackupGroupId = 'catalog' | 'content' | 'config' | 'templates' | 'sales' | 'messages';
const BACKUP_GROUPS: { id: BackupGroupId; label: string; description: string }[] = [
  { id: 'catalog', label: 'Catàleg', description: 'Productes, variants, traduccions, marques, categories, atributs, imatges' },
  { id: 'content', label: 'Contingut', description: 'Heros, blocs CMS, pàgines, peu i contacte, mèdia de site-assets' },
  { id: 'config', label: 'Configuració', description: 'Enviaments, impostos, estats, plantilles d\'email, SMTP, ajustos' },
  { id: 'templates', label: 'Plantilles de llistes', description: 'Plantilles de llistes de naixement i les seves seccions' },
  { id: 'sales', label: 'Clients i vendes', description: 'Clients, llistes de naixement, propietaris, pedidos i ítems' },
  { id: 'messages', label: 'Missatges', description: 'Missatges del formulari de contacte' },
];

interface BackupRun {
  id: string;
  kind: string;
  status: 'running' | 'success' | 'failed';
  created_by_email: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  tables_json: Record<string, number> | null;
  storage_json: Record<string, number> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

const AdminBackups: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupRun | null>(null);
  const [groupConfig, setGroupConfig] = useState<Record<BackupGroupId, { enabled: boolean; mode: 'upsert' | 'wipe' }>>({
    catalog: { enabled: false, mode: 'upsert' },
    content: { enabled: false, mode: 'upsert' },
    config: { enabled: false, mode: 'upsert' },
    templates: { enabled: false, mode: 'upsert' },
    sales: { enabled: false, mode: 'upsert' },
    messages: { enabled: false, mode: 'upsert' },
  });
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreReport, setRestoreReport] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupRun | null>(null);

  const { data: runs = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-backup-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backup_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as BackupRun[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      setCreating(true);
      const { data, error } = await supabase.functions.invoke('admin-backup-create', {
        body: {},
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      notify.success(t('admin.backupCreated', 'Còpia creada correctament'));
      qc.invalidateQueries({ queryKey: ['admin-backup-runs'] });
    },
    onError: (err: Error) => notify.error(err.message),
    onSettled: () => setCreating(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (run: BackupRun) => {
      if (run.file_path) {
        await supabase.storage.from('backups').remove([run.file_path]);
      }
      const { error } = await supabase.from('backup_runs').delete().eq('id', run.id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success(t('admin.backupDeleted', 'Còpia eliminada'));
      qc.invalidateQueries({ queryKey: ['admin-backup-runs'] });
    },
    onError: (err: Error) => notify.error(err.message),
  });

  const handleDownload = async (run: BackupRun) => {
    if (!run.file_path) return;
    const { data, error } = await supabase.storage
      .from('backups')
      .createSignedUrl(run.file_path, 300);
    if (error || !data?.signedUrl) {
      notify.error(error?.message ?? 'No s\'ha pogut crear l\'enllaç');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const openRestore = (run: BackupRun) => {
    setRestoreTarget(run);
    setRestoreReport(null);
    setConfirmText('');
    setGroupConfig({
      catalog: { enabled: false, mode: 'upsert' },
      content: { enabled: false, mode: 'upsert' },
      config: { enabled: false, mode: 'upsert' },
      templates: { enabled: false, mode: 'upsert' },
      sales: { enabled: false, mode: 'upsert' },
      messages: { enabled: false, mode: 'upsert' },
    });
    setRestoreOpen(true);
  };

  const selectedGroups = useMemo(
    () => BACKUP_GROUPS.filter(g => groupConfig[g.id].enabled),
    [groupConfig]
  );
  const hasWipe = selectedGroups.some(g => groupConfig[g.id].mode === 'wipe');
  const canExecute = selectedGroups.length > 0 && (!hasWipe || confirmText === 'RESTAURAR');

  const handleRestore = async () => {
    if (!restoreTarget || !canExecute) return;
    setRestoring(true);
    setRestoreReport(null);
    try {
      const payload = {
        backup_id: restoreTarget.id,
        groups: selectedGroups.map(g => ({ id: g.id, mode: groupConfig[g.id].mode })),
      };
      const { data, error } = await supabase.functions.invoke('admin-backup-restore', {
        body: payload,
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error + (((data as any).detail) ? `: ${(data as any).detail}` : ''));
      setRestoreReport((data as any).report);
      notify.success(t('admin.restoreOk', 'Restauració completada'));
      qc.invalidateQueries();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold mb-1">
            {t('admin.backups', 'Còpies de seguretat')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('admin.backupsIntro', 'Snapshot lògic de les dades i del Storage. No inclou comptes d\'autenticació.')}
          </p>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={creating}>
          {creating ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('admin.creatingBackup', 'Creant còpia...')}</>
          ) : (
            <><Database className="mr-2 h-4 w-4" />{t('admin.createBackup', 'Crear còpia ara')}</>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('admin.backupHistory', 'Historial')}</CardTitle>
            <CardDescription>
              {t('admin.backupHistoryDesc', 'Les còpies es guarden al bucket privat «backups».')}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4">{t('common.loading')}</p>
          ) : runs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              {t('admin.noBackups', 'Encara no hi ha cap còpia.')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.date', 'Data')}</TableHead>
                  <TableHead>{t('admin.author', 'Autor')}</TableHead>
                  <TableHead>{t('admin.size', 'Mida')}</TableHead>
                  <TableHead>{t('admin.status', 'Estat')}</TableHead>
                  <TableHead>{t('admin.contents', 'Contingut')}</TableHead>
                  <TableHead className="text-right">{t('admin.actions', 'Accions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(run => {
                  const tableTotal = run.tables_json
                    ? Object.values(run.tables_json).reduce((a, b) => a + b, 0)
                    : 0;
                  const storageTotal = run.storage_json
                    ? Object.values(run.storage_json).reduce((a, b) => a + b, 0)
                    : 0;
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(run.started_at), 'dd/MM/yyyy HH:mm', { locale: ca })}
                      </TableCell>
                      <TableCell className="text-sm">{run.created_by_email ?? '—'}</TableCell>
                      <TableCell className="text-sm">{formatBytes(run.file_size_bytes)}</TableCell>
                      <TableCell>
                        {run.status === 'success' && <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">OK</Badge>}
                        {run.status === 'running' && <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>}
                        {run.status === 'failed' && <Badge variant="destructive" title={run.error ?? ''}>Failed</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1"><Database className="h-3 w-3" />{tableTotal} files</div>
                        <div className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{storageTotal} fitxers</div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost" size="sm"
                          disabled={run.status !== 'success'}
                          onClick={() => handleDownload(run)}
                          title={t('admin.download', 'Descarregar')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          disabled={run.status !== 'success'}
                          onClick={() => openRestore(run)}
                          title={t('admin.restore', 'Restaurar')}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setDeleteTarget(run)}
                          title={t('common.delete', 'Eliminar')}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Restore dialog */}
      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.restoreBackup', 'Restaurar còpia de seguretat')}</DialogTitle>
            <DialogDescription>
              {t('admin.restoreBackupDesc', 'Tria quins grups vols restaurar i amb quin mode. Upsert combina; Wipe esborra i reimporta.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {BACKUP_GROUPS.map(g => {
              const cfg = groupConfig[g.id];
              return (
                <div key={g.id} className="border border-border rounded-md p-3 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={cfg.enabled}
                      onCheckedChange={(v) => setGroupConfig(s => ({ ...s, [g.id]: { ...s[g.id], enabled: !!v } }))}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{g.label}</div>
                      <div className="text-xs text-muted-foreground">{g.description}</div>
                    </div>
                  </label>
                  {cfg.enabled && (
                    <div className="flex gap-2 ml-7">
                      <button
                        type="button"
                        onClick={() => setGroupConfig(s => ({ ...s, [g.id]: { ...s[g.id], mode: 'upsert' } }))}
                        className={`px-3 py-1 rounded-md text-xs border ${cfg.mode === 'upsert' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
                      >
                        Upsert
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroupConfig(s => ({ ...s, [g.id]: { ...s[g.id], mode: 'wipe' } }))}
                        className={`px-3 py-1 rounded-md text-xs border ${cfg.mode === 'wipe' ? 'bg-destructive text-destructive-foreground border-destructive' : 'border-border'}`}
                      >
                        Wipe + reimport
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasWipe && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
              <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1 space-y-2 text-sm">
                <p className="font-medium text-destructive">
                  {t('admin.wipeWarning', 'El mode Wipe esborra completament les taules seleccionades abans de reimportar. Es perdran tots els canvis posteriors al backup.')}
                </p>
                <p className="text-xs">{t('admin.wipeConfirmHint', 'Escriu RESTAURAR per confirmar.')}</p>
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="RESTAURAR"
                  className="font-mono"
                />
              </div>
            </div>
          )}

          {restoreReport && (
            <div className="border border-border rounded-md p-3 bg-muted/30 text-xs space-y-2 max-h-60 overflow-y-auto">
              <p className="font-medium">{t('admin.restoreReport', 'Informe de restauració')}</p>
              <pre className="whitespace-pre-wrap">{JSON.stringify(restoreReport, null, 2)}</pre>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreOpen(false)}>
              {t('common.close', 'Tancar')}
            </Button>
            <Button
              onClick={handleRestore}
              disabled={!canExecute || restoring}
              variant={hasWipe ? 'destructive' : 'default'}
            >
              {restoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('admin.executeRestore', 'Executar restauració')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.deleteBackup', 'Eliminar còpia?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.deleteBackupDesc', 'S\'eliminarà el fitxer del Storage i el registre d\'historial. Aquesta acció no es pot desfer.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete', 'Eliminar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminBackups;
