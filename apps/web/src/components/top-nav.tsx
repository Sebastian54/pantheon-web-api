import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { formatAccountId } from "@/lib/account-id-format";

/**
 * Persistent nav shown on every authenticated page, mirroring the iOS app's
 * 4-tab MainTabView (Servers/Analytics/Moderation/Settings) — this dashboard
 * has no per-network picker, so there's no "Networks" tab equivalent.
 * Renders nothing on /sign-in or when there's no session, so it's safe to
 * mount unconditionally from the root layout rather than needing a route
 * group split. Also carries the name + Account ID identity display — this
 * app has no separate sidebar layout, so TopNav is the one piece of chrome
 * present on every authenticated page, making it the natural home for it.
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
    <nav className="glass-panel sticky top-0 z-10 flex items-center justify-between gap-2 border-x-0 border-t-0 px-4 py-2">
      <div className="flex items-center gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </div>
      {session.user.name && (
        <div className="flex items-center gap-2 px-2 text-right text-sm">
          <span className="font-medium">{session.user.name}</span>
          {session.user.accountId && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatAccountId(session.user.accountId)}
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
