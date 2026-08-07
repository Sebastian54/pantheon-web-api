import * as Sentry from "@sentry/nextjs";

// Sentry.init no-ops when dsn is undefined, so this is safe to run with no DSN configured.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
});
