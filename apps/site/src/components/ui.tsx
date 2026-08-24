import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LocalizedText } from '../types';
import { useLanguage } from '../context/LanguageContext';
import styles from '../styles/site.module.css';
import { useMagnetic } from '../hooks/useMagnetic';

type RevealVariant = 'fade-up' | 'fade-left' | 'fade-right' | 'scale-in' | 'mask-reveal';

export function Reveal({ children, className = '', variant = 'fade-up', delay = 0 }: { children: ReactNode; className?: string; variant?: RevealVariant; delay?: 0 | 1 | 2 | 3 | 4 }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const target = variant === 'mask-reveal' ? element.parentElement ?? element : element;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { threshold: .12 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [variant]);
  const variantClass = {
    'fade-up': styles.revealUp,
    'fade-left': styles.revealLeft,
    'fade-right': styles.revealRight,
    'scale-in': styles.revealScale,
    'mask-reveal': styles.revealMask,
  }[variant];
  return <div ref={ref} className={`${styles.reveal} ${variantClass} ${styles[`revealDelay${delay}`]} ${visible ? styles.revealed : ''} ${className}`}>{children}</div>;
}

export function SectionHeading({ eyebrow, title, body, light = false }: { eyebrow: LocalizedText; title: LocalizedText; body?: LocalizedText; light?: boolean }) {
  const { t } = useLanguage();
  return <div>
    <div className={styles.eyebrow}>{t(eyebrow)}</div>
    <h2 className={styles.heading}>{t(title)}</h2>
    {body && <p className={styles.lede}>{t(body)}</p>}
    {light && null}
  </div>;
}

export function ButtonLink({ to, children, tone = 'primary' }: { to: string; children: ReactNode; tone?: 'primary' | 'ghost' | 'dark' }) {
  const ref = useMagnetic<HTMLAnchorElement>();
  return <Link ref={ref} className={`${styles.button} ${tone === 'primary' ? styles.buttonPrimary : tone === 'ghost' ? styles.buttonGhost : styles.buttonDark}`} to={to}>{children}<ArrowRight /></Link>;
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className={styles.textLink} to={to}>{children}<ArrowRight /></Link>;
}

export function PlaceholderTag({ light = false }: { light?: boolean }) {
  const { language } = useLanguage();
  return <span className={`${styles.placeholder} ${light ? styles.placeholderLight : ''}`}>{language === 'en' ? 'More information coming soon' : '更多信息即将发布'}</span>;
}
