import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="glass-panel w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to your inbox. Click it to activate your account, then{" "}
            <Link href="/sign-in" className="text-foreground underline underline-offset-4">
              sign in
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </main>
  );
}
