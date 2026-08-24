import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { inquiryMailto, validateInquiry, type Inquiry } from './lib/contact';
import { news, products, solutions } from './data/siteData';
import { ImmersiveSection, ResponsiveVisual } from './components/Visual';

beforeEach(() => { localStorage.clear(); history.replaceState({}, '', '/'); });
afterEach(() => cleanup());

describe('site content', () => {
  it('keeps unique routable slugs and marks prototype data', () => {
    expect(new Set(products.map(item => item.slug)).size).toBe(products.length);
    expect(new Set(solutions.map(item => item.slug)).size).toBe(solutions.length);
    expect(new Set(news.map(item => item.slug)).size).toBe(news.length);
    expect([...products, ...solutions, ...news].every(item => item.contentStatus === 'placeholder')).toBe(true);
  });

  it('renders a product route and switches language', async () => {
    history.replaceState({}, '', '/products/c1');
    render(<App />);
    expect(await screen.findByRole('heading', { name: '产品名称暂定 01' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Chinese' }));
    await waitFor(() => expect(document.documentElement.lang).toBe('zh-CN'));
    expect(screen.getByText('让自主，不止于移动。')).toBeInTheDocument();
  });

  it('renders responsive visual sources, focal variables and loading priority', () => {
    const { container } = render(<ResponsiveVisual visual={products[0].visual} alt="Product visual" priority />);
    const image = screen.getByRole('img', { name: 'Product visual' });
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
    expect(container.querySelector('source[type="image/webp"]')).toHaveAttribute('srcset', expect.stringContaining('product-01-main-3200.webp'));
    expect(container.querySelector('source[media="(max-width: 640px)"]')).toHaveAttribute('srcset', '/assets/products/product-01-main-mobile.webp 1080w');
    expect(container.querySelector('picture')).toHaveStyle({ '--focal-x': '63%', '--focal-mobile-x': '56%' });
  });

  it('keeps immersive motion as a visual layer with explicit technical state', () => {
    const { container } = render(<ImmersiveSection visual={products[0].visual} alt="Motion visual" motion="mask-horizontal" technical technicalState={1}><p>Content</p></ImmersiveSection>);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('data-motion', 'mask-horizontal');
    expect(section).toHaveAttribute('data-tech', '1');
    expect(container.querySelectorAll('svg path')).toHaveLength(3);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('crossfades between application scenarios without changing the route', async () => {
    render(<App />);
    const tabs = await screen.findAllByRole('tab');
    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('A discreet clean that respects every guest experience.')).toBeInTheDocument();
  });

  it('renders the branded 404 for an unknown route', async () => {
    history.replaceState({}, '', '/not-a-page');
    render(<App />);
    expect(await screen.findByText('This route has moved beyond the map.')).toBeInTheDocument();
  });

  it('renders the utility support template', async () => {
    history.replaceState({}, '', '/support');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'How can we help?' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search guides and operating questions')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic operation' })).toBeInTheDocument();
  });

  it('renders news in a dedicated reading layout', async () => {
    history.replaceState({}, '', '/news/designing-autonomy');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Designing autonomy around real spaces' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Related news' })).toBeInTheDocument();
  });
});

describe('contact inquiry', () => {
  const valid: Inquiry = { name: 'Alex', company: 'Example', email: 'alex@example.com', region: 'Singapore', topic: 'Partnership', message: 'Hello 旦生计划' };
  it('validates required values without submitting', () => { expect(validateInquiry({ ...valid, email: 'bad', message: '' })).toEqual({ email: 'email', message: 'required' }); });
  it('builds an explicit mailto link without inventing a recipient', () => { const link = inquiryMailto(valid); expect(link).toContain('mailto:?subject='); expect(decodeURIComponent(link)).toContain('Hello 旦生计划'); });
});
