import { Sidebar } from '@/components/core/Sidebar';
import { VaultStatusBanner } from '@/auth/VaultStatusBanner';
import { AppShellActions } from '@/components/core/AppShellActions';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex h-screen'>
      <Sidebar />
      <div className='flex flex-1 flex-col md:ml-64'>
        <VaultStatusBanner />
        <AppShellActions />
        <main className='flex-1 overflow-y-auto p-6'>{children}</main>
      </div>
    </div>
  );
}
