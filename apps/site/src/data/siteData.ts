import type { ContentPosition, LocalizedText, NewsItem, OverlayDirection, Product, Solution, VisualAsset } from '../types';

export const CONTACT_EMAIL = '';
export const lt = (en: string, zh: string): LocalizedText => ({ en, zh });
const visual = (
  desktopSrc: string,
  contentPosition: ContentPosition,
  overlayDirection: OverlayDirection,
  tone: VisualAsset['tone'],
  focalDesktop = { x: 50, y: 50 },
  focalMobile = { x: 50, y: 50 },
  mobileSrc?: string,
): VisualAsset => ({ desktopSrc, mobileSrc, focalDesktop, focalMobile, contentPosition, overlayDirection, tone });

export const products: Product[] = [
  {
    slug: 'c1', name: '产品名称暂定 01', accent: '#178cff', image: '/assets/products/product-01-main.webp', visual: visual('/assets/products/product-01-main.webp', 'right-center', 'left', 'light', { x: 63, y: 52 }, { x: 56, y: 48 }, '/assets/products/product-01-main-mobile.webp'), contentStatus: 'placeholder',
    type: lt('Compact autonomous cleaner', '紧凑型自主清洁机器人'), statement: lt('Precision for everyday spaces.', '让自主，不止于移动。'),
    description: lt('Made to move quietly through refined shared spaces.', '安静穿行于每一处共享空间。'),
    features: [lt('Autonomous navigation', '自主导航'), lt('Spatial perception', '空间感知'), lt('Intelligent cleaning', '智能清洁'), lt('Cloud intelligence', '云端智能')],
    specs: [{ label: lt('Cleaning efficiency', '清洁效率'), value: '--' }, { label: lt('Runtime', '续航时间'), value: '--' }, { label: lt('Cleaning width', '清洁宽度'), value: '--' }, { label: lt('Noise level', '运行噪音'), value: '--' }],
  },
  {
    slug: 'c2', name: '产品名称暂定 02', accent: '#14b8c4', image: '/assets/products/product-02-main.webp', visual: visual('/assets/products/product-02-main.webp', 'left-bottom', 'left', 'dark', { x: 66, y: 50 }, { x: 58, y: 50 }, '/assets/products/product-02-main-mobile.webp'), contentStatus: 'placeholder',
    type: lt('Versatile commercial cleaner', '全能型商用清洁机器人'), statement: lt('Capability without complexity.', '理解空间，才能真正自主。'),
    description: lt('One calm operating experience for changing commercial environments.', '从容应对不断变化的商业环境。'),
    features: [lt('Adaptive planning', '自适应规划'), lt('Environment awareness', '环境理解'), lt('Dynamic strategy', '动态策略'), lt('Fleet connection', '集群连接')],
    specs: [{ label: lt('Cleaning efficiency', '清洁效率'), value: '--' }, { label: lt('Runtime', '续航时间'), value: '--' }, { label: lt('Tank capacity', '水箱容量'), value: '--' }, { label: lt('Navigation accuracy', '导航精度'), value: '--' }],
  },
  {
    slug: 's1', name: '产品名称暂定 03', accent: '#72a7ff', image: '/assets/products/product-03-main.webp', visual: visual('/assets/products/product-03-main.webp', 'left-bottom', 'right', 'dark', { x: 64, y: 52 }, { x: 54, y: 48 }, '/assets/products/product-03-main-mobile.webp'), contentStatus: 'placeholder',
    type: lt('Large-space cleaning platform', '大空间自主清洁平台'), statement: lt('Built to move at scale.', '让大空间，持续保持洁净。'),
    description: lt('A connected cleaning direction for high-capacity public environments.', '面向大型公共环境的互联清洁方向。'),
    features: [lt('Large-area autonomy', '大空间自主作业'), lt('360° perception', '全域环境感知'), lt('Operational scheduling', '运营排程'), lt('Fleet coordination', '集群协同')],
    specs: [{ label: lt('Cleaning efficiency', '清洁效率'), value: '--' }, { label: lt('Continuous operation', '连续作业'), value: '--' }, { label: lt('Coverage', '覆盖能力'), value: '--' }, { label: lt('Safety clearance', '安全距离'), value: '--' }],
  },
];

