'use client';

import { useVault } from '@/src/components/auth/VaultProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { ProtectedVaultContent } from '@/src/components/auth/ProtectedVaultContent';

export default function DashboardPage() {
  const { isUnlocked, isSetup } = useVault();

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          {/* Status Indicator */}
          {isUnlocked ? (
            <span className="flex items-center text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200">
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Vault Unlocked
            </span>
          ) : (
            <span className="flex items-center text-amber-600 text-sm font-medium bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              <ShieldAlert className="w-4 h-4 mr-1.5" />
              Vault Locked
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Actions Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your transactions and categories</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Link href="/upload">
              <Button className="w-full" variant="outline">Upload CSV</Button>
            </Link>
            <Link href="/transactions">
              <Button className="w-full" variant="outline">View Transactions</Button>
            </Link>
            <Link href="/categories">
              <Button className="w-full" variant="outline">Manage Categories</Button>
            </Link>
            <Link href="/patterns">
              <Button className="w-full" variant="outline">Smart Patterns</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Vault Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Vault Status</CardTitle>
            <CardDescription>Security Overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Encryption</span>
                <span className="font-semibold">AES-256-GCM</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={isUnlocked ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>
                  {isUnlocked ? "Active" : "Locked"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Protected Content Demo */}
      <ProtectedVaultContent>
        <Card className="bg-slate-50 border-dashed">
          <CardHeader>
            <CardTitle>Recent Activity (Encrypted)</CardTitle>
            <CardDescription>This content is only visible when your vault is unlocked.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-center justify-center text-muted-foreground italic">
              No recent transactions found.
            </div>
          </CardContent>
        </Card>
      </ProtectedVaultContent>
    </div>
  );
}
