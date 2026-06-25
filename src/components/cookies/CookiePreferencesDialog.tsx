import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useCookieConsent } from '@/contexts/CookieConsentContext';
import type { CookieCategoryKey } from '@/lib/cookieConsent';

const CookiePreferencesDialog: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const {
    preferencesOpen, closePreferences, categories, cookies, consent,
    acceptAll, rejectAll, savePreferences,
  } = useCookieConsent();

  const activeCategories = useMemo(
    () => categories.filter(c => c.is_required || c.is_enabled),
    [categories],
  );

  const [draft, setDraft] = useState<Record<CookieCategoryKey, boolean>>({
    necessary: true, functional: false, analytics: false, marketing: false, third_party: false,
  });

  useEffect(() => {
    if (!preferencesOpen) return;
    const next: Record<CookieCategoryKey, boolean> = {
      necessary: true, functional: false, analytics: false, marketing: false, third_party: false,
    };
    activeCategories.forEach(c => {
      if (c.is_required) next[c.key] = true;
      else next[c.key] = !!consent?.categories?.[c.key];
    });
    setDraft(next);
  }, [preferencesOpen, activeCategories, consent]);

  const cookiesByCat = useMemo(() => {
    const m = new Map<string, typeof cookies>();
    cookies.forEach(c => {
      const list = m.get(c.category_id) || [];
      list.push(c);
      m.set(c.category_id, list);
    });
    return m;
  }, [cookies]);

  const handleSave = async () => {
    await savePreferences(draft);
    closePreferences();
  };
  const handleAcceptAll = async () => { await acceptAll(); closePreferences(); };
  const handleRejectAll = async () => { await rejectAll(); closePreferences(); };

  return (
    <Dialog open={preferencesOpen} onOpenChange={(o) => !o && closePreferences()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('cookies.preferences.title', 'Preferències de cookies')}</DialogTitle>
          <DialogDescription>
            {t('cookies.preferences.desc', 'Activa o desactiva cada categoria. Les cookies necessàries no es poden desactivar.')}
          </DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" className="w-full">
          {activeCategories.map(cat => {
            const name = (lang === 'es' ? cat.name_es : cat.name_ca) || cat.key;
            const desc = (lang === 'es' ? cat.description_es : cat.description_ca) || '';
            const list = cookiesByCat.get(cat.id) || [];
            return (
              <AccordionItem key={cat.id} value={cat.id}>
                <div className="flex items-center justify-between gap-3 pr-1">
                  <AccordionTrigger className="flex-1">
                    <div className="flex items-center gap-2 text-left">
                      <span>{name}</span>
                      {cat.is_required && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t('cookies.preferences.alwaysActive', 'Sempre actives')}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <Switch
                    checked={cat.is_required ? true : !!draft[cat.key]}
                    disabled={cat.is_required}
                    onCheckedChange={(v) => setDraft(d => ({ ...d, [cat.key]: !!v }))}
                    aria-label={name}
                  />
                </div>
                <AccordionContent>
                  {desc && <p className="text-sm text-muted-foreground mb-3">{desc}</p>}
                  {list.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left border-b border-border">
                            <th className="py-2 pr-2 font-medium">{t('cookies.table.name', 'Nom')}</th>
                            <th className="py-2 pr-2 font-medium">{t('cookies.table.provider', 'Proveïdor')}</th>
                            <th className="py-2 pr-2 font-medium">{t('cookies.table.purpose', 'Finalitat')}</th>
                            <th className="py-2 pr-2 font-medium">{t('cookies.table.duration', 'Durada')}</th>
                            <th className="py-2 font-medium">{t('cookies.table.type', 'Tipus')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map(ck => (
                            <tr key={ck.id} className="border-b border-border/50">
                              <td className="py-2 pr-2 font-mono">{ck.name}</td>
                              <td className="py-2 pr-2">{ck.provider}</td>
                              <td className="py-2 pr-2">{(lang === 'es' ? ck.purpose_es : ck.purpose_ca) || '—'}</td>
                              <td className="py-2 pr-2">{ck.duration || '—'}</td>
                              <td className="py-2">{ck.type === 'third_party' ? t('cookies.table.thirdParty', 'Tercers') : t('cookies.table.firstParty', 'Pròpia')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {t('cookies.preferences.empty', 'No s\'han registrat cookies en aquesta categoria.')}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleRejectAll} className="sm:mr-auto">
            {t('cookies.preferences.rejectAll', 'Rebutjar opcionals')}
          </Button>
          <Button variant="outline" onClick={handleAcceptAll}>
            {t('cookies.preferences.acceptAll', 'Acceptar totes')}
          </Button>
          <Button onClick={handleSave}>
            {t('cookies.preferences.save', 'Desar preferències')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CookiePreferencesDialog;
