import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import styles from '../styles/site.module.css';

const nav = [
  ['/products', 'Products', '产品'], ['/solutions', 'Solutions', '解决方案'], ['/technology', 'Technology', '技术'], ['/technology#cloud-platform', 'Platform', '云平台'], ['/about', 'About', '关于'], ['/news', 'News', '资讯'],
] as const;

export function SiteHeader() {
  const { language, setLanguage } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const transparentHero = location.pathname === '/';
  const solid = !transparentHero;
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 30); onScroll(); addEventListener('scroll', onScroll, { passive: true }); return () => removeEventListener('scroll', onScroll); }, []);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.body.style.overflow = 'hidden'; addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; removeEventListener('keydown', onKey); };
  }, [open]);
  const label = (en: string, zh: string) => language === 'en' ? en : zh;
  return <>
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''} ${solid ? styles.headerSolid : ''}`}>
      <div className={styles.headerInner}>
        <Link className={styles.logo} to="/" aria-label="旦生计划首页"><span className={styles.logoMark} />旦生计划</Link>
        <nav className={styles.nav} aria-label="Primary navigation">
          {nav.map(([to, en, zh]) => <NavLink key={to} to={to}>{label(en, zh)}</NavLink>)}
        </nav>
        <div className={styles.headerActions}>
          <button className={styles.language} onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} aria-label={label('Switch to Chinese', '切换到英文')}>{language === 'en' ? '中文' : 'EN'}</button>
          <Link className={styles.headerCta} to="/contact">{label('Contact us', '联系我们')}<ArrowUpRight size={14} /></Link>
          <button className={styles.menuButton} onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="mobile-menu"><Menu /></button>
        </div>
      </div>
    </header>
    <div id="mobile-menu" className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`} aria-hidden={!open}>
      <button className={styles.drawerClose} onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
      <nav className={styles.drawerNav}>{nav.map(([to, en, zh]) => <Link key={to} to={to}>{label(en, zh)}</Link>)}<Link to="/contact">{label('Contact', '联系')}</Link></nav>
    </div>
  </>;
}

const columns = [
  { title: ['Explore', '探索'], links: [['/products','产品'],['/solutions','解决方案'],['/technology','技术']] },
  { title: ['Company', '公司'], links: [['/about','关于我们'],['/news','资讯中心'],['/contact','联系我们']] },
  { title: ['Support', '支持'], links: [['/support','使用指导'],['/contact?topic=support','服务支持'],['/privacy','隐私政策']] },
] as const;

export function SiteFooter() {
  const { language } = useLanguage();
  const pick = (value: readonly [string,string]) => value[language === 'en' ? 0 : 1];
  return <footer className={styles.footer}><div className={styles.container}>
    <div className={styles.footerTop}>
      <div className={styles.footerBrand}><Link className={styles.footerLogo} to="/">旦生计划</Link><p className={styles.footerTag}>{language === 'en' ? 'Autonomous cleaning technology for the spaces of tomorrow.' : '面向未来空间的自主清洁技术。'}</p></div>
      {columns.map((column) => <div className={styles.footerCol} key={column.title[0]}><h4>{pick(column.title)}</h4>{column.links.map(([to,label]) => <Link key={to} to={to}>{label}</Link>)}</div>)}
      <div className={styles.footerContact}><h4>{language === 'en' ? 'Contact' : '联系'}</h4><p>{language === 'en' ? 'Formal contact information to be confirmed' : '正式联系方式暂定'}</p></div>
    </div>
    <div className={styles.footerBottom}><span>© 2026 旦生计划</span><span>{language === 'en' ? 'Brand information to be confirmed' : '品牌信息暂定'}</span></div>
  </div></footer>;
}
