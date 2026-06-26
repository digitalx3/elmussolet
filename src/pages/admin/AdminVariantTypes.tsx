import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { notify } from '@/lib/notify';
import { SlugInput, validateSlugValue } from '@/components/admin/SlugInput';
import { checkBaseSlugDuplicate, checkTranslationSlugDuplicate } from '@/lib/checkSlugDuplicate';
import { useDuplicateSlugErrors, hasAnySlugError } from '@/hooks/useDuplicateSlugErrors';


interface VariantTypeRow {
  id: string;
  slug: string;
  variant_type_translations: { id: string; language: string; name: string; slug: string | null }[];
}

const slugifyStr = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

function useVariantTypesFull() {
  return useQuery({
    queryKey: ['variant-types-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('variant_types')
        .select('id, slug, variant_type_translations(id, language, name, slug)')
        .order('slug');
      if (error) throw error;
      return data as unknown as VariantTypeRow[];
    },
  });
}


const AdminVariantTypes: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: types = [], isLoading } = useVariantTypesFull();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formSlug, setFormSlug] = useState('');
  const [formNameCa, setFormNameCa] = useState('');
  const [formNameEs, setFormNameEs] = useState('');
  const [formSlugCa, setFormSlugCa] = useState('');
  const [formSlugEs, setFormSlugEs] = useState('');


  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['variant-types-full'] });
    qc.invalidateQueries({ queryKey: ['variant-types'] });
  };

  const saveMutation = useMutation({
    mutationFn: async ({ id, slug, nameCa, nameEs, slugCa, slugEs }: {
      id?: string; slug: string; nameCa: string; nameEs: string; slugCa: string; slugEs: string;
    }) => {
      const finalBaseSlug = slug?.trim() ? slugifyStr(slug) : slugifyStr(nameCa) || slugifyStr(nameEs);
      if (!finalBaseSlug || !nameCa) throw new Error('Slug i nom (CA) són obligatoris');

      let typeId = id;
      if (id) {
        const { error } = await supabase.from('variant_types').update({ slug: finalBaseSlug }).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('variant_types').insert({ slug: finalBaseSlug }).select('id').single();
        if (error) throw error;
        typeId = data.id;
      }

      await supabase.from('variant_type_translations').delete().eq('variant_type_id', typeId!);
      const trCaSlug = slugCa?.trim() ? slugifyStr(slugCa) : slugifyStr(nameCa);
      const trEsSlug = slugEs?.trim() ? slugifyStr(slugEs) : (nameEs ? slugifyStr(nameEs) : null);
      const translations = [
        { variant_type_id: typeId!, language: 'ca', name: nameCa, slug: trCaSlug || null },
        ...(nameEs ? [{ variant_type_id: typeId!, language: 'es', name: nameEs, slug: trEsSlug }] : []),
      ];
      const { error: tErr } = await supabase.from('variant_type_translations').insert(translations);
      if (tErr) throw tErr;
    },

    onSuccess: () => {
      invalidate();
      resetForm();
      notify.success('Atribut guardat');
    },
    onError: (err: any) => notify.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('variant_type_translations').delete().eq('variant_type_id', id);
      const { error } = await supabase.from('variant_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      notify.success('Atribut eliminat');
    },
    onError: (err: any) => notify.error(err.message),
  });

  const resetForm = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormSlug('');
    setFormNameCa('');
    setFormNameEs('');
    setFormSlugCa('');
    setFormSlugEs('');
  };

  const startEdit = (vt: VariantTypeRow) => {
    setIsCreating(false);
    setEditingId(vt.id);
    setFormSlug(vt.slug);
    const trCa = vt.variant_type_translations.find(t => t.language === 'ca');
    const trEs = vt.variant_type_translations.find(t => t.language === 'es');
    setFormNameCa(trCa?.name || vt.slug);
    setFormNameEs(trEs?.name || '');
    setFormSlugCa((trCa as any)?.slug || '');
    setFormSlugEs((trEs as any)?.slug || '');
  };

  const startCreate = () => {
    setEditingId(null);
    setIsCreating(true);
    setFormSlug('');
    setFormNameCa('');
    setFormNameEs('');
    setFormSlugCa('');
    setFormSlugEs('');
  };

  const onNameCaChange = (val: string) => {
    const prevAuto = slugifyStr(formNameCa);
    setFormNameCa(val);
    if (!formSlugCa || formSlugCa === prevAuto) setFormSlugCa(slugifyStr(val));
    if (!formSlug || formSlug === prevAuto) setFormSlug(slugifyStr(val));
  };
  const onNameEsChange = (val: string) => {
    const prevAuto = slugifyStr(formNameEs);
    setFormNameEs(val);
    if (!formSlugEs || formSlugEs === prevAuto) setFormSlugEs(slugifyStr(val));
  };

  const handleSave = () => {
    for (const [label, val] of [['base', formSlug], ['CA', formSlugCa], ['ES', formSlugEs]] as const) {
      const err = validateSlugValue(val || '', true);
      if (err) { notify.error(`Slug ${label} no vàlid: ${err}`); return; }
    }
    saveMutation.mutate({
      id: editingId || undefined,
      slug: formSlug,
      nameCa: formNameCa,
      nameEs: formNameEs,
      slugCa: formSlugCa,
      slugEs: formSlugEs,
    });
  };



  const getName = (vt: VariantTypeRow) => {
    const ca = vt.variant_type_translations.find(t => t.language === 'ca');
    return ca?.name || vt.slug;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{t('admin.attributes')}</h1>
        {!isCreating && !editingId && (
          <Button onClick={startCreate} className="gap-1">
            <Plus className="h-4 w-4" /> {t('common.create')}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Gestiona els tipus d'atributs (com Color, Talla, Edat…) que després podràs assignar com a variants als productes.
      </p>

      {/* Create / Edit form */}
      {(isCreating || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? 'Editar atribut' : 'Nou atribut'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Nom (CA) *</Label>
                <Input value={formNameCa} onChange={e => onNameCaChange(e.target.value)} placeholder="Color" />
              </div>
              <div>
                <Label>Nom (ES)</Label>
                <Input value={formNameEs} onChange={e => onNameEsChange(e.target.value)} placeholder="Color" />
              </div>
              <SlugInput
                label="Slug base"
                value={formSlug}
                onChange={setFormSlug}
                placeholder="auto des del nom"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SlugInput label="Slug (CA)" value={formSlugCa} onChange={setFormSlugCa} placeholder="auto" />
              <SlugInput label="Slug (ES)" value={formSlugEs} onChange={setFormSlugEs} placeholder="auto" />
            </div>


            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-1">
                <Check className="h-4 w-4" /> {t('common.save')}
              </Button>
              <Button variant="outline" onClick={resetForm} className="gap-1">
                <X className="h-4 w-4" /> {t('common.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">{t('common.loading')}</p>
          ) : types.length === 0 ? (
            <p className="p-6 text-muted-foreground">No hi ha atributs creats encara.</p>
          ) : (
            <div className="divide-y divide-border">
              {types.map(vt => (
                <div key={vt.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <span className="font-medium">{getName(vt)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({vt.slug})</span>
                    {vt.variant_type_translations.find(t => t.language === 'es') && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ES: {vt.variant_type_translations.find(t => t.language === 'es')?.name}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(vt)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar atribut?</AlertDialogTitle>
                          <AlertDialogDescription>
                            S'eliminaran totes les variants de producte associades a aquest tipus. Aquesta acció no es pot desfer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(vt.id)}>
                            {t('common.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminVariantTypes;
