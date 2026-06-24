import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, Send, Server, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ca } from 'date-fns/locale';

interface SmtpLogRow {
  id: string;
  created_at: string;
  recipient: string;
  subject: string;
  smtp_host: string | null;
  test_mode: boolean;
  success: boolean;
  error_message: string | null;
}


interface SmtpRow {
  id?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  security: 'none' | 'ssl' | 'tls' | 'starttls';
  from_email: string;
  from_name: string;
  is_active: boolean;
}

const DEFAULTS: SmtpRow = {
  host: '', port: 587, username: '', password: '',
  security: 'starttls', from_email: '', from_name: '', is_active: false,
};

const AdminSmtpSettings: React.FC = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState<SmtpRow>(DEFAULTS);
  const [testRecipient, setTestRecipient] = useState('');

  const { data: existing, isLoading } = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('smtp_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SmtpRow | null;
    },
  });

  useEffect(() => {
    if (existing) setForm({ ...DEFAULTS, ...existing });
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (existing?.id) {
        const { error } = await supabase.from('smtp_settings').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('smtp_settings').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['smtp-settings'] }); toast.success('Configuració desada'); },
    onError: (e: any) => toast.error(e.message || 'Error desant'),
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      if (!testRecipient) throw new Error('Indica un correu de destí');
      const { data, error } = await supabase.functions.invoke('send-smtp-email', {
        body: {
          to: testRecipient,
          subject: 'Test SMTP — El Mussolet',
          html: `<p>Aquest és un correu de prova enviat des de l'administració.</p><p>Servidor: <b>${form.host}:${form.port}</b> (${form.security}).</p>`,
          testMode: true,
          override: {
            host: form.host, port: form.port, username: form.username, password: form.password,
            security: form.security, from_email: form.from_email, from_name: form.from_name,
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => toast.success('Correu de prova enviat'),
    onError: (e: any) => toast.error('Error: ' + (e?.message || 'desconegut')),
  });

  const upd = (patch: Partial<SmtpRow>) => setForm(p => ({ ...p, ...patch }));

  if (isLoading) return <p className="text-muted-foreground py-8">Carregant…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Server className="h-6 w-6" /> Servidor SMTP
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configura el teu propi servidor SMTP per enviar els correus transaccionals (contacte, comandes, etc.).
        </p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuració</TabsTrigger>
          <TabsTrigger value="log">Registre d'enviaments</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connexió</CardTitle>
              <CardDescription>Dades del servidor de correu sortint.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3">
            <div>
              <Label>Servidor de sortida (host)</Label>
              <Input value={form.host} onChange={e => upd({ host: e.target.value })} placeholder="smtp.elmeudomini.cat" />
            </div>
            <div>
              <Label>Port</Label>
              <Input type="number" value={form.port} onChange={e => upd({ port: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Usuari</Label>
              <Input value={form.username} onChange={e => upd({ username: e.target.value })} placeholder="noreply@elmeudomini.cat" autoComplete="off" />
            </div>
            <div>
              <Label>Contrasenya</Label>
              <Input type="password" value={form.password} onChange={e => upd({ password: e.target.value })} autoComplete="new-password" />
            </div>
          </div>

          <div>
            <Label>Tipus de seguretat</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.security}
              onChange={e => upd({ security: e.target.value as SmtpRow['security'] })}
            >
              <option value="starttls">STARTTLS (recomanat — port 587)</option>
              <option value="ssl">SSL / TLS implícit (port 465)</option>
              <option value="tls">TLS</option>
              <option value="none">Cap (sense xifrar — no recomanat)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Email del remitent</Label>
              <Input value={form.from_email} onChange={e => upd({ from_email: e.target.value })} placeholder="noreply@elmeudomini.cat" />
            </div>
            <div>
              <Label>Nom del remitent</Label>
              <Input value={form.from_name} onChange={e => upd({ from_name: e.target.value })} placeholder="El Mussolet" />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Switch checked={form.is_active} onCheckedChange={v => upd({ is_active: v })} />
            <span className="text-sm">Activar aquesta configuració per als enviaments del lloc</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Provar enviament</CardTitle>
          <CardDescription>Envia un correu de prova amb la configuració actual (no cal desar abans).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="destinatari@exemple.com"
              value={testRecipient}
              onChange={e => setTestRecipient(e.target.value)}
              type="email"
            />
            <Button onClick={() => sendTest.mutate()} disabled={sendTest.isPending} className="gap-1">
              {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar prova
            </Button>
          </div>
        </CardContent>
      </Card>

          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Desar configuració
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <SmtpLogPanel />
        </TabsContent>
      </Tabs>
    </div>

  );
};

const SmtpLogPanel: React.FC = () => {
  const qc = useQueryClient();
  const [purgeMode, setPurgeMode] = useState<'older30' | 'all'>('older30');

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['smtp-send-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('smtp_send_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as SmtpLogRow[];
    },
  });

  const purge = useMutation({
    mutationFn: async () => {
      let q = supabase.from('smtp_send_log').delete();
      if (purgeMode === 'older30') {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        q = q.lt('created_at', cutoff);
      } else {
        // delete all rows: use a filter that always matches
        q = q.not('id', 'is', null);
      }
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['smtp-send-log'] });
      toast.success(purgeMode === 'all' ? 'Registre buidat' : 'Registres antics esborrats');
    },
    onError: (e: any) => toast.error(e?.message || 'Error esborrant'),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-lg">Registre d'enviaments</CardTitle>
          <CardDescription>Últims 100 intents d'enviament SMTP (correctes i errors).</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualitzar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1" disabled={logs.length === 0}>
                <Trash2 className="h-4 w-4" />
                Esborrar logs
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Esborrar registres SMTP?</AlertDialogTitle>
                <AlertDialogDescription>
                  Aquesta acció no es pot desfer. Tria quins registres vols eliminar:
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="purge-mode"
                    checked={purgeMode === 'older30'}
                    onChange={() => setPurgeMode('older30')}
                  />
                  Esborrar només registres més antics de 30 dies
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="purge-mode"
                    checked={purgeMode === 'all'}
                    onChange={() => setPurgeMode('all')}
                  />
                  Esborrar <b>tots</b> els registres
                </label>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => purge.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Confirmar esborrat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Carregant…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">Encara no hi ha enviaments registrats.</p>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Destinatari</TableHead>
                  <TableHead className="text-xs">Assumpte</TableHead>
                  <TableHead className="text-xs">Estat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(l.created_at), 'dd/MM/yy HH:mm:ss', { locale: ca })}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{l.recipient}</span>
                        {l.test_mode && (
                          <Badge variant="outline" className="text-[10px]">prova</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[260px] truncate" title={l.subject}>
                      {l.subject}
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.success ? (
                        <Badge className="text-[10px] border bg-green-100 text-green-800 border-green-200 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Enviat
                        </Badge>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <Badge className="text-[10px] border bg-red-100 text-red-800 border-red-200 gap-1 w-fit">
                            <XCircle className="h-3 w-3" /> Error
                          </Badge>
                          {l.error_message && (
                            <span className="text-[10px] text-muted-foreground max-w-[300px] truncate" title={l.error_message}>
                              {l.error_message}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminSmtpSettings;

