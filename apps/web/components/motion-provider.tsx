'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function MotionProvider({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.utils.toArray<HTMLElement>('[data-reveal]', scope.current).forEach(element => {
      gsap.fromTo(element, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: .52, ease: 'power2.out', immediateRender: false,
        scrollTrigger: { trigger: element, start: 'top 90%', once: true },
      });
    });
  }, { scope });
  return <div ref={scope}>{children}</div>;
}
