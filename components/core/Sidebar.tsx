'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  Receipt,
  FolderTree,
  Sparkles,
  Tag,
  Lock,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useVault } from '@/src/components/auth/VaultProvider';
import { fetchTransactions } from '@/src/server/actions/transactions';
import { decryptData } from '@/src/crypto/encryption';
import { useEffect, useCallback } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/categories', label: 'Categories', icon: FolderTree },
  { href: '/patterns', label: 'Patterns', icon: Sparkles },
  { href: '/categorize', label: 'Categorize', icon: Tag },
  { href: '/lock', label: 'Lock', icon: Lock },
];

export function Sidebar() {
  const pathname = usePathname();
  const { dek } = useVault();
  const [isOpen, setIsOpen] = useState(false);
  const [uncategorizedCount, setUncategorizedCount] = useState<number | null>(null);

  const loadUncategorizedCount = useCallback(async () => {
    if (!dek) return;
    try {
      const response = await fetchTransactions();
      if (response.success && response.items) {
        let count = 0;
        for (const item of response.items) {
          try {
            const aadBytes = new Uint8Array(atob(item.aadBase64).split('').map(c => c.charCodeAt(0)));
            const plaintext = await decryptData(item.ciphertextBase64, item.ivBase64, dek, aadBytes) as any;
            if (!plaintext.categoryId) {
              count++;
            }
          } catch (e) {
            // Decryption might fail if item is not a transaction or wrong key
          }
        }
        setUncategorizedCount(count);
      }
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

