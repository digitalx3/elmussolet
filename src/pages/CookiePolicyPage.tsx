import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useCookieConsent } from '@/contexts/CookieConsentContext';

const CookiePolicyPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const { categories, cookies, openPreferences, loading } = useCookieConsent();

  const title = t('cookies.policy.title', 'Política de cookies');
  const intro = lang === 'es'
    ? 'En esta página explicamos qué cookies utilizamos y con qué finalidad. Puedes cambiar tus preferencias en cualquier momento.'
    : 'En aquesta pàgina expliquem quines cookies utilitzem i amb quina finalitat. Pots canviar les preferències en qualsevol moment.';

  const grouped = categories
    .filter(c => c.is_required || c.is_enabled)
    .map(c => ({
      cat: c,
      items: cookies.filter(ck => ck.category_id === c.id),
    }));

  return (
    <div className="container py-10 max-w-4xl">
      <Helmet>
        <title>{title} | El Mussolet</title>
        <meta name="description" content={intro.slice(0, 155)} />
      </Helmet>
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">{title}</h1>
      <p className="text-muted-foreground mb-6">{intro}</p>

      <div className="mb-8">
        <Button onClick={openPreferences}>
          {t('cookies.policy.changePrefs', 'Canviar preferències de cookies')}
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">{t('common.loading', 'Carregant...')}</p>}

      <div className="space-y-8">
        {grouped.map(({ cat, items }) => (
          <section key={cat.id}>
            <h2 className="font-display text-xl font-semibold mb-2">
              {lang === 'es' ? cat.name_es : cat.name_ca}
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              {lang === 'es' ? cat.description_es : cat.description_ca}
            </p>
            {items.length > 0 ? (
              <div className="overflow-x-auto border border-border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="py-2 px-3 font-medium">{t('cookies.table.name', 'Nom')}</th>
                      <th className="py-2 px-3 font-medium">{t('cookies.table.provider', 'Proveïdor')}</th>
                      <th className="py-2 px-3 font-medium">{t('cookies.table.purpose', 'Finalitat')}</th>
                      <th className="py-2 px-3 font-medium">{t('cookies.table.duration', 'Durada')}</th>
                      <th className="py-2 px-3 font-medium">{t('cookies.table.type', 'Tipus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(ck => (
                      <tr key={ck.id} className="border-t border-border">
                        <td className="py-2 px-3 font-mono">{ck.name}</td>
                        <td className="py-2 px-3">{ck.provider}</td>
                        <td className="py-2 px-3">{lang === 'es' ? ck.purpose_es : ck.purpose_ca}</td>
                        <td className="py-2 px-3">{ck.duration || '—'}</td>
                        <td className="py-2 px-3">{ck.type === 'third_party' ? t('cookies.table.thirdParty', 'Tercers') : t('cookies.table.firstParty', 'Pròpia')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                {t('cookies.preferences.empty', 'No s\'han registrat cookies en aquesta categoria.')}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default CookiePolicyPage;
