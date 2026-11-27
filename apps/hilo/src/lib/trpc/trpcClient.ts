import type { AppRouter } from '@/server/routers';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

export const createTrpcClient = (getHeaders?: () => HeadersInit | Promise<HeadersInit>) => {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/api/trpc',
        transformer: superjson,
        headers: getHeaders,
      }),
    ],
  });
};
