// frontend/src/components/LanguageSwitcher.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n, { LANG_STORAGE_KEY, SUPPORTED_LANGS, type SupportedLang } from '../i18n';

const LANGUAGES: Array<{ code: SupportedLang; label: string; flag: string }> = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'rw', label: 'Kinyarwanda', flag: '🇷🇼' },
];

function normalizeLang(lng: string | undefined | null): SupportedLang {
  const short = String(lng || 'en').split('-')[0] as SupportedLang;
  return (SUPPORTED_LANGS as readonly string[]).includes(short) ? short : 'en';
}

const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // ✅ stable current lang even if i18n says "en-US"
  const activeLang = useMemo(() => normalizeLang(i18n.resolvedLanguage || i18n.language), [i18n.resolvedLanguage, i18n.language]);

  // ✅ ensure initial state comes from localStorage if present
  useEffect(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    const savedNorm = normalizeLang(saved);
    if (saved && savedNorm !== activeLang) {
      i18n.changeLanguage(savedNorm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentLang = useMemo(
    () => LANGUAGES.find((l) => l.code === activeLang) || LANGUAGES[0],
    [activeLang]
  );

  const switchLanguage = async (code: SupportedLang) => {
    const normalized = normalizeLang(code);

    // ✅ persist across refresh + login + rehydrate
    localStorage.setItem(LANG_STORAGE_KEY, normalized);

    await i18n.changeLanguage(normalized);
    setOpen(false);

    // Optional: update <html lang="">
    document.documentElement.lang = normalized;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-200"
      >
        <Globe className="w-4 h-4" />
        {!compact && <span>{currentLang.flag} {currentLang.label}</span>}
        {compact && <span>{currentLang.flag}</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => switchLanguage(lang.code)}
              className={`flex items-center justify-between w-full px-4 py-2.5 text-sm transition-colors ${
                activeLang === lang.code
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{lang.flag}</span>
                {lang.label}
              </span>

              {activeLang === lang.code && <Check className="w-4 h-4 text-primary-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;