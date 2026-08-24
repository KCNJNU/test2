import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Play, Search } from 'lucide-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { news, products, solutions, technologies } from '../data/siteData';
import { useLanguage } from '../context/LanguageContext';
import { inquiryMailto, validateInquiry, type Inquiry } from '../lib/contact';
import { Page, PageHero } from '../components/PageShell';
import { ButtonLink, Reveal, TextLink } from '../components/ui';
import { ImmersiveSection, ResponsiveVisual, ScenarioExplorer } from '../components/Visual';
import { useMotionSurface } from '../hooks/useMotionSurface';
import type { ContentPosition, OverlayDirection, VisualAsset } from '../types';
import styles from '../styles/site.module.css';

function useLabels() {
  const value = useLanguage();
  return { ...value, label: (en: string, zh: string) => value.language === 'en' ? en : zh };
}

function visualAsset(desktopSrc: string, contentPosition: ContentPosition, overlayDirection: OverlayDirection, tone: VisualAsset['tone'], x = 55, y = 50): VisualAsset {
  return { desktopSrc, focalDesktop: { x, y }, focalMobile: { x: Math.min(70, x + 3), y: Math.max(42, y - 2) }, contentPosition, overlayDirection, tone };
}

export function ProductsPage() {
  const { t, label } = useLabels();
  return <Page title={label('Products', '产品')} description={label('Explore autonomous commercial cleaning product directions.', '探索自主商用清洁产品方向。')}>
    <ImmersiveSection visual={{ ...products[0].visual, contentPosition: 'left-bottom', overlayDirection: 'left', tone: 'dark' }} alt={t(products[0].type)} priority className={styles.productsPageHero}><div className={styles.immersivePageCopy}><span>{label('PRODUCTS', '产品')}</span><h1>{label('Products for real operations.', '面向真实运营的清洁产品。')}</h1><p>{label('Three autonomous cleaning directions for different commercial environments.', '面向不同商业环境的三种自主清洁方向。')}</p></div></ImmersiveSection>
    <section className={styles.immersiveCatalog}>{products.map((product, index) => <ImmersiveSection key={product.slug} visual={{ ...product.visual, contentPosition: index % 2 ? 'right-center' : 'left-bottom', overlayDirection: index % 2 ? 'right' : 'left', tone: index === 0 ? 'light' : 'dark' }} alt={t(product.type)} className={styles.immersiveCatalogItem}><div className={styles.catalogImmersiveCopy}><span>0{index + 1}</span><h2>{product.name}</h2><p>{t(product.type)}</p><Link to={`/products/${product.slug}`}>{label('Explore product', '探索产品')}<ArrowUpRight /></Link></div></ImmersiveSection>)}</section>
  </Page>;
}

