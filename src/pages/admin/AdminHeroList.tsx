import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Heros</h1>
          <p className="text-muted-foreground text-sm">Gestiona els slides del carrusel de la home.</p>
        </div>
        <Button onClick={() => navigate('/admin/heros/nou')} className="gap-2">
          <Plus className="h-4 w-4" /> Nou hero
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregant...</div>
      ) : slides.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">No hi ha cap hero encara.</p>
          <Button onClick={() => navigate('/admin/heros/nou')} className="gap-2">
            <Plus className="h-4 w-4" /> Crea el primer hero
          </Button>
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
