import 'server-only';
import { AppErrorCode } from '@/shared/types';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { getUID } from './services/firebase/auth';

export type Context = {
  req: Request;
  playerId?: string;
};

// superjson keeps Dates intact across the wire.
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        appErrorCode: (error.cause as { appErrorCode?: AppErrorCode })?.appErrorCode,
      },
    };
  },
});

export const router = t.router;

/** Procedure for signed-in (anonymous) players: verifies the Firebase ID token. */
export const authenticatedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

  let playerId: string | undefined;
  if (idToken) {
    try {
      playerId = await getUID(idToken);
    } catch (error) {
      console.error('Invalid ID token:', error);
    }
  }
  if (!playerId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
      cause: { appErrorCode: AppErrorCode.INVALID_AUTHORIZATION },
    });
  }

  return next({ ctx: { ...ctx, playerId } });
});

export const createContext = (opts: { req: Request }): Context => ({ req: opts.req });
