import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { registerUser } from "@/app/register/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="glass-panel w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Sign up with email and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={registerUser} className="space-y-3">
            <Input name="name" placeholder="Display Name" autoComplete="name" required />
            <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
            <Input
              name="password"
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <Button type="submit" variant="glass" className="w-full">
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
