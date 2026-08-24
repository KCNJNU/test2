import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { news, products, solutions, technologies } from '../data/siteData';
import { useLanguage } from '../context/LanguageContext';
import { ButtonLink, Reveal, TextLink } from '../components/ui';
import { SiteFooter } from '../components/SiteChrome';
import { Seo } from '../components/Seo';
import { ImmersiveSection, ResponsiveVisual, ScenarioExplorer } from '../components/Visual';
import { useMotionSurface } from '../hooks/useMotionSurface';
import type { VisualAsset } from '../types';
import styles from '../styles/site.module.css';

const heroVisual: VisualAsset = { desktopSrc: '/assets/hero/hero-main.webp', mobileSrc: '/assets/hero/hero-main-mobile.webp', focalDesktop: { x: 64, y: 50 }, focalMobile: { x: 88, y: 48 }, contentPosition: 'left-bottom', overlayDirection: 'left', tone: 'dark' };
const technologyVisual: VisualAsset = { desktopSrc: '/assets/technology/perception.webp', focalDesktop: { x: 35, y: 50 }, focalMobile: { x: 48, y: 44 }, contentPosition: 'right-center', overlayDirection: 'right', tone: 'dark' };
const cloudVisual: VisualAsset = { desktopSrc: '/assets/technology/cloud.webp', focalDesktop: { x: 70, y: 50 }, focalMobile: { x: 52, y: 48 }, contentPosition: 'left-top', overlayDirection: 'radial', tone: 'dark' };
const aboutVisual: VisualAsset = { desktopSrc: '/assets/company/company-01.webp', focalDesktop: { x: 36, y: 50 }, focalMobile: { x: 52, y: 46 }, contentPosition: 'right-center', overlayDirection: 'right', tone: 'light' };

export function HomePage() {
  const { language, t } = useLanguage();
  const [activeProduct, setActiveProduct] = useState(0);
  const [activeTechnology, setActiveTechnology] = useState(0);
  const productOverviewRef = useMotionSurface<HTMLElement>();
  const [previousProduct, setPreviousProduct] = useState<(typeof products)[number] | null>(null);
  const productTimer = useRef<number | undefined>(undefined);
  const label = (en: string, zh: string) => language === 'en' ? en : zh;
  const selected = products[activeProduct];
  useEffect(() => () => window.clearTimeout(productTimer.current), []);
  const selectProduct = (index: number) => {
    if (index === activeProduct) return;
    setPreviousProduct(selected);
    setActiveProduct(index);
    window.clearTimeout(productTimer.current);
    productTimer.current = window.setTimeout(() => setPreviousProduct(null), 760);
  };

  return <div className={styles.page}>
    <Seo title={label('Intelligent Commercial Cleaning Robotics', '智能商用清洁机器人')} description={label('Autonomous commercial cleaning products and intelligent operations from 旦生计划.', '旦生计划面向商用空间，探索自主清洁产品与智能运营。')} />
    <main>
      <ImmersiveSection visual={heroVisual} alt={label('Autonomous cleaning robot in a public space', '公共空间中的自主清洁机器人')} priority technical motion="layer" className={styles.homeHero}>
        <div className={styles.homeHeroCopy}><span>旦生计划</span><h1>{label('Intelligence in every clean.', '让智能进入每一次清洁。')}</h1><p>{label('Autonomous commercial cleaning for the spaces ahead.', '智能商用清洁机器人，面向下一代自主清洁场景。')}</p><div className={styles.heroActions}><ButtonLink to="/products">{label('Explore products', '探索产品')}</ButtonLink><ButtonLink to="/about" tone="ghost">{label('Learn more', '了解更多')}</ButtonLink></div></div>
        <a className={styles.homeScroll} href="#product-overview"><span>{label('Discover', '继续探索')}</span><ArrowDown /></a>
      </ImmersiveSection>

      <section ref={productOverviewRef} id="product-overview" className={`${styles.productOverview} ${styles.fullVisualSection}`}>
        <div className={styles.productOverviewMedia} aria-live="polite">{previousProduct && <ResponsiveVisual visual={previousProduct.visual} alt="" className={styles.productPrevious} />}<ResponsiveVisual key={selected.slug} visual={selected.visual} alt={t(selected.type)} className={styles.productSelectorVisual} /><i key={`ambient-${selected.slug}`} className={`${styles.productAmbient} ${styles[`productTone${activeProduct + 1}`]}`} aria-hidden="true" /></div>
        <div className={styles.productOverviewShade} aria-hidden="true" />
        <div className={`${styles.wideContainer} ${styles.productOverviewContent}`}><header className={styles.sectionIntro}><span>01 / {label('PRODUCTS', '产品')}</span><h2>{label('Commercial cleaning, considered as a system.', '从产品出发，构建商用清洁系统。')}</h2><p>{label('Three product directions for different operating scales.', '面向不同运营尺度的三种产品方向，具体产品信息暂定。')}</p></header><div className={styles.productSelectorList}>{products.map((product, index) => <button className={index === activeProduct ? styles.productSelectorActive : ''} key={product.slug} onClick={() => selectProduct(index)} type="button"><span>0{index + 1}</span><strong>{product.name}</strong><small>{t(product.type)}</small></button>)}</div><TextLink to={`/products/${selected.slug}`}>{label('View selected product', '查看当前产品')}</TextLink></div>
      </section>

      <FeaturedProduct index="02" productIndex={0} />
      <FeaturedProduct index="03" productIndex={1} reverse />
      <ScenarioExplorer items={solutions.slice(0, 6)} />

      <ImmersiveSection visual={technologyVisual} alt={label('Spatial perception visualization', '空间感知视觉')} technical technicalState={activeTechnology} motion="mask-horizontal" className={styles.technologyOverview}>
        <div className={styles.technologyImmersiveCopy}><span>05 / {label('TECHNOLOGY', '技术')}</span><h2>{label('The space becomes understandable.', '让机器，真正理解空间。')}</h2><div className={styles.technologyList}>{technologies.slice(0, 3).map((item, index) => <Reveal key={item.icon} delay={(index + 1) as 1 | 2 | 3}><article className={index === activeTechnology ? styles.technologyActive : ''} onPointerEnter={() => setActiveTechnology(index)} onFocus={() => setActiveTechnology(index)} tabIndex={0}><span>{item.icon}</span><div><h3>{t(item.title)}</h3><p>{t(item.body)}</p></div></article></Reveal>)}</div><TextLink to="/technology">{label('Explore technology', '了解技术')}</TextLink></div>
      </ImmersiveSection>

      <ImmersiveSection visual={cloudVisual} alt={label('Connected operations environment', '互联运营环境')} motion="perspective" className={styles.cloudHomeSection}>
        <div className={styles.cloudImmersiveCopy}><span>{label('CONNECTED OPERATIONS', '互联运营')}</span><h2>{label('From every robot to one operating view.', '从每台机器人，到同一个运营视图。')}</h2><p>{label('Robot management, data operations, dataset versions and service health.', '连接机器人管理、数据运营、数据集版本与系统健康状态。')}</p><TextLink to="/technology#cloud-platform">{label('Explore the platform', '了解智能平台')}</TextLink></div><Reveal variant="scale-in" delay={1} className={styles.cloudImmersiveStage}><PlatformPreview /></Reveal>
      </ImmersiveSection>

      <ImmersiveSection visual={aboutVisual} alt={label('Robotics research environment', '机器人研发环境')} motion="soft" className={styles.aboutPreview}>
        <Reveal className={styles.aboutImmersiveCopy}><span className={styles.sectionIndex}>06 / {label('ABOUT', '关于')}</span><h2>{label('Building the next generation of autonomous cleaning.', '构建下一代自主清洁。')}</h2><p>{label('旦生计划 explores intelligent robotic systems for commercial and professional environments.', '旦生计划探索面向商业及专业环境的智能机器人系统，正式企业信息暂定。')}</p><TextLink to="/about">{label('About 旦生计划', '关于旦生计划')}</TextLink></Reveal>
      </ImmersiveSection>

      <section className={`${styles.rhythmSection} ${styles.newsPreview}`}><div className={styles.standardContainer}><header className={styles.newsPreviewHeader}><div><span className={styles.sectionIndex}>07 / {label('NEWS', '资讯')}</span><h2>{label('Latest from 旦生计划', '旦生计划资讯')}</h2></div><TextLink to="/news">{label('View all news', '查看全部资讯')}</TextLink></header><div className={styles.newsPreviewList}>{news.map((item, index) => <Reveal key={item.slug} className={styles.newsPreviewItem} delay={(index + 1) as 1 | 2 | 3}><Link to={`/news/${item.slug}`}><span className={styles.newsImageFrame}><img src={item.image} alt="" width="1600" height="900" loading="lazy" /></span><span>{t(item.date)} · {t(item.category)}</span><h3>{t(item.title)}</h3><ArrowUpRight /></Link></Reveal>)}</div></div></section>
    </main>
    <SiteFooter />
  </div>;
}

