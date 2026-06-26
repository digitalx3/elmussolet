import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ShippingZone {
  id: string;
  name: string;
  postal_code_pattern: string;
  is_active: boolean;
  sort_order: number;
}

interface ShippingRate {
  id: string;
  zone_id: string;
  min_weight_grams: number;
  max_weight_grams: number;
  price: number;
}

function useShippingZones() {
  return useQuery({
    queryKey: ['admin-shipping-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_zones')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as ShippingZone[];
    },
  });
}

function useShippingRates() {
  return useQuery({
    queryKey: ['admin-shipping-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_rates')
        .select('*')
        .order('min_weight_grams');
      if (error) throw error;
      return data as ShippingRate[];
    },
  });
}

const emptyZone = { name: '', postal_code_pattern: '', is_active: true, sort_order: 0 };
const emptyRate = { min_weight_grams: 0, max_weight_grams: 0, price: 0 };

const AdminShipping: React.FC = () => {
  const qc = useQueryClient();
  const { data: zones = [], isLoading: zonesLoading } = useShippingZones();
  const { data: rates = [], isLoading: ratesLoading } = useShippingRates();

  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState(emptyZone);
  const [addingZone, setAddingZone] = useState(false);

  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState(emptyRate);
  const [addingRateForZone, setAddingRateForZone] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-shipping-zones'] });
    qc.invalidateQueries({ queryKey: ['admin-shipping-rates'] });
  };

  // --- Zone mutations ---
  const saveZone = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: typeof emptyZone }) => {
      if (id) {
        const { error } = await supabase.from('shipping_zones').update(data).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shipping_zones').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); notify.success('Zona guardada'); },
    onError: (e: any) => notify.error(e.message),
  });

  const deleteZone = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('shipping_rates').delete().eq('zone_id', id);
      const { error } = await supabase.from('shipping_zones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); notify.success('Zona eliminada'); },
    onError: (e: any) => notify.error(e.message),
  });

  // --- Rate mutations ---
  const saveRate = useMutation({
    mutationFn: async ({ id, zone_id, data }: { id?: string; zone_id: string; data: typeof emptyRate }) => {
      if (id) {
        const { error } = await supabase.from('shipping_rates').update(data).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shipping_rates').insert({ ...data, zone_id });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); notify.success('Tarifa guardada'); },
    onError: (e: any) => notify.error(e.message),
  });

  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shipping_rates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); notify.success('Tarifa eliminada'); },
    onError: (e: any) => notify.error(e.message),
  });

  const startEditZone = (zone: ShippingZone) => {
    setEditingZone(zone.id);
    setZoneForm({ name: zone.name, postal_code_pattern: zone.postal_code_pattern, is_active: zone.is_active, sort_order: zone.sort_order });
  };

  const startAddZone = () => {
    setAddingZone(true);
    setZoneForm({ ...emptyZone, sort_order: zones.length });
  };

  const cancelZoneEdit = () => { setEditingZone(null); setAddingZone(false); };

  const submitZone = (id?: string) => {
    if (!zoneForm.name || !zoneForm.postal_code_pattern) {
      notify.error('Omple nom i patró de codi postal');
      return;
    }
    saveZone.mutate({ id, data: zoneForm }, {
      onSuccess: () => { setEditingZone(null); setAddingZone(false); },
    });
  };

  const startEditRate = (rate: ShippingRate) => {
    setEditingRate(rate.id);
    setRateForm({ min_weight_grams: rate.min_weight_grams, max_weight_grams: rate.max_weight_grams, price: rate.price });
  };

  const startAddRate = (zoneId: string) => {
    setAddingRateForZone(zoneId);
    setRateForm({ ...emptyRate });
  };

  const cancelRateEdit = () => { setEditingRate(null); setAddingRateForZone(null); };

  const submitRate = (zoneId: string, id?: string) => {
    if (rateForm.max_weight_grams <= rateForm.min_weight_grams) {
      notify.error('El pes màxim ha de ser major que el mínim');
      return;
    }
    saveRate.mutate({ id, zone_id: zoneId, data: rateForm }, {
      onSuccess: () => { setEditingRate(null); setAddingRateForZone(null); },
    });
  };

  const formatWeight = (g: number) => g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`;

  const ZoneRow = ({ zone, isEditing }: { zone?: ShippingZone; isEditing: boolean }) => {
    if (isEditing) {
      return (
        <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-lg border border-primary/20">
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs">Nom</Label>
            <Input value={zoneForm.name} onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))} placeholder="Local Lleida" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs">Patró codi postal</Label>
            <Input value={zoneForm.postal_code_pattern} onChange={e => setZoneForm(f => ({ ...f, postal_code_pattern: e.target.value }))} placeholder="25___" />
          </div>
          <div className="w-20">
            <Label className="text-xs">Ordre</Label>
            <Input type="number" value={zoneForm.sort_order} onChange={e => setZoneForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={zoneForm.is_active} onCheckedChange={v => setZoneForm(f => ({ ...f, is_active: v }))} />
            <Label className="text-xs">Activa</Label>
          </div>
          <div className="flex gap-1">
            <Button type="button" size="sm" onClick={() => submitZone(zone?.id)} disabled={saveZone.isPending}>
              <Check className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelZoneEdit}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    if (!zone) return null;
    const isExpanded = expandedZone === zone.id;
    const zoneRates = rates.filter(r => r.zone_id === zone.id);

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
            onClick={() => setExpandedZone(isExpanded ? null : zone.id)}>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{zone.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${zone.is_active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                {zone.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Patró: <code className="bg-muted px-1 rounded text-xs">{zone.postal_code_pattern}</code>
              {' · '}{zoneRates.length} tarif{zoneRates.length === 1 ? 'a' : 'es'}
              {' · '}Ordre: {zone.sort_order}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => startEditZone(zone)}>
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
                <AlertDialogTitle>Eliminar zona "{zone.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  S'eliminaran també totes les tarifes associades. Aquesta acció no es pot desfer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteZone.mutate(zone.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {isExpanded && (
          <div className="border-t bg-muted/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Tarifes per pes</h4>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => startAddRate(zone.id)}>
                <Plus className="h-3 w-3" /> Afegir tarifa
              </Button>
            </div>

            {zoneRates.length === 0 && !addingRateForZone && (
              <p className="text-sm text-muted-foreground italic">No hi ha tarifes configurades per aquesta zona.</p>
            )}

            <div className="space-y-2">
              {zoneRates.map(rate => (
                editingRate === rate.id ? (
                  <RateEditRow key={rate.id} zoneId={zone.id} rateId={rate.id} />
                ) : (
                  <div key={rate.id} className="flex items-center gap-3 p-3 bg-background rounded-md border text-sm">
                    <span className="flex-1">
                      {formatWeight(rate.min_weight_grams)} — {formatWeight(rate.max_weight_grams)}
                    </span>
                    <span className="font-semibold text-primary">{rate.price.toFixed(2)} €</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditRate(rate)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar tarifa?</AlertDialogTitle>
                          <AlertDialogDescription>Aquesta acció no es pot desfer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteRate.mutate(rate.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )
              ))}

              {addingRateForZone === zone.id && (
                <RateEditRow zoneId={zone.id} />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const RateEditRow = ({ zoneId, rateId }: { zoneId: string; rateId?: string }) => (
    <div className="flex flex-wrap items-end gap-2 p-3 bg-muted/30 rounded-md border border-primary/20">
      <div className="w-28">
        <Label className="text-[10px]">Pes mín. (g)</Label>
        <Input type="number" min="0" value={rateForm.min_weight_grams}
          onChange={e => setRateForm(f => ({ ...f, min_weight_grams: parseInt(e.target.value) || 0 }))} />
      </div>
      <div className="w-28">
        <Label className="text-[10px]">Pes màx. (g)</Label>
        <Input type="number" min="0" value={rateForm.max_weight_grams}
          onChange={e => setRateForm(f => ({ ...f, max_weight_grams: parseInt(e.target.value) || 0 }))} />
      </div>
      <div className="w-24">
        <Label className="text-[10px]">Preu (€)</Label>
        <Input type="number" step="0.01" min="0" value={rateForm.price}
          onChange={e => setRateForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
      </div>
      <div className="flex gap-1">
        <Button type="button" size="sm" onClick={() => submitRate(zoneId, rateId)} disabled={saveRate.isPending}>
          <Check className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cancelRateEdit}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Zones i tarifes d'enviament</h1>
        <Button onClick={startAddZone} className="gap-1">
          <Plus className="h-4 w-4" /> Nova zona
        </Button>
      </div>

      {(zonesLoading || ratesLoading) && <p className="text-muted-foreground">Carregant...</p>}

      <div className="space-y-3">
        {addingZone && <ZoneRow isEditing />}
        {zones.map(zone =>
          editingZone === zone.id
            ? <ZoneRow key={zone.id} zone={zone} isEditing />
            : <ZoneRow key={zone.id} zone={zone} isEditing={false} />
        )}
        {!zonesLoading && zones.length === 0 && !addingZone && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hi ha zones d'enviament configurades. Crea'n una per començar.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminShipping;