export function ProductDetailPage() {
  const { slug } = useParams();
  const { t, label } = useLabels();
  const product = products.find(item => item.slug === slug);
  if (!product) return <Navigate to="/404" replace />;
  const features = [
    { image: '/assets/product-details/sensor.webp', title: label('Spatial perception', '空间感知'), body: label('Perceive the environment and maintain a clear operating context.', '持续感知环境，建立清晰的作业上下文。'), callouts: [label('Spatial sensor', '空间传感'), label('Perception region', '感知区域')] },
    { image: '/assets/product-details/cleaning-module.webp', title: label('Intelligent cleaning', '智能清洁'), body: label('Coordinate movement and cleaning around the needs of each space.', '围绕不同空间需求，协同移动与清洁策略。'), callouts: [label('Cleaning module', '清洁组件'), label('Operating path', '作业路径')] },
    { image: '/assets/product-details/base-station.webp', title: label('Operational continuity', '持续运营'), body: label('Return, restore and prepare for the next operation.', '自主回归、恢复状态，为下一次作业做好准备。'), callouts: [label('Service station', '服务基站'), label('Return interface', '回归接口')] },
  ];
  return <Page title={product.name} description={t(product.description)}>
    <ImmersiveSection visual={{ ...product.visual, contentPosition: 'left-bottom', overlayDirection: 'bottom', tone: 'dark' }} alt={t(product.type)} priority technical motion="layer" className={styles.productHeroImmersive}><header><span>旦生计划 / PRODUCT</span><h1>{product.name}</h1><p>{t(product.type)}</p></header></ImmersiveSection>
    <ImmersiveSection visual={{ ...product.visual, contentPosition: 'center-bottom', overlayDirection: 'bottom', tone: 'light' }} alt={product.name} motion="scroll" className={styles.productPositioningImmersive}><div className={styles.productPositioningCopy}><span>01 / {label('POSITIONING', '产品定位')}</span><h2>{t(product.statement)}</h2><p>{t(product.description)}</p></div></ImmersiveSection>
    <ImmersiveSection visual={visualAsset('/assets/product-details/navigation.webp', 'left-bottom', 'bottom', 'dark', 58, 50)} alt={label('Autonomous navigation visualization', '自主导航视觉')} technical motion="mask-horizontal" className={styles.productCoreImmersive}><div className={styles.productCoreCopy}><span>02 / {label('CORE CAPABILITIES', '核心能力')}</span><h2>{label('Designed around the whole operation.', '围绕完整作业流程进行设计。')}</h2><div>{product.features.map((feature, index) => <article key={t(feature)}><span>0{index + 1}</span><h3>{t(feature)}</h3></article>)}</div></div></ImmersiveSection>
    <ScenarioExplorer items={solutions.slice(0, 6)} className={styles.productScenarioExplorer} />
    {features.map((feature, index) => <ImmersiveSection visual={visualAsset(feature.image, index % 2 ? 'left-center' : index === 2 ? 'left-bottom' : 'right-center', index % 2 ? 'left' : 'right', 'dark', index % 2 ? 65 : 38, 50)} alt={feature.title} technical={index === 0} motion={index % 2 ? 'mask-vertical' : 'mask-horizontal'} className={styles.productFeatureImmersive} key={feature.image}><Reveal className={styles.productFeatureCopy}><span>0{index + 4} / {label('FEATURE', '产品特性')}</span><h2>{feature.title}</h2><p>{feature.body}</p><div className={styles.immersiveCallouts} aria-hidden="true">{feature.callouts.map(item => <span key={item}>{item}</span>)}</div></Reveal></ImmersiveSection>)}
    <ProductIntelligenceStory />
    <ImmersiveSection visual={{ ...product.visual, contentPosition: 'left-bottom', overlayDirection: 'left', tone: 'light' }} alt={product.name} motion="mask-horizontal" className={styles.productAppearanceImmersive}><div className={styles.productAppearanceCopy}><span>08 / {label('PRODUCT FORM', '产品外观')}</span><h2>{label('A clear form for everyday operation.', '服务日常运营的清晰形态。')}</h2></div></ImmersiveSection>
    <section className={styles.specificationSection}><div className={styles.standardContainer}><header><span>09 / {label('SPECIFICATIONS', '产品参数')}</span><h2>{label('Product parameters to be confirmed.', '产品参数暂定。')}</h2></header><div className={styles.specificationTable}>{product.specs.map(spec => <div key={t(spec.label)}><span>{t(spec.label)}</span><strong>{spec.value}</strong></div>)}</div></div></section>
    <ContactBand immersive image={solutions[1].visual} />
  </Page>;
}

function ProductIntelligenceStory() {
  const { t, label } = useLabels();
  const [active, setActive] = useState(0);
  const sectionRef = useMotionSurface<HTMLElement>();
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const images = [
    '/assets/product-details/navigation.webp',
    '/assets/product-details/sensor.webp',
    '/assets/product-details/cleaning-module.webp',
    '/assets/technology/cloud.webp',
  ];

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = itemRefs.current.indexOf(visible.target as HTMLElement);
      if (index >= 0) setActive(index);
    }, { rootMargin: '-32% 0px -42% 0px', threshold: [0.15, 0.45, 0.75] });
    itemRefs.current.forEach(item => item && observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return <section ref={sectionRef} className={styles.productIntelligence} data-active-feature={active}>
    <div className={styles.wideContainer}>
      <div className={styles.productStickyImage}>
        <div className={styles.productStickyAtmosphere} aria-hidden="true" />
        {images.map((image, index) => <ResponsiveVisual
          key={image}
          visual={visualAsset(image, 'center-bottom', 'radial', 'dark', 50, 50)}
          alt={index === active ? t(technologies[index].title) : ''}
          className={`${styles.productStickyVisual} ${index === active ? styles.productStickyVisualActive : ''}`}
        />)}
        <svg className={styles.productStickyPath} viewBox="0 0 900 700" aria-hidden="true"><path d="M110 555 C265 492 284 392 440 376 S620 226 790 162" /><circle cx="440" cy="376" r="5" /></svg>
        <span className={styles.productStickyState}>0{active + 1} / {label('INTELLIGENCE', '智能能力')}</span>
      </div>
      <div className={styles.productIntelligenceList}>{technologies.map((item, index) => <article
        ref={node => { itemRefs.current[index] = node; }}
        className={index === active ? styles.productIntelligenceActive : ''}
        key={item.icon}
      ><span>{item.icon}</span><h2>{t(item.title)}</h2><p>{t(item.body)}</p></article>)}</div>
    </div>
  </section>;
}

