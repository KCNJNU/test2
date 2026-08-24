import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SiteHeader } from './components/SiteChrome';
import { LanguageProvider } from './context/LanguageContext';
import { HomePage } from './pages/HomePage';
import styles from './styles/site.module.css';

const ProductsPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.ProductsPage })));
const ProductDetailPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.ProductDetailPage })));
const SolutionsPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.SolutionsPage })));
const SolutionDetailPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.SolutionDetailPage })));
const TechnologyPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.TechnologyPage })));
const CasesPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.CasesPage })));
const AboutPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.AboutPage })));
const NewsPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.NewsPage })));
const NewsDetailPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.NewsDetailPage })));
const ContactPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.ContactPage })));
const SupportPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.SupportPage })));
const LegalPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.LegalPage })));
const NotFoundPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.NotFoundPage })));

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView());
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [hash, pathname]);
  return null;
}

function BrandIntro() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem('dansheng-intro-seen')) return;
      sessionStorage.setItem('dansheng-intro-seen', 'true');
      setVisible(true);
      const timer = window.setTimeout(() => setVisible(false), 720);
      return () => window.clearTimeout(timer);
    } catch {
      return undefined;
    }
  }, []);
  return <div className={`${styles.brandIntro} ${visible ? styles.brandIntroVisible : ''}`} aria-hidden="true"><span>旦生计划</span></div>;
}

function RoutedApp() {
  const location = useLocation();
  return <><ScrollManager /><BrandIntro /><SiteHeader /><div className={styles.routeTransition} key={location.pathname}><Suspense fallback={<div className={styles.routeFallback} />}><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/products" element={<ProductsPage />} />
    <Route path="/products/:slug" element={<ProductDetailPage />} />
    <Route path="/solutions" element={<SolutionsPage />} />
    <Route path="/solutions/:slug" element={<SolutionDetailPage />} />
    <Route path="/technology" element={<TechnologyPage />} />
    <Route path="/cases" element={<CasesPage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/news" element={<NewsPage />} />
    <Route path="/news/:slug" element={<NewsDetailPage />} />
    <Route path="/contact" element={<ContactPage />} />
    <Route path="/support" element={<SupportPage />} />
    <Route path="/privacy" element={<LegalPage type="privacy" />} />
    <Route path="/terms" element={<LegalPage type="terms" />} />
    <Route path="/404" element={<NotFoundPage />} />
    <Route path="*" element={<Navigate to="/404" replace />} />
  </Routes></Suspense></div></>;
}

export function App() { return <LanguageProvider><BrowserRouter><RoutedApp /></BrowserRouter></LanguageProvider>; }
