const DISCORD_API_BASE = "https://discord.com/api/v10";

// Neither fetch below had a timeout, so a stalled connection to Discord's API
// left the request handler awaiting forever — Fastify never responds, and
// Cloudflare's edge eventually gives up and returns 502 while the origin is
// still stuck. Bounding both calls guarantees the handler always settles.
const DISCORD_FETCH_TIMEOUT_MS = 10_000;

export type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export type DiscordUser = {
  id: string;
  username: string;
  // Both require the `email` OAuth scope; absent entirely with `identify` alone.
  email?: string;
  verified?: boolean;
};

/** PKCE authorization code exchange — the native client never holds DISCORD_CLIENT_SECRET. */
export async function exchangeDiscordCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(DISCORD_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Discord token exchange failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as DiscordTokenResponse;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(DISCORD_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Discord user fetch failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as DiscordUser;
}
