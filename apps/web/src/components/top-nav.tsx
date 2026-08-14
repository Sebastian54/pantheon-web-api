import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

/**
 * Persistent nav shown on every authenticated page, mirroring the iOS app's
 * 4-tab MainTabView (Servers/Analytics/Moderation/Settings) — this dashboard
 * has no per-network picker, so there's no "Networks" tab equivalent.
 * Renders nothing on /sign-in or when there's no session, so it's safe to
 * mount unconditionally from the root layout rather than needing a route
 * group split.
 */
export async function TopNav() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const links = [
    { href: "/", label: "Servers" },
    { href: "/analytics", label: "Analytics" },
    { href: "/moderation", label: "Moderation" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="glass-panel sticky top-0 z-10 flex items-center gap-1 border-x-0 border-t-0 px-4 py-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
