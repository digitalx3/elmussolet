import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { Mail, Trash2, ChevronRight, Send, Lock, Unlock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

const AdminContactMessages: React.FC = () => {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

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

  const { data: repliesByMsg = {} } = useQuery({
    queryKey: ['contact-message-replies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_message_replies')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const grouped: Record<string, any[]> = {};
      for (const r of data || []) {
        (grouped[(r as any).message_id] ||= []).push(r);
      }
      return grouped;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contact_messages').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-messages'] }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'open' | 'closed' }) => {
      const patch: any = { status };
      if (status === 'closed') patch.closed_at = new Date().toISOString();
      else patch.closed_at = null;
      const { error } = await supabase.from('contact_messages').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['contact-messages'] });
      notify.success(vars.status === 'closed' ? 'Conversa tancada' : 'Conversa reoberta');
    },
    onError: (e: any) => notify.error(e?.message || 'Error'),
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

  const sendReply = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { data, error } = await supabase.functions.invoke('reply-contact-message', {
        body: { message_id: id, body },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data: any, vars) => {
      setReplyDrafts((d) => ({ ...d, [vars.id]: '' }));
      qc.invalidateQueries({ queryKey: ['contact-message-replies'] });
      qc.invalidateQueries({ queryKey: ['contact-messages'] });
      if (data?.email_sent === false) {
        notify.warning?.('Resposta guardada però el correu no s\'ha pogut enviar: ' + (data.email_error || ''));
      } else {
        notify.success('Resposta enviada');
      }
    },
    onError: (e: any) => notify.error(e?.message || 'Error enviant resposta'),
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
          · {messages.filter((m: any) => m.status === 'open').length} obert{messages.filter((m: any) => m.status === 'open').length === 1 ? '' : 's'}
        </p>
      </div>

      {messages.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No hi ha cap missatge encara.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {messages.map((m: any) => {
            const isOpen = openId === m.id;
            const replies = (repliesByMsg as any)[m.id] || [];
            const status = m.status || 'open';
            const draft = replyDrafts[m.id] ?? '';
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
                      {status === 'open' ? (
                        <Badge className="text-[10px] h-5 bg-emerald-600 hover:bg-emerald-600 text-white border-transparent">OBERT</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] h-5">TANCAT</Badge>
                      )}
                      {replies.length > 0 && (
                        <Badge variant="outline" className="text-[10px] h-5">{replies.length} resposta{replies.length === 1 ? '' : 's'}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{m.subject || m.message.slice(0, 100)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString('ca-ES')}
                  </span>
                </button>
                {isOpen && (
                  <CardContent className="border-t border-border pt-4 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div><strong>Email:</strong> <a href={`mailto:${m.email}`} className="text-primary hover:underline">{m.email}</a></div>
                      {m.phone && <div><strong>Telèfon:</strong> {m.phone}</div>}
                      {m.subject && <div className="sm:col-span-2"><strong>Assumpte:</strong> {m.subject}</div>}
                      <div><strong>Idioma:</strong> {m.language}</div>
                    </div>

                    {/* Conversation thread */}
                    <div className="space-y-2">
                      <div className="rounded bg-muted p-3 whitespace-pre-wrap text-sm">
                        <div className="text-xs text-muted-foreground mb-1">
                          <strong>{m.name}</strong> · {new Date(m.created_at).toLocaleString('ca-ES')}
                        </div>
                        {m.message}
                      </div>
                      {replies.map((r: any) => (
                        <div
                          key={r.id}
                          className={`rounded p-3 whitespace-pre-wrap text-sm border ${
                            r.direction === 'admin'
                              ? 'bg-primary/5 border-primary/30 ml-6'
                              : 'bg-muted border-transparent mr-6'
                          }`}
                        >
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2 flex-wrap">
                            <strong>{r.direction === 'admin' ? (r.author_name || 'Administració') : m.name}</strong>
                            <span>· {new Date(r.created_at).toLocaleString('ca-ES')}</span>
                            {r.direction === 'admin' && (
                              r.email_sent ? (
                                <span className="text-emerald-600">· enviat</span>
                              ) : (
                                <span className="text-destructive flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" /> correu no enviat
                                </span>
                              )
                            )}
                          </div>
                          {r.body}
                          {r.email_error && (
                            <div className="text-xs text-destructive mt-1">{r.email_error}</div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Reply form */}
                    {status === 'open' ? (
                      <div className="space-y-2 border-t pt-4">
                        <label className="text-sm font-medium">Respondre</label>
                        <Textarea
                          rows={5}
                          placeholder={`Escriu la teva resposta per a ${m.name}…`}
                          value={draft}
                          onChange={(e) => setReplyDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                          maxLength={10000}
                        />
                        <div className="flex justify-between items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            S'enviarà per correu a {m.email} mitjançant el servidor SMTP configurat.
                          </span>
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={!draft.trim() || sendReply.isPending}
                            onClick={() => sendReply.mutate({ id: m.id, body: draft.trim() })}
                          >
                            <Send className="h-4 w-4" />
                            {sendReply.isPending ? 'Enviant…' : 'Enviar resposta'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t pt-3 text-sm text-muted-foreground italic">
                        Conversa tancada{m.closed_at ? ` el ${new Date(m.closed_at).toLocaleString('ca-ES')}` : ''}.
                      </div>
                    )}

                    <div className="flex gap-2 justify-end flex-wrap">
                      {status === 'open' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setStatus.mutate({ id: m.id, status: 'closed' })}
                        >
                          <Lock className="h-4 w-4" /> Tancar conversa
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setStatus.mutate({ id: m.id, status: 'open' })}
                        >
                          <Unlock className="h-4 w-4" /> Reobrir
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          if (confirm('Eliminar aquest missatge i totes les respostes?')) del.mutate(m.id);
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
