"use client";

import { Lock, Upload } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { VaultDrawer } from "@/auth/VaultDrawer";
import { ImportTransactionsDrawer } from "@/features/upload/components/ImportTransactionsDrawer";

type DrawerName = "upload" | "vault";

export function AppShellActions() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeDrawer = searchParams.get("drawer");

  const openDrawer = (drawer: DrawerName) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("drawer", drawer);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const closeDrawer = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("drawer");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2 px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Import transactions"
          title="Import transactions"
          onClick={() => openDrawer("upload")}
        >
          <Upload className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Vault security"
          title="Vault security"
          onClick={() => openDrawer("vault")}
        >
          <Lock className="h-5 w-5" />
        </Button>
      </div>
      <ImportTransactionsDrawer
        open={activeDrawer === "upload"}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
          else openDrawer("upload");
        }}
      />
      <VaultDrawer
        open={activeDrawer === "vault"}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
          else openDrawer("vault");
        }}
      />
    </>
  );
}