export function SolutionsPage() {
  const { t, label } = useLabels();
  return <Page title={label('Solutions', '解决方案')} description={label('Autonomous cleaning shaped by real environments.', '由真实环境塑造的自主清洁。')}><ImmersiveSection visual={solutions[1].visual} alt={t(solutions[1].name)} priority className={styles.solutionPageHero}><div className={styles.immersivePageCopy}><span>{label('SOLUTIONS', '解决方案')}</span><h1>{label('Every space has its own rhythm.', '每个空间，都有自己的节奏。')}</h1><p>{label('Cleaning operations shaped around the place.', '围绕不同空间特点组织清洁运营。')}</p></div></ImmersiveSection><ScenarioExplorer items={solutions.slice(0, 6)} /></Page>;
}

export function SolutionDetailPage() {
  const { slug } = useParams(); const { t, label } = useLabels(); const solution = solutions.find(item => item.slug === slug);
  if (!solution) return <Navigate to="/404" replace />;
  return <Page title={t(solution.name)} description={t(solution.description)}><ImmersiveSection visual={solution.visual} alt={t(solution.name)} priority className={styles.solutionDetailHero}><div className={styles.immersivePageCopy}><span>{label('SOLUTION', '解决方案')}</span><h1>{t(solution.name)}</h1><p>{t(solution.description)}</p></div></ImmersiveSection><ImmersiveSection visual={{ ...solution.visual, contentPosition: 'left-bottom', overlayDirection: 'bottom' }} alt={t(solution.name)} className={styles.solutionOperations}><div className={styles.solutionOperationsCopy}><span>01 / {label('OPERATING CONTEXT', '运营场景')}</span><h2>{label('Technology that belongs in the space.', '让技术自然融入空间。')}</h2><div className={styles.informationColumns}><article><h3>{label('Environment', '环境')}</h3><p>{label('Formal site conditions and requirements are to be confirmed.', '正式场地条件与需求信息暂定。')}</p></article><article><h3>{label('Workflow', '流程')}</h3><p>{label('Operating workflows will be defined around verified product capabilities.', '运营流程将依据正式产品能力确定。')}</p></article><article><h3>{label('Service', '服务')}</h3><p>{label('Service information is to be confirmed.', '服务信息暂定。')}</p></article></div></div></ImmersiveSection><ContactBand immersive image={solution.visual} /></Page>;
}

export function TechnologyPage() {
  const { t, label } = useLabels();
  const techImages = ['/assets/technology/navigation.webp','/assets/technology/perception.webp','/assets/product-details/cleaning-module.webp'];
  return <Page title={label('Technology', '技术')} description={label('Navigation, perception, cleaning and connected intelligence.', '导航、感知、清洁与互联智能。')}><ImmersiveSection visual={visualAsset('/assets/technology/perception.webp', 'left-bottom', 'left', 'dark', 61, 50)} alt={label('Technology environment', '技术环境')} priority technical className={styles.technologyIntroHero}><div className={styles.immersivePageCopy}><span>{label('TECHNOLOGY', '技术')}</span><h1>{label('Quiet intelligence.', '安静运行的智能。')}</h1><p>{label('Technology supports the operation without competing for attention.', '让技术服务运营，而不干扰空间本身。')}</p></div></ImmersiveSection><section className={styles.technologyImmersiveStack}>{technologies.slice(0, 3).map((item, index) => <ImmersiveSection visual={visualAsset(techImages[index], index % 2 ? 'right-center' : 'left-bottom', index % 2 ? 'right' : 'left', 'dark', index % 2 ? 36 : 64, 50)} alt={t(item.title)} technical key={item.icon} className={styles.technologyStory}><div className={styles.technologyStoryCopy}><span>{item.icon}</span><h2>{t(item.title)}</h2><p>{t(item.body)}</p></div></ImmersiveSection>)}</section><ImmersiveSection visual={visualAsset('/assets/technology/cloud.webp', 'left-top', 'left', 'dark', 70, 50)} alt={label('Connected intelligence environment', '互联智能环境')} className={styles.technologyCloudStory}><div className={styles.cloudImmersiveCopy}><span>04 / {label('INTELLIGENT PLATFORM', '智能平台')}</span><h2>{label('旦生计划 intelligent platform', '旦生计划智能平台')}</h2><p>{label('Robot management, data management, object storage, dataset versions and service health in one operating view.', '在统一运营视图中连接机器人管理、数据管理、对象存储、数据集版本和系统健康状态。')}</p></div><ResponsiveVisual visual={visualAsset('/assets/cloud/platform-overview.webp', 'right-center', 'radial', 'dark')} alt={label('Intelligent platform overview', '智能平台概览')} className={styles.technologyCloudScreen} /></ImmersiveSection></Page>;
}

