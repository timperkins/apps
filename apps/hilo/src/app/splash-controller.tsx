'use client';

import { animate } from 'framer-motion';
import { useEffect } from 'react';

const SPLASH_MIN_DURATION_MS = 1000;
const startTimeMs = performance.now();

export function SplashController() {
  useEffect(() => {
    const splash = document.getElementById('splash');
    if (!splash) return;

    const elapsedMs = performance.now() - startTimeMs;
    const remainingMs = Math.max(0, SPLASH_MIN_DURATION_MS - elapsedMs);

    setTimeout(() => {
      animate(
        splash,
        {
          opacity: [1, 1, 0],
          transform: ['scale(1)', 'scale(1.2) translateY(-2%)', 'scale(1.2) translateY(-2%)'],
          filter: ['blur(0px)', 'blur(10px)', 'blur(10px)'],
        },
        { duration: 0.3, times: [0, 0.5, 1] },
      ).then(() => splash.remove());
    }, remainingMs);
  }, []);

  return null;
}
