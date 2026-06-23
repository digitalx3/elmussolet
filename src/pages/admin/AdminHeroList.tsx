import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { createDefaultHeroSlide, DEFAULT_HERO_NAME } from '@/lib/defaultHeroSlide';

const AdminHeroList: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

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
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['hero-slides-admin'] });
      qc.invalidateQueries({ queryKey: ['hero-slides-public'] });
      toast.success(vars.is_active ? 'Hero publicat al front-office' : 'Hero passat a esborrany');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hero_slides').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hero-slides-admin'] });
      qc.invalidateQueries({ queryKey: ['hero-slides-public'] });
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
      qc.invalidateQueries({ queryKey: ['hero-slides-public'] });
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
      const payload = createDefaultHeroSlide({ is_active: false, sort_order }) as never;
      const { data, error } = await supabase.from('hero_slides').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['hero-slides-admin'] });
      qc.invalidateQueries({ queryKey: ['hero-slides-public'] });
      toast.success('Plantilla creada com a esborrany');
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hero-slides-admin'] });
      qc.invalidateQueries({ queryKey: ['hero-slides-public'] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Heros</h1>
          <p className="text-muted-foreground text-sm">Gestiona els slides del carrusel de la home.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="default" onClick={() => navigate('/admin/heros/portada-defecte')} className="gap-2">
            <Pencil className="h-4 w-4" /> Editar portada per defecte
          </Button>
          <Button variant="outline" onClick={() => seedDefault.mutate()} disabled={seedDefault.isPending} className="gap-2">
            <Sparkles className="h-4 w-4" /> Crear des de plantilla
          </Button>
          <Button onClick={() => navigate('/admin/heros/nou')} className="gap-2">
            <Plus className="h-4 w-4" /> Nou hero (esborrany)
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregant...</div>
      ) : slides.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">
            No hi ha cap hero personalitzat. La home mostra la portada per defecte, que pots editar amb el botó "Editar portada per defecte".
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            <Button variant="default" onClick={() => navigate('/admin/heros/portada-defecte')} className="gap-2">
              <Pencil className="h-4 w-4" /> Editar portada per defecte
            </Button>
            <Button onClick={() => navigate('/admin/heros/nou')} className="gap-2">
              <Plus className="h-4 w-4" /> Crear hero en esborrany
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
                <div className="flex items-center gap-2 min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  <Badge variant={s.is_active ? 'default' : 'secondary'}>
                    {s.is_active ? 'Publicat' : 'Esborrany'}
                  </Badge>
                </div>
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
