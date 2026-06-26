import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { Mail, Trash2, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const AdminContactMessages: React.FC = () => {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['contact-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contact_messages').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-messages'] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contact_messages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-messages'] });
      notify.success('Missatge eliminat');
    },
  });

  if (isLoading) return <p className="text-muted-foreground py-8">Carregant…</p>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" /> Missatges de contacte
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {messages.length} missatge{messages.length === 1 ? '' : 's'} · {messages.filter((m: any) => !m.is_read).length} sense llegir
        </p>
      </div>

      {messages.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No hi ha cap missatge encara.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {messages.map((m: any) => {
            const isOpen = openId === m.id;
            return (
              <Card key={m.id} className={!m.is_read ? 'border-primary/40' : ''}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 flex items-center gap-3"
                  onClick={() => {
                    setOpenId(isOpen ? null : m.id);
                    if (!m.is_read) markRead.mutate(m.id);
                  }}
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-sm text-muted-foreground">&lt;{m.email}&gt;</span>
                      {!m.is_read && <Badge variant="default" className="text-[10px] h-5">Nou</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{m.subject || m.message.slice(0, 100)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString('ca-ES')}
                  </span>
                </button>
                {isOpen && (
                  <CardContent className="border-t border-border pt-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div><strong>Email:</strong> <a href={`mailto:${m.email}`} className="text-primary hover:underline">{m.email}</a></div>
                      {m.phone && <div><strong>Telèfon:</strong> {m.phone}</div>}
                      {m.subject && <div className="sm:col-span-2"><strong>Assumpte:</strong> {m.subject}</div>}
                      <div><strong>Idioma:</strong> {m.language}</div>
                    </div>
                    <div className="rounded bg-muted p-3 whitespace-pre-wrap text-sm">{m.message}</div>
                    <div className="flex gap-2 justify-end">
                      <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || 'Contacte')}`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Check className="h-4 w-4" /> Respondre
                        </Button>
                      </a>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          if (confirm('Eliminar aquest missatge?')) del.mutate(m.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> Eliminar
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminContactMessages;
