'use client';

import { UserButton } from '@clerk/nextjs';
import { ThemeToggle } from '@/components/core/ThemeToggle';

function UserButtonStub() {
  return (
    <div
      className='h-8 w-8 rounded-full bg-muted flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      tabIndex={0}
      role='button'
      aria-label='User menu'
    >
      <span className='text-xs text-muted-foreground'>U</span>
    </div>
  );
}

export function Topbar() {
  const hasClerkKeys = !!(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== ''
  );

  return (
    <header className='sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='flex h-16 items-center justify-end px-6'>
        <div className='flex items-center gap-4'>
          <ThemeToggle />
          {hasClerkKeys ? <UserButton /> : <UserButtonStub />}
        </div>
      </div>
    </header>
  );
}
