import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Read via fs rather than a static `import "../../../../package.json"` — a
// relative import reaching outside apps/web's own root can hit Next.js's
// module-resolution boundary in a monorepo. Same approach as
// apps/api/src/routes/v1/version.ts, resolved relative to this file's own
// location so it's correct regardless of process.cwd().
const currentDir = dirname(fileURLToPath(import.meta.url));
const rootPackageJsonPath = resolve(currentDir, "../../../../package.json");
const { version: webVersion } = JSON.parse(readFileSync(rootPackageJsonPath, "utf-8")) as {
  version: string;
};

/**
 * "Pantheon vX.Y.Z" (this monorepo's own version, the same one GET
 * /api/v1/version reads server-side) + "API vX.Y.Z" fetched live from that
 * endpoint. Fails silently — an unreachable API just omits the second line,
 * matching the iOS app's VersionFooter, never an error.
 */
export async function VersionFooter({ className }: { className?: string }) {
  const apiVersion = await fetchApiVersion();

  return (
    <p className={className ?? "text-xs text-muted-foreground/50"}>
      Pantheon v{webVersion}
      {apiVersion && ` • API v${apiVersion}`}
    </p>
  );
}

async function fetchApiVersion(): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/api/v1/version`, {
      // This is unauthenticated, static-ish data; a short cache avoids
      // hitting the API on every single page render.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null || !("version" in data)) return null;
    const { version } = data as { version: unknown };
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}
