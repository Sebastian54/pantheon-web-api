/** Matches the iOS app's rule: online iff lastSeenAt exists and is within 60s. */
export function isServerOnline(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() < 60_000;
}

export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatPlaytime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours < 1) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/** Strips the "minecraft:" namespace and turns underscores into spaces, capitalized — matches
 * the iOS app's display convention for block/item identifiers (e.g. "minecraft:oak_log" -> "Oak Log"). */
export function formatIdentifier(identifier: string): string {
  const withoutNamespace = identifier.includes(":") ? identifier.split(":")[1] : identifier;
  return withoutNamespace
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** ISO 3166-1 alpha-2 country codes convert to their flag emoji via regional indicator symbols. */
export function countryFlagEmoji(countryCode: string | null): string | null {
  if (!countryCode || countryCode.length !== 2) return null;
  const upper = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  const codePoints = [...upper].map((char) => 0x1f1e6 - 65 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Verified directly against PantheonFabric.buildCapabilities() — not guessed.
export const MOD_CAPABILITIES = {
  ledger: "ledger",
  spark: "spark",
  carpet: "carpet",
  plan: "plan",
  ait: "ait",
  aitLog: "aitlog",
  antidupe: "antidupe",
} as const;

export function hasCapability(installedMods: string[], capability: string): boolean {
  return installedMods.includes(capability);
}
