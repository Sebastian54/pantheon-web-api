import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@pantheon/db";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { VersionFooter } from "@/components/version-footer";
import { TwoFactorSettings } from "@/components/two-factor-settings";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { twoFactorEnabled: true },
  });

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>{session.user.name}</CardTitle>
          <CardDescription>{session.user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Require a code from an authenticator app when signing in with email and password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSettings enabled={user?.twoFactorEnabled ?? false} />
        </CardContent>
      </Card>

      <footer className="pt-4">
        <VersionFooter />
      </footer>
    </main>
  );
}
