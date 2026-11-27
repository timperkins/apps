'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to home page
    router.replace('/');
  }, [router]);

  return <div />;
}
