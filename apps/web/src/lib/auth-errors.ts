// Split out from lib/auth.ts so client components (the sign-in form) can
// import these string constants without pulling in lib/auth.ts's
// server-only DB client (drizzle -> pg can't run in the browser bundle).
export const TWO_FACTOR_REQUIRED_ERROR = "TWO_FACTOR_REQUIRED";
export const EMAIL_NOT_VERIFIED_ERROR = "EMAIL_NOT_VERIFIED";