export function CasesPage() {
  const { t, label } = useLabels();
  return <Page title={label('Applications', '应用')} description={label('Concept application directions.', '概念应用方向。')}><ImmersiveSection visual={solutions[5].visual} alt={t(solutions[5].name)} priority className={styles.solutionPageHero}><div className={styles.immersivePageCopy}><span>{label('APPLICATIONS', '应用')}</span><h1>{label('Possibilities across real spaces.', '真实空间中的多种可能。')}</h1><p>{label('Application information will be updated after confirmation.', '应用信息将在确认后更新。')}</p></div></ImmersiveSection><ScenarioExplorer items={solutions.slice(0, 6)} /></Page>;
}

export function AboutPage() {
  const { label } = useLabels();
  const team = [label('Robotics research', '机器人研发'), label('Product engineering', '产品工程'), label('Operations and service', '运营与服务')];
  return <Page title={label('About', '关于我们')} description={label('About 旦生计划.', '关于旦生计划。')}>
    <section className={styles.aboutHero}><img src="/assets/company/company-01.webp" alt={label('Robotics research environment', '机器人研发环境')} width="2048" height="1152" /><div /><div className={styles.standardContainer}><span>{label('ABOUT', '关于我们')}</span><h1>{label('Building the next generation of autonomous cleaning.', '构建下一代自主清洁。')}</h1></div></section>
    <section className={styles.companyIntro}><div className={styles.standardContainer}><Reveal><div><span>01 / {label('COMPANY', '企业介绍')}</span><h2>{label('Technology with a clear purpose.', '让技术服务于清晰目标。')}</h2><p>{label('旦生计划 explores intelligent robotic systems for commercial and professional environments. Formal company information is to be confirmed.', '旦生计划探索面向商业及专业环境的智能机器人系统，正式企业信息暂定。')}</p></div></Reveal><Reveal variant="mask-reveal" delay={1}><img src="/assets/company/company-02.webp" alt={label('Product development environment', '产品研发环境')} width="2048" height="1365" /></Reveal></div></section>
    <section className={styles.teamSection}><div className={styles.standardContainer}><header><span>02 / {label('TEAM', '团队')}</span><h2>{label('Different disciplines. One operating goal.', '不同专业，共同面向真实运营。')}</h2></header><div>{team.map((item, index) => <Reveal className={styles.teamMotion} delay={(index + 1) as 1 | 2 | 3} key={item}><article><div><span>0{index + 1}</span></div><h3>{item}</h3><p>{label('Team information to be confirmed.', '团队信息暂定。')}</p></article></Reveal>)}</div></div></section>
    <section className={styles.cultureSection}><div className={styles.standardContainer}><header><span>03 / {label('CULTURE', '文化')}</span><h2>{label('How we think about the work.', '我们如何理解这项工作。')}</h2></header><div>{[[label('Mission','使命'),label('Make professional cleaning more autonomous and manageable.','让专业清洁更自主、更易于管理。')],[label('Vision','愿景'),label('Build robotic systems that belong naturally in real spaces.','构建自然融入真实空间的机器人系统。')],[label('Values','价值观'),label('Clarity, reliability and respect for the operating environment.','清晰、可靠，并尊重真实运营环境。')]].map(([title,body],index)=><Reveal className={styles.cultureMotion} delay={(index + 1) as 1 | 2 | 3} key={title}><article><span>0{index+1}</span><h3>{title}</h3><p>{body}</p></article></Reveal>)}</div></div></section>
    <section className={styles.timelineSection}><div className={styles.standardContainer}><header><span>04 / {label('TIMELINE', '发展时间线')}</span><h2>{label('Milestones to be confirmed.', '发展里程碑暂定。')}</h2></header><Reveal className={styles.timelineMotion}>{[label('Research direction','研发方向'),label('Prototype validation','原型验证'),label('Operational readiness','运营准备')].map(item=><article key={item}><span>{label('Year TBD','年份暂定')}</span><i /><h3>{item}</h3><p>{label('Formal milestone information to be confirmed.','正式里程碑信息暂定。')}</p></article>)}</Reveal></div></section>
    <section className={styles.honorsSection}><div className={styles.standardContainer}><header><span>05 / {label('HONORS', '荣誉')}</span><h2>{label('Honors and certifications to be confirmed.', '荣誉与认证信息暂定。')}</h2></header><Reveal className={styles.honorsMotion}>{[1,2,3,4].map(item=><span key={item}>{label('Information TBD','信息暂定')}</span>)}</Reveal></div></section>
    <ContactBand />
  </Page>;
}

