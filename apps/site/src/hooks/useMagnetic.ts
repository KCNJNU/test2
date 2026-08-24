import { useEffect, useRef } from 'react';

export function useMagnetic<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 800px), (pointer: coarse)').matches)) return;
    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    const render = () => {
      currentX += (targetX - currentX) * .16;
      currentY += (targetY - currentY) * .16;
      element.style.setProperty('--magnetic-x', `${currentX.toFixed(2)}px`);
      element.style.setProperty('--magnetic-y', `${currentY.toFixed(2)}px`);
      if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > .02) frame = requestAnimationFrame(render);
      else frame = 0;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
    const move = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width - .5) * 7;
      targetY = ((event.clientY - rect.top) / rect.height - .5) * 5;
      schedule();
    };
    const leave = () => { targetX = 0; targetY = 0; schedule(); };
    element.addEventListener('pointermove', move, { passive: true });
    element.addEventListener('pointerleave', leave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', leave);
    };
  }, []);
  return ref;
}
