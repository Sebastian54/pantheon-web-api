"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="glass-panel w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Pantheon</CardTitle>
          <CardDescription>Sign in to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="glass" className="w-full" onClick={() => signIn("discord")}>
            Sign in with Discord
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
