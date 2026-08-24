import { useEffect, useRef } from 'react';

export function usePointerDepth<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 800px), (pointer: coarse)');
    if (reduced.matches) return;

    let frame = 0;
    let nextX = 0;
    let nextY = 0;
    const render = () => {
      frame = 0;
      element.style.setProperty('--depth-bg-x', `${nextX * 6}px`);
      element.style.setProperty('--depth-bg-y', `${nextY * 6}px`);
      element.style.setProperty('--depth-tech-x', `${nextX * 14}px`);
      element.style.setProperty('--depth-tech-y', `${nextY * 10}px`);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      nextX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
      nextY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
      schedule();
    };
    const onLeave = () => {
      nextX = 0;
      nextY = 0;
      schedule();
    };
    element.addEventListener('pointermove', onMove, { passive: true });
    element.addEventListener('pointerleave', onLeave);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return ref;
}
