import { useEffect } from 'react';
import { useLanguages } from '@/hooks/useLanguages';
import { reconcileLanguage } from '@/i18n';
import i18n from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { unflattenTranslations } from '@/lib/translationFlatten';

/**
 * Keeps the active i18n language in sync with the languages enabled in the DB,
 * and overlays any per-language UI translations stored in `ui_translations`.
 * Mount once near the root.
 */
const LanguageReconciler: React.FC = () => {
  const { data } = useLanguages({ onlyEnabled: true });
  useEffect(() => {
    if (!data) return;
    const codes = data.map(l => l.code);
    const def = data.find(l => l.is_default)?.code;
    reconcileLanguage(codes, def);

    // Load UI translation overlays for every enabled language
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from('ui_translations')
          .select('language_code,key,value')
          .in('language_code', codes);
        if (error || !rows) return;
        const grouped: Record<string, Record<string, string>> = {};
        for (const r of rows) {
          if (!grouped[r.language_code]) grouped[r.language_code] = {};
          if (r.value) grouped[r.language_code][r.key] = r.value;
        }
        for (const [code, flat] of Object.entries(grouped)) {
          const resource = unflattenTranslations(flat);
          i18n.addResourceBundle(code, 'translation', resource, true, true);
        }
        // Trigger a re-render of components using useTranslation
        if (i18n.language && codes.includes(i18n.language)) {
          i18n.changeLanguage(i18n.language);
        }
      } catch (e) {
        console.warn('ui_translations overlay failed', e);
      }
    })();
  }, [data]);
  return null;
};

export default LanguageReconciler;
