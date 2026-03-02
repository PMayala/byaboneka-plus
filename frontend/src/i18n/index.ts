// frontend/src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import fr from './locales/fr.json';
import rw from './locales/rw.json';

export const SUPPORTED_LANGS = ['en', 'fr', 'rw'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const LANG_STORAGE_KEY = 'byaboneka-lang';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      rw: { translation: rw },
    },

    // ✅ IMPORTANT: stop "en-US" breaking UI comparisons / selection
    supportedLngs: [...SUPPORTED_LANGS],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',

    fallbackLng: 'en',
    interpolation: { escapeValue: false },

    detection: {
      // ✅ Keep your current behavior but make it deterministic
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: LANG_STORAGE_KEY,

      // Optional: normalize language like "en-US" -> "en"
      // (load: 'languageOnly' already helps, but this makes detection cleaner)
      convertDetectedLanguage: (lng: string) => (lng || 'en').split('-')[0],
    },

    react: {
      useSuspense: false,
    },

    // Optional: avoids noisy warnings if some keys missing during dev
    // saveMissing: import.meta.env.DEV,
  });

export default i18n;