import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { z } from 'zod';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().trim().min(2, 'Nom massa curt').max(150),
  email: z.string().trim().email('Email invàlid').max(200),
  phone: z.string().trim().max(60).optional().or(z.literal('')),
  subject: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Missatge massa curt').max(5000),
});

const ContactPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const { data: settings } = useSiteSettings([
    'store_name', 'store_email', 'store_phone', 'store_address',
    'contact_intro_ca', 'contact_intro_es',
    'contact_map_iframe_url',
  ]);

  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const intro = settings?.[`contact_intro_${lang}`] || (lang === 'es'
    ? '¿Tienes alguna pregunta? Escríbenos y te responderemos lo antes posible.'
    : 'Tens alguna pregunta? Escriu-nos i et respondrem el més aviat possible.');
  const mapRaw = settings?.contact_map_iframe_url?.trim();
  const mapIsIframe = !!mapRaw && /<iframe[\s>]/i.test(mapRaw);
  const mapUrl = !mapIsIframe ? mapRaw : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach(i => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('send-contact-email', {
        body: { ...result.data, language: lang },
      });
      if (error) throw error;
      toast.success(lang === 'es' ? 'Mensaje enviado, gracias.' : 'Missatge enviat, gràcies.');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      console.error(err);
      toast.error(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const title = lang === 'es' ? 'Contacto' : 'Contacte';
  return (
    <div className="container py-10">
      <Helmet>
        <title>{`${title} | ${settings?.store_name || 'El Mussolet'}`}</title>
        <meta name="description" content={intro.slice(0, 155)} />
      </Helmet>

      <header className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">{title}</h1>
        <p className="text-muted-foreground">{intro}</p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{lang === 'es' ? 'Envíanos un mensaje' : 'Envia\'ns un missatge'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">{lang === 'es' ? 'Nombre' : 'Nom'} *</Label>
                  <Input id="name" value={form.name} onChange={update('name')} maxLength={150} required />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={form.email} onChange={update('email')} maxLength={200} required />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">{lang === 'es' ? 'Teléfono' : 'Telèfon'}</Label>
                  <Input id="phone" value={form.phone} onChange={update('phone')} maxLength={60} />
                </div>
                <div>
                  <Label htmlFor="subject">{lang === 'es' ? 'Asunto' : 'Assumpte'}</Label>
                  <Input id="subject" value={form.subject} onChange={update('subject')} maxLength={200} />
                </div>
              </div>
              <div>
                <Label htmlFor="message">{lang === 'es' ? 'Mensaje' : 'Missatge'} *</Label>
                <Textarea id="message" value={form.message} onChange={update('message')} rows={6} maxLength={5000} required />
                {errors.message && <p className="text-xs text-destructive mt-1">{errors.message}</p>}
              </div>
              <Button type="submit" disabled={submitting} size="lg" className="gap-2">
                <Send className="h-4 w-4" />
                {submitting ? (lang === 'es' ? 'Enviando...' : 'Enviant...') : (lang === 'es' ? 'Enviar' : 'Envia')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info + Map */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{lang === 'es' ? 'Datos de contacto' : 'Dades de contacte'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {settings?.store_email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href={`mailto:${settings.store_email}`} className="hover:text-primary">{settings.store_email}</a>
                </div>
              )}
              {settings?.store_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${settings.store_phone}`} className="hover:text-primary">{settings.store_phone}</a>
                </div>
              )}
              {settings?.store_address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-primary mt-0.5" />
                  <span>{settings.store_address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {mapIsIframe && mapRaw && (
            <ConsentedMap iframeHtml={mapRaw} />
          )}
          {mapUrl && (
            <ConsentedMap iframeUrl={mapUrl} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
