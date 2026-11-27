import { TRPCClientError } from '@trpc/client';

/** The server's message for an expected error (e.g. why a question was rejected). */
export function serverMessage(error: unknown): string | undefined {
  if (error instanceof TRPCClientError && error.data?.code !== 'INTERNAL_SERVER_ERROR') {
    return error.message;
  }
  return undefined;
}

export function appErrorCode(error: unknown): string | undefined {
  return error instanceof TRPCClientError ? error.data?.appErrorCode : undefined;
}