export function NewsPage() {
  const { t, label } = useLabels();
  const [active, setActive] = useState('all');
  const categories = [{ key: 'all', text: label('All', '全部') }, { key: 'company', text: label('Company', '企业动态') }, { key: 'product', text: label('Products', '产品资讯') }];
  const visible = active === 'all' ? news : active === 'company' ? news.slice(0, 1) : news.slice(1);
  return <Page title={label('News', '资讯中心')} description={label('Information from 旦生计划.', '了解更多旦生计划相关信息。')}><section className={styles.newsTitle}><div className={styles.standardContainer}><span>{label('NEWS', '资讯中心')}</span><h1>{label('News and perspectives.', '资讯与观点。')}</h1><p>{label('Learn more about products, technology and company progress.', '了解产品、技术与企业进展。')}</p></div></section><section className={styles.newsListing}><div className={styles.standardContainer}><div className={styles.newsTabs} role="tablist">{categories.map(item=><button className={active===item.key?styles.newsTabActive:''} key={item.key} onClick={()=>setActive(item.key)} type="button" role="tab" aria-selected={active===item.key}>{item.text}</button>)}</div><div className={styles.newsGrid}>{visible.map((item, index)=><Reveal className={styles.newsGridItem} delay={(index + 1) as 1 | 2 | 3} key={item.slug}><Link to={`/news/${item.slug}`}><span className={styles.newsImageFrame}><img src={item.image} alt="" width="1600" height="900" /></span><span>{t(item.date)} · {t(item.category)}</span><h2>{t(item.title)}</h2><p>{t(item.summary)}</p></Link></Reveal>)}</div><nav className={styles.pagination} aria-label={label('Pagination','分页')}><button className={styles.paginationActive} type="button">1</button><button type="button" disabled>2</button><button type="button" disabled><ArrowRight /></button></nav></div></section></Page>;
}

export function NewsDetailPage() {
  const { slug } = useParams(); const { t, label } = useLabels(); const item = news.find(value => value.slug === slug);
  if (!item) return <Navigate to="/404" replace />;
  const related = news.filter(value => value.slug !== item.slug).slice(0, 2);
  return <Page title={t(item.title)} description={t(item.summary)}><article className={styles.articleLayout}><header className={styles.narrowContainer}><span>{t(item.category)} · {t(item.date)}</span><h1>{t(item.title)}</h1><p>{t(item.summary)}</p></header><figure className={styles.articleHero}><img src={item.image} alt="" width="1600" height="900" /></figure><div className={styles.articleBody}><p>{label('This article layout is prepared for confirmed company information, product updates and technical perspectives.', '该文章版式用于承载确认后的企业信息、产品动态与技术观点。')}</p><h2>{label('A clearer way to understand the work', '以更清晰的方式理解产品与工作')}</h2><p>{label('旦生计划 focuses on the relationship between autonomous systems, commercial spaces and day-to-day operations. Formal article content is to be confirmed.', '旦生计划关注自主系统、商业空间与日常运营之间的关系，正式文章内容暂定。')}</p><img src={related[0]?.image ?? item.image} alt="" width="1600" height="900" /><p>{label('Future updates will replace this text while keeping the reading structure, image ratios and related information hierarchy unchanged.', '后续正式内容将替换当前文字，并保留阅读结构、图片比例与相关信息层级。')}</p></div></article><section className={styles.relatedNews}><div className={styles.standardContainer}><header><h2>{label('Related news', '相关资讯')}</h2><TextLink to="/news">{label('All news','全部资讯')}</TextLink></header><div>{related.map(value=><Link key={value.slug} to={`/news/${value.slug}`}><img src={value.image} alt="" width="1600" height="900" /><span>{t(value.category)}</span><h3>{t(value.title)}</h3></Link>)}</div></div></section></Page>;
}

