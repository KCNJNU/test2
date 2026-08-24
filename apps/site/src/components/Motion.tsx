import { useEffect, useRef, type ImgHTMLAttributes } from 'react';

export function ParallaxImage({ amplitude = 32, ...props }: ImgHTMLAttributes<HTMLImageElement> & { amplitude?: number }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 800px)');
    if (reduced.matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const progress = Math.max(-1, Math.min(1, (window.innerHeight / 2 - (rect.top + rect.height / 2)) / ((window.innerHeight + rect.height) / 2)));
      element.style.setProperty('--parallax-y', `${progress * amplitude}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [amplitude]);

  return <img ref={ref} {...props} />;
}
