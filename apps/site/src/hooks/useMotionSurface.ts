import { useEffect, useRef } from 'react';

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));

export function useMotionSurface<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduced = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    const pointerDisabled = reduced || (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 800px), (pointer: coarse)').matches);
    let scrollFrame = 0;
    let pointerFrame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const updateScroll = () => {
      scrollFrame = 0;
      const rect = element.getBoundingClientRect();
      const visualProgress = clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0, 1);
      const sectionProgress = clamp(-rect.top / Math.max(1, rect.height), 0, 1);
      element.style.setProperty('--visual-progress', visualProgress.toFixed(4));
      element.style.setProperty('--section-progress', sectionProgress.toFixed(4));
      element.style.setProperty('--scroll-image-y', `${(22 - visualProgress * 44).toFixed(2)}px`);
      element.style.setProperty('--scroll-image-scale', (1.06 - visualProgress * .055).toFixed(4));
      element.style.setProperty('--scroll-copy-y', `${(-sectionProgress * 22).toFixed(2)}px`);
      element.style.setProperty('--scroll-copy-opacity', clamp(1 - sectionProgress * 1.45, 0, 1).toFixed(4));
    };
    const requestScroll = () => { if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScroll); };

    const renderPointer = () => {
      const damping = .095;
      currentX += (targetX - currentX) * damping;
      currentY += (targetY - currentY) * damping;
      element.style.setProperty('--motion-bg-x', `${(currentX * 7).toFixed(2)}px`);
      element.style.setProperty('--motion-bg-y', `${(currentY * 5).toFixed(2)}px`);
      element.style.setProperty('--motion-light-x', `${(currentX * 12).toFixed(2)}px`);
      element.style.setProperty('--motion-light-y', `${(currentY * 9).toFixed(2)}px`);
      element.style.setProperty('--motion-tech-x', `${(currentX * 18).toFixed(2)}px`);
      element.style.setProperty('--motion-tech-y', `${(currentY * 14).toFixed(2)}px`);
      element.style.setProperty('--motion-foreground-x', `${(currentX * 23).toFixed(2)}px`);
      element.style.setProperty('--motion-foreground-y', `${(currentY * 18).toFixed(2)}px`);
      element.style.setProperty('--tilt-x', `${(-currentY * 1.35).toFixed(3)}deg`);
      element.style.setProperty('--tilt-y', `${(currentX * 1.8).toFixed(3)}deg`);
      element.style.setProperty('--pointer-light-x', `${(50 + currentX * 18).toFixed(2)}%`);
      element.style.setProperty('--pointer-light-y', `${(48 + currentY * 15).toFixed(2)}%`);
      if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > .003) {
        pointerFrame = window.requestAnimationFrame(renderPointer);
      } else {
        pointerFrame = 0;
      }
    };
    const requestPointer = () => { if (!pointerFrame) pointerFrame = window.requestAnimationFrame(renderPointer); };
    const onPointerMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      targetX = clamp(((event.clientX - rect.left) / Math.max(1, rect.width) - .5) * 2);
      targetY = clamp(((event.clientY - rect.top) / Math.max(1, rect.height) - .5) * 2);
      requestPointer();
    };
    const onPointerLeave = () => { targetX = 0; targetY = 0; requestPointer(); };

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) element.dataset.inview = 'true';
    }, { threshold: .12 }) : null;
    observer?.observe(element);
    if (!observer) element.dataset.inview = 'true';
    updateScroll();
    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', requestScroll);
    if (!pointerDisabled) {
      element.addEventListener('pointermove', onPointerMove, { passive: true });
      element.addEventListener('pointerleave', onPointerLeave);
    }
    return () => {
      observer?.disconnect();
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      window.removeEventListener('scroll', requestScroll);
      window.removeEventListener('resize', requestScroll);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return ref;
}
