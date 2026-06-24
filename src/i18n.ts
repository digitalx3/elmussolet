import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ca from './locales/ca.json';
import es from './locales/es.json';

// Bundled UI translations. When a new language is added in the admin but no
// JSON file exists yet, i18next falls back to `fallbackLng` (the default).
const bundledResources: Record<string, { translation: Record<string, unknown> }> = {
  ca: { translation: ca },
  es: { translation: es },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: bundledResources,
    supportedLngs: Object.keys(bundledResources),
    fallbackLng: 'ca',
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

/**
 * Sync the active language with the languages enabled in the database.
 * Called from a top-level effect once the DB list is loaded.
 */
export function reconcileLanguage(enabledCodes: string[], defaultCode?: string) {
  if (enabledCodes.length === 0) return;
  const current = i18n.language;
  if (!enabledCodes.includes(current)) {
    const target = defaultCode && enabledCodes.includes(defaultCode) ? defaultCode : enabledCodes[0];
    i18n.changeLanguage(target);
  }
}

export default i18n;
