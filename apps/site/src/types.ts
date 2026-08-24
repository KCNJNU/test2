export type Language = 'en' | 'zh';
export type LocalizedText = Record<Language, string>;
export type ContentStatus = 'official' | 'placeholder';

export type ContentPosition =
  | 'left-top'
  | 'left-center'
  | 'left-bottom'
  | 'right-center'
  | 'right-bottom'
  | 'center-bottom';

export type OverlayDirection = 'left' | 'right' | 'bottom' | 'radial';

export interface VisualAsset {
  desktopSrc: string;
  mobileSrc?: string;
  focalDesktop: { x: number; y: number };
  focalMobile: { x: number; y: number };
  contentPosition: ContentPosition;
  overlayDirection: OverlayDirection;
  tone: 'light' | 'dark';
}

export interface Product {
  slug: string;
  name: string;
  type: LocalizedText;
  statement: LocalizedText;
  description: LocalizedText;
  image: string;
  visual: VisualAsset;
  accent: string;
  features: LocalizedText[];
  specs: { label: LocalizedText; value: string }[];
  contentStatus: ContentStatus;
}

export interface Solution {
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  tone: string;
  image?: string;
  visual: VisualAsset;
  contentStatus: ContentStatus;
}

export interface NewsItem {
  slug: string;
  category: LocalizedText;
  title: LocalizedText;
  summary: LocalizedText;
  date: LocalizedText;
  image: string;
  contentStatus: ContentStatus;
}
