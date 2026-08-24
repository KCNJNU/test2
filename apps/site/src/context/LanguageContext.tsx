/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Language, LocalizedText } from '../types';

interface LanguageValue { language: Language; setLanguage: (language: Language) => void; t: (value: LocalizedText) => string }
const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => localStorage.getItem('brand-language') === 'zh' ? 'zh' : 'en');
  const setLanguage = (next: Language) => { setLanguageState(next); localStorage.setItem('brand-language', next); };
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (text: LocalizedText) => text[language] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
