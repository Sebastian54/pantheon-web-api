"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TWO_FACTOR_REQUIRED_ERROR, EMAIL_NOT_VERIFIED_ERROR } from "@/lib/auth-errors";

export function CredentialsSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    // Deliberately not redirect:true — a thrown authorize() error surfaces
    // here as result.error instead of a full-page redirect to /sign-in with
    // an ?error= query param, which is what lets this stay a single form
    // that swaps in the TOTP field rather than reloading the page.
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      totpCode: needsTotp ? totpCode : undefined,
    });
    setPending(false);

    if (result?.error === TWO_FACTOR_REQUIRED_ERROR) {
      setNeedsTotp(true);
      return;
    }
    if (result?.error === EMAIL_NOT_VERIFIED_ERROR) {
      setError("Verify your email before signing in — check your inbox for the link.");
      return;
    }
    if (result?.error) {
      setError(needsTotp ? "Invalid two-factor code" : "Invalid email or password");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!needsTotp ? (
        <>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value)}
            autoComplete="one-time-code"
            autoFocus
            required
          />
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="glass" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : needsTotp ? "Verify" : "Sign in"}
      </Button>
    </form>
  );
}
