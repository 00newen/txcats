'use client';

import { QueryProvider } from '@/lib/providers/QueryProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
