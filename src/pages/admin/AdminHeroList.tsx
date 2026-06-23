import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { defaultLayout } from '@/components/admin/HeroCanvasEditor';

// Default hero template — mirrors the hardcoded fallback so the admin
// can clone/edit it like any other hero.
const DEFAULT_HERO_TEMPLATE = {
  name: 'Hero per defecte',
  is_active: true,
  background_image_url: null as string | null,
  background_overlay: 0.15,
  badge_text_ca: 'Puericultura amb cor',
  badge_text_es: 'Puericultura con corazón',
  title_ca: 'La teva botiga de puericultura de confiança',
  title_es: 'Tu tienda de puericultura de confianza',
  subtitle_ca: 'Tot el que necessites per al teu nadó, amb la qualitat i la proximitat que mereixes',
  subtitle_es: 'Todo lo que necesitas para tu bebé, con la calidad y la proximidad que mereces',
  button1_text_ca: 'Explora el catàleg',
  button1_text_es: 'Explora el catálogo',
  button1_url: '/cataleg',
  button1_variant: 'default',
  button2_text_ca: 'Accedir a una llista',
  button2_text_es: 'Acceder a una lista',
  button2_url: '/llista-naixement',
  button2_variant: 'outline',
  layout: defaultLayout() as never,
  canvas_heights: { desktop: 600, tablet: 520, mobile: 560 } as never,
  floating_images: [] as never,
};

const AdminHeroList: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const seededRef = React.useRef(false);

  const { data: slides = [], isLoading } = useQuery({
    queryKey: ['hero-slides-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto-seed the default hero so admins can edit the fallback shown on the home page.
  React.useEffect(() => {
    if (isLoading || seededRef.current) return;
    if (slides.length === 0) {
      seededRef.current = true;
      (async () => {
        const payload = { ...DEFAULT_HERO_TEMPLATE, sort_order: 0 } as never;
        const { error } = await supabase.from('hero_slides').insert(payload);
        if (error) {
          console.error('Auto-seed hero failed', error);
          toast.error('No s\'ha pogut crear la plantilla per defecte');
          seededRef.current = false;
        } else {
          qc.invalidateQueries({ queryKey: ['hero-slides-admin'] });
          qc.invalidateQueries({ queryKey: ['hero-slides-public'] });
        }
      })();
    }
  }, [isLoading, slides.length, qc]);

  const nextOrder = async () => {
    const { data: maxRow } = await supabase
      .from('hero_slides')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;
  };

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('hero_slides').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-slides-admin'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hero_slides').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hero-slides-admin'] });
      toast.success('Hero eliminat');
    },
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const original = slides.find((s) => s.id === id);
      if (!original) throw new Error('Hero no trobat');
      const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = original as Record<string, unknown> & { id: string; created_at?: string; updated_at?: string };
      const sort_order = await nextOrder();
      const payload = {
        ...rest,
        name: `${(rest as { name?: string }).name || 'Hero'} (còpia)`,
        is_active: false,
        sort_order,
      } as never;
      const { data, error } = await supabase.from('hero_slides').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['hero-slides-admin'] });
      toast.success('Hero duplicat');
      if (data?.id) navigate(`/admin/heros/${data.id}`);
    },
    onError: (e: unknown) => {
      console.error(e);
      toast.error('Error duplicant');
    },
  });

  const seedDefault = useMutation({
    mutationFn: async () => {
      const sort_order = await nextOrder();
      const payload = { ...DEFAULT_HERO_TEMPLATE, sort_order } as never;
      const { data, error } = await supabase.from('hero_slides').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['hero-slides-admin'] });
      toast.success('Plantilla per defecte creada');
      if (data?.id) navigate(`/admin/heros/${data.id}`);
    },
    onError: (e: unknown) => {
      console.error(e);
      toast.error('Error creant plantilla');
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = slides.findIndex((s) => s.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= slides.length) return;
      const a = slides[idx];
      const b = slides[swapIdx];
      await supabase.from('hero_slides').update({ sort_order: b.sort_order }).eq('id', a.id);
      await supabase.from('hero_slides').update({ sort_order: a.sort_order }).eq('id', b.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-slides-admin'] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Heros</h1>
          <p className="text-muted-foreground text-sm">Gestiona els slides del carrusel de la home.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => seedDefault.mutate()} disabled={seedDefault.isPending} className="gap-2">
            <Sparkles className="h-4 w-4" /> Crear plantilla per defecte
          </Button>
          <Button onClick={() => navigate('/admin/heros/nou')} className="gap-2">
            <Plus className="h-4 w-4" /> Nou hero
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregant...</div>
      ) : slides.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">No hi ha cap hero encara.</p>
          <div className="flex justify-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => seedDefault.mutate()} disabled={seedDefault.isPending} className="gap-2">
              <Sparkles className="h-4 w-4" /> Crear plantilla per defecte
            </Button>
            <Button onClick={() => navigate('/admin/heros/nou')} className="gap-2">
              <Plus className="h-4 w-4" /> Crea el primer hero
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((s, i) => (
            <div key={s.id} className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg">
              <div className="w-32 h-20 rounded overflow-hidden bg-muted shrink-0">
                {s.background_image_url && (
                  <img src={s.background_image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-sm text-muted-foreground truncate">{s.title_ca || s.title_es || '—'}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move.mutate({ id: s.id, dir: -1 })}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled={i === slides.length - 1} onClick={() => move.mutate({ id: s.id, dir: 1 })}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleActive.mutate({ id: s.id, is_active: !s.is_active })}
                  title={s.is_active ? 'Desactivar' : 'Activar'}
                >
                  {s.is_active ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => duplicate.mutate(s.id)}
                  title="Duplicar"
                  disabled={duplicate.isPending}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/heros/${s.id}`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`Eliminar "${s.name}"?`)) remove.mutate(s.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminHeroList;
