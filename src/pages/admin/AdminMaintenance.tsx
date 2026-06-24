import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Plus, Trash2, MapPin, Save } from 'lucide-react';
import RichTextEditor from '@/components/ui/rich-text-editor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MaintenanceSettings {
  enabled: boolean;
  show_logo: boolean;
  message_ca: string;
  message_es: string;
  allowed_ips: string[];
}

const IP_OR_CIDR = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)(?:\/(?:[0-9]|[12]\d|3[0-2]))?$/;

const AdminMaintenance: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [state, setState] = React.useState<MaintenanceSettings>({
    enabled: false,
    show_logo: true,
    message_ca: '',
    message_es: '',
    allowed_ips: [],
  });
  const [newIp, setNewIp] = React.useState('');
  const [myIp, setMyIp] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('maintenance_settings')
      .select('enabled, show_logo, message_ca, message_es, allowed_ips')
      .limit(1)
      .maybeSingle();
    if (error) {
      toast.error('Error carregant la configuració');
    } else if (data) {
      setState({
        enabled: data.enabled,
        show_logo: data.show_logo,
        message_ca: data.message_ca ?? '',
        message_es: data.message_es ?? '',
        allowed_ips: data.allowed_ips ?? [],
      });
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
    supabase.functions
      .invoke('check-maintenance-access')
      .then(({ data }) => {
        if (data?.client_ip) setMyIp(data.client_ip);
      })
      .catch(() => {});
  }, [load]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('maintenance_settings')
      .update({
        enabled: state.enabled,
        show_logo: state.show_logo,
        message_ca: state.message_ca,
        message_es: state.message_es,
        allowed_ips: state.allowed_ips,
        updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      .eq('id', '00000000-0000-0000-0000-000000000001');
    setSaving(false);
    if (error) {
      toast.error('Error guardant: ' + error.message);
    } else {
      toast.success('Configuració desada');
      try {
        sessionStorage.removeItem('maintenance.state.v1');
      } catch { /* ignore */ }
    }
  };

  const addIp = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (!IP_OR_CIDR.test(v)) {
      toast.error('Format no vàlid (IPv4 o CIDR, ex. 192.168.1.10 o 10.0.0.0/24)');
      return;
    }
    if (state.allowed_ips.includes(v)) {
      toast.info('Aquesta IP ja és a la llista');
      return;
    }
    setState((s) => ({ ...s, allowed_ips: [...s.allowed_ips, v] }));
    setNewIp('');
  };

  const removeIp = (ip: string) => {
    setState((s) => ({ ...s, allowed_ips: s.allowed_ips.filter((x) => x !== ip) }));
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Carregant...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Mode manteniment</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Quan s'activa, els visitants veuen una pàgina de manteniment. Els administradors autenticats sempre poden accedir des de <code>/login</code>.
        </p>
      </div>

      {state.enabled && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mode manteniment ACTIU</AlertTitle>
          <AlertDescription>
            La botiga no és accessible per als visitants normals.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Estat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Activar mode manteniment</Label>
              <p className="text-sm text-muted-foreground">Bloqueja l'accés públic a la web.</p>
            </div>
            <Switch
              checked={state.enabled}
              onCheckedChange={(v) => setState((s) => ({ ...s, enabled: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Mostrar logo</Label>
              <p className="text-sm text-muted-foreground">Mostra el logo del lloc a la pàgina de manteniment.</p>
            </div>
            <Switch
              checked={state.show_logo}
              onCheckedChange={(v) => setState((s) => ({ ...s, show_logo: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Missatge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Missatge (Català)</Label>
            <RichTextEditor
              value={state.message_ca}
              onChange={(html) => setState((s) => ({ ...s, message_ca: html }))}
              placeholder="Tornarem ben aviat..."
            />
          </div>
          <div>
            <Label className="mb-2 block">Missatge (Castellà)</Label>
            <RichTextEditor
              value={state.message_es}
              onChange={(html) => setState((s) => ({ ...s, message_es: html }))}
              placeholder="Volvemos enseguida..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IPs autoritzades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Aquestes IPs poden navegar per la web encara que el mode manteniment estigui actiu.
            Accepta IPv4 o blocs CIDR (ex. <code>10.0.0.0/24</code>).
          </p>

          {myIp && (
            <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-md p-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>La teva IP actual: <code className="font-mono">{myIp}</code></span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => addIp(myIp)}
                disabled={state.allowed_ips.includes(myIp)}
              >
                Afegir la meva IP
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="192.168.1.10 o 10.0.0.0/24"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIp(newIp); } }}
            />
            <Button type="button" onClick={() => addIp(newIp)}>
              <Plus className="h-4 w-4 mr-1" />Afegir
            </Button>
          </div>

          <div className="space-y-2">
            {state.allowed_ips.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No hi ha IPs autoritzades.</p>
            ) : (
              state.allowed_ips.map((ip) => (
                <div key={ip} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <code className="font-mono text-sm">{ip}</code>
                  <Button size="sm" variant="ghost" onClick={() => removeIp(ip)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Desant...' : 'Desar canvis'}
        </Button>
      </div>
    </div>
  );
};

export default AdminMaintenance;
