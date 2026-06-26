import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { Mail, MapPin, Share2, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const KEYS = [
  // Footer texts (rich text / HTML)
  'footer_about_ca', 'footer_about_es',
  'footer_bottom_ca', 'footer_bottom_es',
  // Socials
  'social_instagram_url', 'social_facebook_url', 'social_tiktok_url', 'social_youtube_url',
  // Contact page
  'contact_intro_ca', 'contact_intro_es',
  'contact_map_iframe_url',
];

const AdminContactSettings: React.FC = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('site_settings').select('*');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const map: Record<string, string> = {};
    KEYS.forEach(k => { map[k] = ''; });
    settings.forEach((s: any) => { if (KEYS.includes(s.key)) map[s.key] = s.value; });
    setForm(map);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(form)) {
        const { error } = await supabase
          .from('site_settings')
          .upsert({ key, value }, { onConflict: 'key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-settings'] });
      notify.success('Configuració desada');
    },
    onError: () => notify.error('Error en desar'),
  });

  const update = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  if (isLoading) return <p className="text-muted-foreground py-8">Carregant…</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Peu i contacte</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona els textos del peu de pàgina, les xarxes socials i la pàgina de contacte.
          </p>
        </div>
        <Link to="/admin/missatges">
          <Button variant="outline" size="sm" className="gap-2">
            <Inbox className="h-4 w-4" /> Safata de missatges
          </Button>
        </Link>
      </div>

      {/* Footer texts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" /> Textos del peu de pàgina
          </CardTitle>
          <CardDescription>
            Pots fer servir HTML bàsic (&lt;p&gt;, &lt;a&gt;, &lt;strong&gt;...). El primer bloc apareix sota el logo;
            el segon, a la barra inferior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Sobre nosaltres (català)</Label>
              <Textarea rows={5} value={form.footer_about_ca} onChange={e => update('footer_about_ca', e.target.value)} />
            </div>
            <div>
              <Label>Sobre nosotros (castellà)</Label>
              <Textarea rows={5} value={form.footer_about_es} onChange={e => update('footer_about_es', e.target.value)} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Barra inferior (català)</Label>
              <Textarea rows={3} value={form.footer_bottom_ca} onChange={e => update('footer_bottom_ca', e.target.value)} placeholder="© 2026 ..." />
            </div>
            <div>
              <Label>Barra inferior (castellà)</Label>
              <Textarea rows={3} value={form.footer_bottom_es} onChange={e => update('footer_bottom_es', e.target.value)} placeholder="© 2026 ..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Share2 className="h-5 w-5" /> Xarxes socials
          </CardTitle>
          <CardDescription>Deixa el camp en blanc per ocultar la icona.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Instagram</Label>
            <Input value={form.social_instagram_url} onChange={e => update('social_instagram_url', e.target.value)} placeholder="https://instagram.com/..." />
          </div>
          <div>
            <Label>Facebook</Label>
            <Input value={form.social_facebook_url} onChange={e => update('social_facebook_url', e.target.value)} placeholder="https://facebook.com/..." />
          </div>
          <div>
            <Label>TikTok</Label>
            <Input value={form.social_tiktok_url} onChange={e => update('social_tiktok_url', e.target.value)} placeholder="https://tiktok.com/@..." />
          </div>
          <div>
            <Label>YouTube</Label>
            <Input value={form.social_youtube_url} onChange={e => update('social_youtube_url', e.target.value)} placeholder="https://youtube.com/@..." />
          </div>
        </CardContent>
      </Card>

      {/* Contact page */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" /> Pàgina de contacte
          </CardTitle>
          <CardDescription>
            Text introductori i mapa de Google Maps. Per al mapa, ves a Google Maps → Compartir → Insereix un mapa,
            copia <b>tot el codi <code>&lt;iframe …&gt;&lt;/iframe&gt;</code></b> i enganxa'l al camp següent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Introducció (català)</Label>
              <Textarea rows={3} value={form.contact_intro_ca} onChange={e => update('contact_intro_ca', e.target.value)} />
            </div>
            <div>
              <Label>Introducció (castellà)</Label>
              <Textarea rows={3} value={form.contact_intro_es} onChange={e => update('contact_intro_es', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Codi iframe del mapa (Google Maps)</Label>
            <Textarea
              rows={4}
              value={form.contact_map_iframe_url}
              onChange={e => update('contact_map_iframe_url', e.target.value)}
              placeholder='<iframe src="https://www.google.com/maps/embed?pb=..." width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>'
              className="font-mono text-xs"
            />
            {form.contact_map_iframe_url && (
              <div
                className="mt-3 max-w-md border border-border rounded overflow-hidden [&_iframe]:w-full [&_iframe]:h-[300px] [&_iframe]:block"
                dangerouslySetInnerHTML={{ __html: form.contact_map_iframe_url }}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg">
        {saveMutation.isPending ? 'Desant...' : 'Desa els canvis'}
      </Button>
    </div>
  );
};

export default AdminContactSettings;