function FeaturedProduct({ index, productIndex, reverse = false }: { index: string; productIndex: number; reverse?: boolean }) {
  const { language, t } = useLanguage();
  const product = products[productIndex];
  const label = (en: string, zh: string) => language === 'en' ? en : zh;
  const visual: VisualAsset = { ...product.visual, contentPosition: reverse ? 'left-bottom' : 'right-center', overlayDirection: reverse ? 'left' : 'right', tone: reverse ? 'dark' : 'light' };
  return <ImmersiveSection visual={visual} alt={t(product.type)} motion={reverse ? 'mask-vertical' : 'mask-horizontal'} className={`${styles.featuredProduct} ${reverse ? styles.featuredProductReverse : ''}`}><Reveal className={styles.featuredProductCopy}><i aria-hidden="true">{index}</i><span>{index} / {label('FEATURED PRODUCT', '重点产品')}</span><p>{t(product.type)}</p><h2>{product.name}</h2><strong>{t(product.statement)}</strong><TextLink to={`/products/${product.slug}`}>{label('Explore product', '探索产品')}</TextLink></Reveal></ImmersiveSection>;
}

export function PlatformPreview() {
  const motionRef = useMotionSurface<HTMLDivElement>();
  return <div ref={motionRef} className={styles.platformStage}><div className={styles.platformPreview} aria-label="旦生计划智能平台界面"><header><i /><i /><i /><strong>旦生计划智能平台</strong></header><div><aside>{['Overview', 'Robots', 'Files', 'Datasets', 'Health'].map(item => <span key={item}>{item}</span>)}</aside><div className={styles.platformMain}><small>OPERATIONS OVERVIEW</small><div className={styles.platformMetrics}><article><span>ROBOTS</span><b>--</b></article><article><span>DATASETS</span><b>--</b></article></div><svg viewBox="0 0 640 180" preserveAspectRatio="none"><path d="M10 145 C95 120 135 150 205 88 S345 132 415 62 S540 90 630 25" /></svg></div></div></div><span className={`${styles.platformFloat} ${styles.platformFloatStatus}`}>Robot connection · --</span><span className={`${styles.platformFloat} ${styles.platformFloatVersion}`}>Dataset version · --</span></div>;
}
