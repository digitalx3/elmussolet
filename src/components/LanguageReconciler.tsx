import { useEffect } from 'react';
import { useLanguages } from '@/hooks/useLanguages';
import { reconcileLanguage } from '@/i18n';

/**
 * Keeps the active i18n language in sync with the languages enabled in the DB.
 * Mount once near the root.
 */
const LanguageReconciler: React.FC = () => {
  const { data } = useLanguages({ onlyEnabled: true });
  useEffect(() => {
    if (!data) return;
    const codes = data.map(l => l.code);
    const def = data.find(l => l.is_default)?.code;
    reconcileLanguage(codes, def);
  }, [data]);
  return null;
};

export default LanguageReconciler;
