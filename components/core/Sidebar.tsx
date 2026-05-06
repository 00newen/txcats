'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  FolderTree,
  Sparkles,
  Tag,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useVault } from '@/auth/VaultProvider';
import { useEffect, useCallback } from 'react';
import { loadTransactions } from '@/lib/vault/loaders';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/categories', label: 'Categories', icon: FolderTree },
  { href: '/patterns', label: 'Patterns', icon: Sparkles },
  { href: '/categorize', label: 'Categorize', icon: Tag },
];

export function Sidebar() {
  const pathname = usePathname();
  const { dek } = useVault();
  const [isOpen, setIsOpen] = useState(false);
  const [uncategorizedCount, setUncategorizedCount] = useState<number | null>(null);

  const loadUncategorizedCount = useCallback(async () => {
    if (!dek) return;
    try {
      const result = await loadTransactions(dek, { uncategorizedOnly: true });
      setUncategorizedCount(result.items.length);
    } catch (e) {
      console.error('Failed to load count', e);
    }
  }, [dek]);

  useEffect(() => {
    loadUncategorizedCount();
  }, [loadUncategorizedCount]);

  // Listen for updates from other pages
  useEffect(() => {
    const handleUpdate = () => loadUncategorizedCount();
    window.addEventListener('tx-count-changed', handleUpdate);
    return () => window.removeEventListener('tx-count-changed', handleUpdate);
  }, [loadUncategorizedCount]);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card transition-transform duration-300 ease-in-out',
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="p-6">
            <h1 className="text-2xl font-bold">txCats</h1>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                  {item.label === 'Categorize' && uncategorizedCount !== null && uncategorizedCount > 0 && (
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      isActive
                        ? "bg-primary-foreground text-primary"
                        : "bg-primary text-primary-foreground"
                    )}>
                      {uncategorizedCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
