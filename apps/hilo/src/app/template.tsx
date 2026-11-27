'use client';

import { motion } from 'framer-motion';

const variants = {
  hidden: { opacity: 0, scale: 0.95, filter: 'blur(10px)' },
  enter: { opacity: 1, scale: 1, filter: 'blur(0px)' },
};

const transition = { type: 'tween' as const, ease: 'easeInOut' as const, duration: 0.5 };

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.main variants={variants} initial="hidden" animate="enter" transition={transition}>
      {children}
    </motion.main>
  );
}
