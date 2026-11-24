import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Lightweight IntersectionObserver-based reveal animation.
 * Children of the returned ref that carry the class `reveal` animate in
 * once when the container enters the viewport.
 *
 * No ScrollTrigger plugin needed → smaller bundle, faster boot.
 */
export function useGsapReveal<T extends HTMLElement = HTMLDivElement>(
  options: { stagger?: number; y?: number; duration?: number; threshold?: number } = {},
) {
  const ref = useRef<T | null>(null);
  const { stagger = 0.08, y = 24, duration = 0.7, threshold = 0.15 } = options;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
    if (!targets.length) return;

    gsap.set(targets, { opacity: 0, y });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            gsap.to(targets, {
              opacity: 1,
              y: 0,
              duration,
              ease: 'power3.out',
              stagger,
            });
            io.disconnect();
          }
        });
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );

    io.observe(root);
    return () => io.disconnect();
  }, [stagger, y, duration, threshold]);

  return ref;
}
