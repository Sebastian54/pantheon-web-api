"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignInButton() {
  return (
    <Button
      variant="glass"
      className="w-full"
      onClick={() => signIn("discord", { callbackUrl: "/" })}
    >
      Sign in with Discord
    </Button>
  );
}
