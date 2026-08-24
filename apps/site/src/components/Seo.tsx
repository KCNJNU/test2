import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

export function Seo({ title, description }: { title: string; description: string }) {
  const { language } = useLanguage();
  const location = useLocation();
  useEffect(() => {
    document.title = `${title} | 旦生计划`;
    const setMeta = (selector: string, content: string) => document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content);
    setMeta('meta[name="description"]', description); setMeta('meta[property="og:title"]', `${title} | 旦生计划`); setMeta('meta[property="og:description"]', description);
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', `${window.location.origin}${location.pathname}`);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [description, language, location.pathname, title]);
  return null;
}
