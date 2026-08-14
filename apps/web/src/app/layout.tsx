import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { TopNav } from "@/components/top-nav";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Pantheon",
  description:
    "Multi-tenant admin dashboard for analytics, command logs, and moderation data from remote Minecraft servers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthSessionProvider>
          <TopNav />
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