const solutionRows = [
  ['office', 'Office', '办公空间', 'Quiet intelligence for focused workplaces.', '安静智能，融入专注办公环境。', '#715d50', '/assets/scenarios/office.webp'],
  ['hotel', 'Hotel', '酒店', 'A discreet clean that respects every guest experience.', '不打扰宾客体验的精致清洁。', '#94704d', '/assets/scenarios/hotel.webp'],
  ['apartment', 'Apartment', '公寓', 'Consistent care for shared residential spaces.', '持续守护共享居住空间。', '#617b73', '/assets/scenarios/office.webp'],
  ['shopping-mall', 'Shopping Mall', '购物中心', 'Flexible operations for high-traffic destinations.', '灵活应对高流量商业空间。', '#7a6d62', '/assets/scenarios/mall.webp'],
  ['hospital', 'Hospital', '医院', 'Structured workflows for demanding environments.', '面向严苛环境的结构化作业流程。', '#7094a1', '/assets/scenarios/hospital.webp'],
  ['airport', 'Airport', '机场', 'Scalable autonomy across complex public spaces.', '在复杂公共空间实现规模化自主作业。', '#45617f', '/assets/scenarios/airport.webp'],
  ['industrial-facility', 'Industrial Facility', '工业设施', 'Durable intelligence for operational floors.', '面向生产运营地面的可靠智能。', '#5d646a', '/assets/scenarios/industrial.webp'],
] as const;

const solutionFocals: Record<string, { desktop: { x: number; y: number }; mobile: { x: number; y: number } }> = {
  office: { desktop: { x: 58, y: 54 }, mobile: { x: 60, y: 50 } },
  hotel: { desktop: { x: 62, y: 52 }, mobile: { x: 61, y: 48 } },
  apartment: { desktop: { x: 58, y: 54 }, mobile: { x: 60, y: 50 } },
  'shopping-mall': { desktop: { x: 62, y: 50 }, mobile: { x: 64, y: 48 } },
  hospital: { desktop: { x: 56, y: 50 }, mobile: { x: 58, y: 48 } },
  airport: { desktop: { x: 64, y: 52 }, mobile: { x: 65, y: 48 } },
  'industrial-facility': { desktop: { x: 62, y: 52 }, mobile: { x: 62, y: 50 } },
};

export const solutions: Solution[] = solutionRows.map(([slug, en, zh, descriptionEn, descriptionZh, tone, image]) => ({
  slug,
  name: lt(en, zh),
  description: lt(descriptionEn, descriptionZh),
  tone,
  image,
  visual: visual(image, 'left-bottom', 'left', 'dark', solutionFocals[slug].desktop, solutionFocals[slug].mobile),
  contentStatus: 'placeholder',
}));

export const news: NewsItem[] = [
  { slug: 'designing-autonomy', category: lt('Design', '设计'), title: lt('Designing autonomy around real spaces', '围绕真实空间设计自主能力'), summary: lt('The principles behind a calmer product experience.', '关于更从容产品体验的设计原则。'), date: lt('Coming soon', '即将发布'), image: '/assets/news/news-01.webp', contentStatus: 'placeholder' },
  { slug: 'quiet-technology', category: lt('Technology', '技术'), title: lt('Why the best technology works quietly', '为什么最好的技术安静运行'), summary: lt('Perception, planning and cleaning working as one.', '感知、规划和清洁策略协同运行。'), date: lt('Coming soon', '即将发布'), image: '/assets/news/news-02.webp', contentStatus: 'placeholder' },
  { slug: 'connected-clean', category: lt('Intelligent Platform', '智能平台'), title: lt('From every clean to operational intelligence', '从每次清洁到运营智能'), summary: lt('The connected data foundation behind autonomous fleets.', '自主机器人集群背后的数据基础。'), date: lt('Coming soon', '即将发布'), image: '/assets/news/news-03.webp', contentStatus: 'placeholder' },
];

export const technologies = [
  { icon: '01', title: lt('Autonomous Navigation', '自主导航'), body: lt('Understand geometry. Plan with purpose.', '理解空间结构，规划每一次移动。') },
  { icon: '02', title: lt('Intelligent Perception', '环境感知'), body: lt('See change. Respond in real time.', '感知变化，实时作出响应。') },
  { icon: '03', title: lt('Smart Cleaning', '智能清洁'), body: lt('Adapt every task to the space.', '让每一次任务适应真实环境。') },
  { icon: '04', title: lt('Cloud Intelligence', '云端智能'), body: lt('Connect every machine to one operating view.', '让每台设备连接同一个运营视图。') },
];
