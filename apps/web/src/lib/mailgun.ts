const MAILGUN_FETCH_TIMEOUT_MS = 10_000;

// GitHub Student Pack's Mailgun credits provision a US-region domain by
// default; MAILGUN_API_BASE only needs overriding for an EU-region domain
// (api.eu.mailgun.net), so it's optional rather than required-to-boot.
const MAILGUN_API_BASE = process.env.MAILGUN_API_BASE || "https://api.mailgun.net";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Fire-and-forget-shaped, but the caller decides how to handle failure —
 * unlike VersionFooter's API fetch, a failed verification/2FA email isn't
 * something the user should be told "succeeded" for, so this throws rather
 * than swallowing errors.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    throw new Error("Mailgun is not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN missing)");
  }

  const body = new URLSearchParams({
    from: `Pantheon <noreply@${domain}>`,
    to,
    subject,
    html,
    text,
  });

  const response = await fetch(`${MAILGUN_API_BASE}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
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
