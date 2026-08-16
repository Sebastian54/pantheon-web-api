"use client";

import { useState, useTransition } from "react";
import { updateMemberGrants } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

type NetworkServer = { id: string; name: string; serverUuid: string };

export function EditPermissionsModal({
  networkId,
  userId,
  memberName,
  networkServers,
  grantedServerUuids,
}: {
  networkId: string;
  userId: string;
  memberName: string;
  networkServers: NetworkServer[];
  grantedServerUuids: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateMemberGrants(networkId, userId, formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          Edit Permissions
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Server access for {memberName}</DialogTitle>
          <DialogDescription>Choose which servers in this network they can access.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {networkServers.map((server) => (
              <label key={server.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="serverUuid"
                  value={server.serverUuid}
                  defaultChecked={grantedServerUuids.includes(server.serverUuid)}
                  className="h-4 w-4 rounded border-input"
                />
                {server.name}
              </label>
            ))}
          </div>
          <Button type="submit" variant="glass" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
