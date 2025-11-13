'use client';

import { ClerkProvider as ClerkProviderBase } from '@clerk/nextjs';

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return <ClerkProviderBase>{children}</ClerkProviderBase>;
}

