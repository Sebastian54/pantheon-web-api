import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="glass-panel w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome, {session.user.name}</CardTitle>
          <CardDescription>Role: {session.user.role}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </main>
  );
}
