import type { ReactNode } from 'react';
import { SiteFooter } from './SiteChrome';
import { Seo } from './Seo';
import styles from '../styles/site.module.css';

export function PageHero({ eyebrow, title, body, image, detail = false }: { eyebrow: string; title: string; body: string; image?: string; detail?: boolean }) {
  return <section className={`${styles.pageHero} ${detail ? styles.detailHero : ''}`}>
    {image && <img src={image} alt="" width="2048" height="1152" />}
    <div className={styles.container}><div className={styles.eyebrow}>{eyebrow}</div><h1>{title}</h1><p>{body}</p></div>
  </section>;
}

export function Page({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className={styles.page}><Seo title={title} description={description} />{children}<SiteFooter /></div>;
}
