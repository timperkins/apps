import { STEP } from './constants';

// Runs `update` at a fixed 60 Hz and `render` once per animation frame, outside React.
export function startLoop(update: (dt: number) => void, render: () => void): () => void {
  let raf = 0;
  let last = performance.now();
  let acc = 0;

  const frame = (now: number) => {
    // Cap the catch-up after a backgrounded tab so the ball does not jump.
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
