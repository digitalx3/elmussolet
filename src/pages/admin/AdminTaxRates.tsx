import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Check, X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTaxRates, type TaxRate } from '@/hooks/useTaxRates';

const emptyForm = { name: '', percentage: 21, country_code: 'ES', region: '', is_default: false, is_active: true };

const AdminTaxRates: React.FC = () => {
  const qc = useQueryClient();
  const { data: taxRates = [], isLoading } = useTaxRates();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tax-rates'] });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: typeof emptyForm }) => {
      const payload = { ...data, region: data.region || null };
      
      // If setting as default, unset others first
      if (data.is_default) {
        await supabase.from('tax_rates').update({ is_default: false }).neq('id', id ?? '');
      }

      if (id) {
        const { error } = await supabase.from('tax_rates').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tax_rates').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast.success('Impost guardat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_rates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Impost eliminat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (rate: TaxRate) => {
    setEditing(rate.id);
    setForm({ name: rate.name, percentage: rate.percentage, country_code: rate.country_code, region: rate.region || '', is_default: rate.is_default, is_active: rate.is_active });
  };

  const startAdd = () => { setAdding(true); setForm({ ...emptyForm }); };
  const cancel = () => { setEditing(null); setAdding(false); };

  const submit = (id?: string) => {
    if (!form.name) { toast.error("Omple el nom de l'impost"); return; }
    saveMutation.mutate({ id, data: form }, { onSuccess: cancel });
  };

  const EditRow = ({ id }: { id?: string }) => (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-lg border border-primary/20">
      <div className="flex-1 min-w-[140px]">
        <Label className="text-xs">Nom</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="IVA General" />
      </div>
      <div className="w-24">
        <Label className="text-xs">% Impost</Label>
        <Input type="number" step="0.01" min="0" max="100" value={form.percentage}
          onChange={e => setForm(f => ({ ...f, percentage: parseFloat(e.target.value) || 0 }))} />
      </div>
      <div className="w-20">
        <Label className="text-xs">País</Label>
        <Input value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))} placeholder="ES" maxLength={2} />
      </div>
      <div className="flex-1 min-w-[120px]">
        <Label className="text-xs">Regió (opcional)</Label>
        <Input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder="Canàries" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
        <Label className="text-xs">Actiu</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} />
        <Label className="text-xs">Per defecte</Label>
      </div>
      <div className="flex gap-1">
        <Button type="button" size="sm" onClick={() => submit(id)} disabled={saveMutation.isPending}>
          <Check className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Impostos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura els tipus impositius aplicables als productes. Els preus dels productes es guarden sense impostos i es mostren amb IVA inclòs a la botiga.
          </p>
        </div>
        <Button onClick={startAdd} className="gap-1">
          <Plus className="h-4 w-4" /> Nou impost
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregant...</p>}

      <div className="space-y-3">
        {adding && <EditRow />}
        {taxRates.map(rate =>
          editing === rate.id ? (
            <EditRow key={rate.id} id={rate.id} />
          ) : (
            <div key={rate.id} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{rate.name}</span>
                  <span className="text-sm font-semibold text-primary">{rate.percentage}%</span>
                  {rate.is_default && (
                    <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-yellow-100 text-yellow-800">
                      <Star className="h-3 w-3" /> Per defecte
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${rate.is_active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                    {rate.is_active ? 'Actiu' : 'Inactiu'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  País: {rate.country_code}
                  {rate.region && ` · Regió: ${rate.region}`}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(rate)}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar "{rate.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>Els productes amb aquest impost assignat es quedaran sense tipus impositiu.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(rate.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )
        )}
        {!isLoading && taxRates.length === 0 && !adding && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hi ha impostos configurats. Crea'n un per començar.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminTaxRates;
