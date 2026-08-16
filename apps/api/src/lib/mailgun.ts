import { env } from "../config/env";

const MAILGUN_FETCH_TIMEOUT_MS = 10_000;
const MAILGUN_API_BASE = env.MAILGUN_API_BASE ?? "https://api.mailgun.net";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * apps/api's own copy of apps/web's lib/mailgun.ts — this service never
 * calls into apps/web, so /auth/mobile/register sends its own verification
 * email directly rather than proxying through the web app.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    throw new Error("Mailgun is not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN missing)");
  }

  const body = new URLSearchParams({
    from: `Pantheon <noreply@${env.MAILGUN_DOMAIN}>`,
    to,
    subject,
    html,
    text,
  });

  const response = await fetch(`${MAILGUN_API_BASE}/v3/${env.MAILGUN_DOMAIN}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(MAILGUN_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Mailgun send failed: ${response.status} ${await response.text()}`);
  }
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Verify your Pantheon account",
    html: `<p>Welcome to Pantheon. Confirm your email address to finish setting up your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
    text: `Welcome to Pantheon. Confirm your email address: ${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
}