export function SupportPage() {
  const { label } = useLabels();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('basics');
  const groups = [
    { key: 'basics', title: label('Basic operation', '基础运行'), guides: [label('Before the first operation','首次运行前准备'), label('Start and pause an operation','开始与暂停作业'), label('Understand status indicators','了解状态指示')] },
    { key: 'manual', title: label('Manual controls', '手动操作'), guides: [label('Move the robot safely','安全移动机器人'), label('Create an operating area','创建作业区域'), label('Return to the service station','返回服务基站')] },
    { key: 'care', title: label('Daily care', '日常维护'), guides: [label('Clean the sensor area','清洁传感器区域'), label('Check the cleaning module','检查清洁组件'), label('Daily inspection checklist','日常检查清单')] },
  ];
  const selected = groups.find(item => item.key === category) ?? groups[0];
  const filtered = selected.guides.filter(item => item.toLowerCase().includes(query.toLowerCase()));
  return <Page title={label('Support', '使用指导')} description={label('Find operating and maintenance guidance.', '快速查找运行、操作与维护指导。')}><section className={styles.supportTitle}><div className={styles.standardContainer}><span>{label('SUPPORT', '支持')}</span><h1>{label('How can we help?', '使用指导')}</h1><label><Search /><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={label('Search guides and operating questions','搜索使用问题')} /></label></div></section><section className={styles.supportContent}><div className={styles.standardContainer}><aside>{groups.map(item=><button className={category===item.key?styles.supportCategoryActive:''} key={item.key} onClick={()=>setCategory(item.key)} type="button">{item.title}<span>{item.guides.length}</span></button>)}</aside><main><header><span>{label('GUIDES', '指导列表')}</span><h2>{selected.title}</h2><p>{label('Product-specific procedures and safety information are to be confirmed.', '具体产品操作流程与安全信息暂定。')}</p></header><div className={styles.guideList}>{filtered.length ? filtered.map((guide,index)=><Link key={guide} to={`/contact?topic=support`}><span>0{index+1}</span><strong>{guide}</strong><small>{label('Guide information to be confirmed','指导内容暂定')}</small><ArrowRight /></Link>) : <p>{label('No matching guide.', '没有匹配的指导内容。')}</p>}</div><section className={styles.videoGuides}><header><h2>{label('Video guides', '视频指导')}</h2></header><div>{[label('Getting started','快速开始'),label('Daily maintenance','日常维护')].map(item=><article key={item}><div><Play /></div><h3>{item}</h3><p>{label('Video information to be confirmed','视频信息暂定')}</p></article>)}</div></section></main></div></section></Page>;
}

