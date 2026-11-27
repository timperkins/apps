'use client';

import { useAuth } from '@/lib/firebase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { createTrpcClient, trpc } from './trpcClient';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const auth = useAuth();

  const trpcClientInstance = useMemo(() => {
    return createTrpcClient(async () => {
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        return {
          Authorization: `Bearer ${idToken}`,
        };
      }
      return {} as HeadersInit;
    });
  }, [auth]);

  return (
    <trpc.Provider client={trpcClientInstance} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
