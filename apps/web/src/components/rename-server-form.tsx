"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renameServer } from "@/app/servers/[id]/actions";

export function RenameServerForm({
  serverId,
  networkId,
  currentName,
}: {
  serverId: string;
  networkId: string;
  currentName: string;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) {
    return (
      <Button type="button" variant="ghost" size="icon" onClick={() => setIsEditing(true)} aria-label="Rename server">
        <Pencil className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await renameServer(serverId, networkId, formData);
        setIsEditing(false);
      }}
      className="flex items-center gap-2"
    >
      <input
        name="name"
        defaultValue={currentName}
        required
        autoFocus
        className="h-9 rounded-full border border-input bg-background px-3 text-sm text-foreground"
      />
      <Button type="submit" variant="secondary" size="sm">
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
        Cancel
      </Button>
    </form>
  );
}
