import { ArrowUpRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import type { Solution, VisualAsset } from '../types';
import { useMotionSurface } from '../hooks/useMotionSurface';
import styles from '../styles/site.module.css';

type VisualStyle = CSSProperties & {
  '--focal-x'?: string;
  '--focal-y'?: string;
  '--focal-mobile-x'?: string;
  '--focal-mobile-y'?: string;
};

const variant = (src: string, width: 1280 | 1920 | 3200) => src.replace(/\.webp$/i, `-${width}.webp`);

export function ResponsiveVisual({
  visual,
  alt,
  priority = false,
  className = '',
}: {
  visual: VisualAsset;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const visualStyle: VisualStyle = {
    '--focal-x': `${visual.focalDesktop.x}%`,
    '--focal-y': `${visual.focalDesktop.y}%`,
    '--focal-mobile-x': `${visual.focalMobile.x}%`,
    '--focal-mobile-y': `${visual.focalMobile.y}%`,
  };
  return <picture className={`${styles.responsiveVisual} ${className}`} style={visualStyle}>
    {visual.mobileSrc && <source media="(max-width: 640px)" srcSet={`${visual.mobileSrc} 1080w`} sizes="100vw" />}
    <source srcSet={`${variant(visual.desktopSrc, 1280)} 1280w, ${variant(visual.desktopSrc, 1920)} 1920w, ${variant(visual.desktopSrc, 3200)} 3200w`} sizes="100vw" type="image/webp" />
    <img
      src={visual.desktopSrc}
      alt={alt}
      width="3200"
      height="1800"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
    />
  </picture>;
}

export function ImmersiveSection({
  visual,
  alt,
  children,
  priority = false,
  className = '',
  contentClassName = '',
  technical = false,
  motion = 'scroll',
  technicalState,
}: {
  visual: VisualAsset;
  alt: string;
  children: ReactNode;
  priority?: boolean;
  className?: string;
  contentClassName?: string;
  technical?: boolean;
  motion?: 'layer' | 'scroll' | 'mask-horizontal' | 'mask-vertical' | 'perspective' | 'soft';
  technicalState?: number;
}) {
  const ref = useMotionSurface<HTMLElement>();
  return <section ref={ref} data-motion={motion} data-tech={technicalState} className={`${styles.immersiveSection} ${styles[`immersive${visual.tone === 'dark' ? 'Dark' : 'Light'}`]} ${styles[`content${visual.contentPosition.replace(/(^|-)(\w)/g, (_, _dash: string, letter: string) => letter.toUpperCase())}`]} ${className}`}>
    <div className={styles.immersiveMedia}><ResponsiveVisual visual={visual} alt={alt} priority={priority} /></div>
    <div className={styles.immersiveAmbient} aria-hidden="true" />
    <div className={styles.immersiveSpotlight} aria-hidden="true" />
    <div className={styles.immersiveFloor} aria-hidden="true" />
    <div className={`${styles.immersiveOverlay} ${styles[`overlay${visual.overlayDirection[0].toUpperCase()}${visual.overlayDirection.slice(1)}`]}`} aria-hidden="true" />
    {technical && <div className={styles.immersiveTechnical} aria-hidden="true"><svg viewBox="0 0 1600 900" preserveAspectRatio="none"><path className={styles.techPathNavigation} d="M80 742 C340 680 420 770 650 542 S1050 524 1240 286 S1450 204 1550 128"/><path className={styles.techPathPerception} d="M940 706 C1050 610 1170 630 1262 520 S1405 396 1518 338"/><path className={styles.techPathCloud} d="M730 180 C920 210 1004 124 1160 174 S1390 194 1534 104"/><circle cx="650" cy="542" r="6"/><circle cx="1240" cy="286" r="6"/></svg><i /><i /></div>}
    <div className={styles.immersiveForeground} aria-hidden="true" />
    <div className={`${styles.immersiveContent} ${contentClassName}`}>{children}</div>
  </section>;
}

export function ScenarioExplorer({ items, className = '' }: { items: Solution[]; className?: string }) {
  const { t, language } = useLanguage();
  const motionRef = useMotionSurface<HTMLElement>();
  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const selected = items[active];
  const previousItem = previous === null ? null : items[previous];
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const select = (index: number) => {
    if (index === active) return;
    setPrevious(active);
    setActive(index);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPrevious(null), 720);
  };
  const groups = useMemo(() => items.slice(0, 6), [items]);
  return <section ref={motionRef} data-scene={active} className={`${styles.scenarioExplorer} ${className}`}>
    {previousItem && <ResponsiveVisual key={`previous-${previousItem.slug}`} visual={previousItem.visual} alt="" className={styles.scenarioPrevious} />}
    <ResponsiveVisual key={selected.slug} visual={selected.visual} alt={t(selected.name)} className={styles.scenarioCurrent} />
    <div className={styles.scenarioAtmosphere} aria-hidden="true" />
    <div key={`copy-${selected.slug}`} className={styles.scenarioExplorerContent}>
      <span>04 / {language === 'en' ? 'APPLICATIONS' : '应用场景'}</span>
      <h2>{language === 'en' ? 'Intelligence, shaped by the space.' : '让智能，自然融入空间。'}</h2>
      <p>{t(selected.description)}</p>
      <Link to={`/solutions/${selected.slug}`}>{language === 'en' ? 'Explore this space' : '探索此场景'}<ArrowUpRight /></Link>
    </div>
    <div className={styles.scenarioExplorerNav} role="tablist" aria-label={language === 'en' ? 'Application scenarios' : '应用场景'}>
      {groups.map((item, index) => <button key={item.slug} type="button" role="tab" aria-selected={index === active} onClick={() => select(index)}><span>0{index + 1}</span><strong>{t(item.name)}</strong></button>)}
    </div>
  </section>;
}
