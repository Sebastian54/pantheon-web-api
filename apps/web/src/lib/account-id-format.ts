// Split out from lib/account-id.ts so client components (the admin member
// list/permissions UI) can import this pure formatter without pulling in
// that file's server-only DB client — same reasoning as lib/auth-errors.ts.
export function formatAccountId(accountId: string): string {
  return `${accountId.slice(0, 4)}-${accountId.slice(4)}`;
}
