import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const CmsPagePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  const { data, isLoading } = useQuery({
    queryKey: ['cms-page', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cms_blocks')
        .select('*')
        .eq('slug', slug!)
        .eq('kind', 'page')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="container py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!data) {
    return (
      <div className="container py-20 text-center">
        <h1 className="font-display text-3xl mb-2">Pàgina no trobada</h1>
        <p className="text-muted-foreground">Aquesta pàgina no existeix o no està disponible.</p>
      </div>
    );
  }

  const title = lang === 'es' ? data.title_es : data.title_ca;
  const content = lang === 'es' ? data.content_es : data.content_ca;

  return (
    <div className="container py-10 md:py-16 max-w-3xl">
      <Helmet><title>{title} – El Mussolet</title></Helmet>
      <h1 className="font-display text-4xl md:text-5xl mb-6 text-foreground">{title}</h1>
      <article
        className="prose prose-neutral max-w-none prose-headings:font-display prose-headings:text-foreground prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: content || '' }}
      />
    </div>
  );
};

export default CmsPagePage;
