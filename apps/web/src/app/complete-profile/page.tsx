import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { completeProfile } from "@/app/complete-profile/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function CompleteProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }
  // Already has a name — nothing to complete, and this page shouldn't loop
  // someone back here after they've just set one.
  if (session.user.name) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="glass-panel w-full max-w-sm">
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>
            {session.user.email} signed in without a display name — set one to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={completeProfile} className="space-y-3">
            <Input name="name" placeholder="Display Name" autoComplete="name" autoFocus required />
            <Button type="submit" variant="glass" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
