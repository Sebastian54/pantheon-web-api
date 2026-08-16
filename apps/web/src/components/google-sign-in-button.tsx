"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  return (
    <Button variant="glass" className="w-full" onClick={() => signIn("google", { callbackUrl: "/" })}>
      Sign in with Google
    </Button>
  );
}