export function ContactPage() {
  const { label } = useLabels(); const [params] = useSearchParams();
  const canvasRef = useMotionSurface<HTMLElement>();
  const initial = useMemo<Inquiry>(() => ({ name:'',company:'',email:'',region:'',topic:params.get('topic')||'Product inquiry',message:'' }), [params]);
  const [value,setValue] = useState(initial); const [errors,setErrors] = useState<Partial<Record<keyof Inquiry,string>>>({});
  const submit=(event:FormEvent)=>{event.preventDefault();const next=validateInquiry(value);setErrors(next);if(Object.keys(next).length===0)window.location.href=inquiryMailto(value)};
  const field=(key:keyof Inquiry,next:string)=>setValue(current=>({...current,[key]:next}));
  return <Page title={label('Contact','联系旦生计划')} description={label('Contact 旦生计划.','联系旦生计划。')}><section ref={canvasRef} className={styles.contactCanvas}><ResponsiveVisual visual={visualAsset('/assets/company/company-01.webp','left-bottom','left','dark',42,50)} alt=""/><div className={styles.contactCanvasShade}/><div className={styles.standardContainer}><aside><span>{label('CONTACT','联系旦生计划')}</span><h1>{label("Let's shape the future of cleaning.",'一起构建清洁的未来。')}</h1><p>{label('Formal contact information is to be confirmed. The form prepares an email in your own mail application.','正式联系方式暂定。表单将在您的邮件应用中生成询盘内容。')}</p></aside><form className={styles.form} onSubmit={submit} noValidate>{(['name','company','email','region'] as const).map(key=><label className={styles.field} key={key}><span>{label({name:'Name',company:'Company',email:'Email',region:'Country / Region'}[key],{name:'姓名',company:'公司',email:'邮箱',region:'国家 / 地区'}[key])}</span><input type={key==='email'?'email':'text'} value={value[key]} onChange={event=>field(key,event.target.value)} aria-invalid={Boolean(errors[key])}/>{errors[key]&&<small className={styles.fieldError}>{label('Please complete this field.','请正确填写此项。')}</small>}</label>)}<label className={`${styles.field} ${styles.fieldFull}`}><span>{label('Topic','主题')}</span><select value={value.topic} onChange={event=>field('topic',event.target.value)}><option>Product inquiry</option><option>Partnership</option><option>Service</option><option>Careers</option></select></label><label className={`${styles.field} ${styles.fieldFull}`}><span>{label('Message','留言')}</span><textarea value={value.message} onChange={event=>field('message',event.target.value)}/>{errors.message&&<small className={styles.fieldError}>{label('Please tell us how we can help.','请告诉我们您的需求。')}</small>}</label><p className={styles.formNote}>{label('No information is submitted to a server.','本页面不会向服务器提交信息。')}</p><button className={`${styles.button} ${styles.buttonDark}`} type="submit">{label('Prepare inquiry email','生成询盘邮件')} →</button></form></div></section></Page>;
}

export function LegalPage({ type }: { type:'privacy'|'terms' }) {
  const { label }=useLabels(); const isPrivacy=type==='privacy';
  return <Page title={label(isPrivacy?'Privacy':'Terms',isPrivacy?'隐私政策':'使用条款')} description={label('Formal legal content to be confirmed.','正式法律内容暂定。')}><PageHero eyebrow={label('LEGAL','法律')} title={label(isPrivacy?'Privacy':'Terms of use',isPrivacy?'隐私政策':'使用条款')} body={label('Formal legal language is to be confirmed.','正式法律文本暂定。')} /><section className={styles.legalSection}><div className={styles.narrowContainer}><h2>{label('Information to be confirmed','信息暂定')}</h2><p>{label('The current site stores only the selected language locally. The contact form opens the visitor’s email application and does not submit information to a server.','当前网站仅在本地保存语言选择。联系表单会打开访客自己的邮件应用，不会向服务器提交信息。')}</p></div></section></Page>;
}

export function NotFoundPage() { const { label }=useLabels(); return <div className={styles.notFound}><div><strong>旦生计划 / 404</strong><h1>404</h1><p>{label('This route has moved beyond the map.','这个页面不在当前地图中。')}</p><ButtonLink to="/">{label('Return home','返回首页')}</ButtonLink></div></div>; }

function ContactBand({ immersive = false, image }: { immersive?: boolean; image?: VisualAsset }) {
  const { label }=useLabels();
  if (immersive && image) return <ImmersiveSection visual={{ ...image, contentPosition: 'left-bottom', overlayDirection: 'left', tone: 'dark' }} alt="" className={styles.immersiveContactBand}><div><span>旦生计划</span><h2>{label('Ready for a smarter clean?','准备好开启更智能的清洁了吗？')}</h2><ButtonLink to="/contact" tone="ghost">{label('Contact us','联系我们')}</ButtonLink></div></ImmersiveSection>;
  return <section className={styles.contactBand}><div className={styles.standardContainer}><div><span>旦生计划</span><h2>{label('Ready for a smarter clean?','准备好开启更智能的清洁了吗？')}</h2></div><ButtonLink to="/contact" tone="dark">{label('Contact us','联系我们')}</ButtonLink></div></section>;
}
