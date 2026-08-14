"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteNetwork } from "@/app/actions";

export function DeleteNetworkButton({ networkId, networkName }: { networkId: string; networkName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Delete "${networkName}"? This orphans its servers back to unclaimed and cannot be undone.`)) {
          return;
        }
        startTransition(() => {
          deleteNetwork(networkId);
        });
      }}
    >
      Delete
    </Button>
  );
}
