"use client";

import { useState } from "react";
import { startTotpSetup, confirmTotpSetup, disableTwoFactor } from "@/app/settings/security/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(enabled);

  async function begin() {
    setPending(true);
    setError(null);
    try {
      const result = await startTotpSetup();
      setQr(result.qrCodeDataUrl);
      setSecret(result.secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start setup");
    } finally {
      setPending(false);
    }
  }

  async function confirm(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await confirmTotpSetup(formData);
      setQr(null);
      setSecret(null);
      setIsEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setPending(false);
    }
  }

  async function disable(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await disableTwoFactor(formData);
      setIsEnabled(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setPending(false);
    }
  }

  if (isEnabled) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-emerald-400">Two-factor authentication is enabled.</p>
        <form action={disable} className="flex gap-2">
          <Input name="code" inputMode="numeric" placeholder="Code to disable" required />
          <Button type="submit" variant="destructive" disabled={pending}>
            Disable
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="glass" onClick={begin} disabled={pending}>
          {pending ? "Generating…" : "Set up two-factor authentication"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote image */}
      <img src={qr} alt="Scan with your authenticator app" className="h-40 w-40 rounded-lg bg-white p-2" />
      {secret && <p className="break-all text-xs text-muted-foreground">Manual entry key: {secret}</p>}
      <form action={confirm} className="flex gap-2">
        <Input name="code" inputMode="numeric" placeholder="123456" required autoFocus />
        <Button type="submit" variant="glass" disabled={pending}>
          Confirm
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
