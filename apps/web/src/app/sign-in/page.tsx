import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "@/components/sign-in-button";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { CredentialsSignInForm } from "@/components/credentials-sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; verifyError?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/");
  }

  const { verified, verifyError } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="glass-panel w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Pantheon</CardTitle>
          <CardDescription>Sign in to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-left">
          {verified === "1" && (
            <p className="rounded-lg bg-emerald-500/10 p-2 text-center text-sm text-emerald-400">
              Email verified — you can sign in now.
            </p>
          )}
          {verifyError === "1" && (
            <p className="rounded-lg bg-destructive/10 p-2 text-center text-sm text-destructive">
              That verification link is invalid or has expired.
            </p>
          )}

          <CredentialsSignInForm />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <SignInButton />
            <GoogleSignInButton />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/register" className="text-foreground underline underline-offset-4">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
