import { OAuth2Client } from "google-auth-library";

export type GoogleIdTokenPayload = {
  sub: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
};

/**
 * The GoogleSignIn-iOS SDK's "ID Token Verification" pattern: the SDK does
 * the whole OAuth dance on-device and hands the app a Google-signed ID
 * token (JWT). No code/verifier/redirect_uri exchange like Discord's
 * flow — just server-side signature + audience verification of a token the
 * client already has.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  audience: string,
): Promise<GoogleIdTokenPayload> {
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new Error("Google ID token payload missing sub");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified ?? false,
    name: payload.name,
  };
}
