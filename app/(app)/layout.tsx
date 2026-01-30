import { Sidebar } from '@/components/core/Sidebar';
import { TopBar } from '@/components/core/TopBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex h-screen'>
      <Sidebar />
      <div className='flex flex-1 flex-col md:ml-64'>
        <TopBar />
        <main className='flex-1 overflow-y-auto p-6'>{children}</main>
      </div>
    </div>
  );
}
