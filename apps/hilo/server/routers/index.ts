import { router } from '@/server/trpc';
import { gameRouter } from './game';
import { hiloRouter } from './hilo';

export const appRouter = router({
  game: gameRouter,
  hilo: hiloRouter,
});

export type AppRouter = typeof appRouter;
