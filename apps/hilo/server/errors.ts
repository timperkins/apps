import { AppErrorCode } from '@/shared/types';
import { TRPCError } from '@trpc/server';

type TRPCCode = ConstructorParameters<typeof TRPCError>[0]['code'];

export function appError(code: TRPCCode, appErrorCode: AppErrorCode, message: string): TRPCError {
  return new TRPCError({ code, message, cause: { appErrorCode } });
}

export const errors = {
  gameNotFound: () => appError('NOT_FOUND', AppErrorCode.GAME_NOT_FOUND, 'Game not found'),
  roundNotFound: () => appError('NOT_FOUND', AppErrorCode.ROUND_NOT_FOUND, 'Round not found'),
  notAllowed: (message: string) => appError('FORBIDDEN', AppErrorCode.NOT_ALLOWED, message),
  onlyHost: () =>
    appError('FORBIDDEN', AppErrorCode.ONLY_HOST_ALLOWED, 'Only the host can do that'),
  wrongStage: (message: string) => appError('BAD_REQUEST', AppErrorCode.NOT_ALLOWED, message),
};

/** Rethrows TRPCErrors as they are and wraps anything else with `fallback`. */
export function rethrow(error: unknown, fallback: AppErrorCode, message: string): never {
  console.error(`${message}:`, error);
  if (error instanceof TRPCError) throw error;
  throw appError('INTERNAL_SERVER_ERROR', fallback, message);
}
