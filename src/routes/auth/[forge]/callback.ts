import { define } from "@/utils.ts";
import { GITHUB_API, GITHUB_OAUTH_TOKEN } from "@/lib/github.ts";
import { oauthCreds } from "@/lib/env.ts";
import { buildCookie, clearCookie, parseCookies } from "@/lib/cookies.ts";
import {
  createSession,
  SESSION_TTL_MS,
  sessionCookieName,
} from "@/lib/sessions.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const forgeName = ctx.params.forge;
    if (forgeName !== "github") {
      return new Response("Unknown forge", { status: 404 });
    }

    const creds = oauthCreds(forgeName);
    if (!creds) return new Response("OAuth not configured", { status: 500 });

    const reqUrl = new URL(ctx.req.url);
    const code = reqUrl.searchParams.get("code");
    const returnedState = reqUrl.searchParams.get("state");
    if (!code || !returnedState) {
      return new Response("Missing code or state", { status: 400 });
    }

    const cookies = parseCookies(ctx.req.headers.get("cookie"));
    const storedState = cookies[`oauth_state_${forgeName}`];
    const returnTo = cookies[`oauth_return_${forgeName}`] ?? "/";
    if (!storedState) {
      return new Response("Missing state cookie", { status: 400 });
    }
    if (storedState !== returnedState) {
      return new Response("State mismatch", { status: 400 });
    }

    // Exchange code → access token
    const tokenRes = await fetch(GITHUB_OAUTH_TOKEN, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: `${reqUrl.origin}/auth/${forgeName}/callback`,
      }),
    });
    if (!tokenRes.ok) {
      return new Response(`Token exchange failed: ${tokenRes.status}`, {
        status: 502,
      });
    }
    const tokenData = await tokenRes.json() as {
      access_token?: string;
      error?: string;
    };
    if (!tokenData.access_token) {
      return new Response(`OAuth error: ${tokenData.error ?? "no token"}`, {
        status: 502,
      });
    }

    // Identify the user
    const userRes = await fetch(`${GITHUB_API}/user`, {
      headers: {
        Authorization: `token ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "sigil",
      },
    });
    if (!userRes.ok) {
      return new Response(`User lookup failed: ${userRes.status}`, {
        status: 502,
      });
    }
    const user = await userRes.json() as {
      login?: string;
      name?: string | null;
      avatar_url?: string | null;
    };
    if (!user.login) {
      return new Response("No login in user payload", { status: 502 });
    }

    const sessionId = await createSession({
      token: tokenData.access_token,
      login: user.login.toLowerCase(),
      name: user.name ?? null,
      avatarUrl: user.avatar_url ?? null,
      forge: forgeName,
    });

    // Re-validate the return cookie. The login handler already filtered it,
    // but cookies are attacker-reachable if they can forge a state match - so
    // defense-in-depth at the sink.
    const safeReturn = isSafeReturnPath(returnTo) ? returnTo : "/";

    const headers = new Headers({ Location: safeReturn });
    headers.append(
      "Set-Cookie",
      buildCookie(sessionCookieName(forgeName), sessionId, {
        path: "/",
        httpOnly: true,
        secure: reqUrl.protocol === "https:",
        sameSite: "Lax",
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      }),
    );
    headers.append("Set-Cookie", clearCookie(`oauth_state_${forgeName}`));
    headers.append("Set-Cookie", clearCookie(`oauth_return_${forgeName}`));
    return new Response(null, { status: 302, headers });
  },
});

function isSafeReturnPath(raw: string): boolean {
  if (!raw.startsWith("/")) return false;
  if (raw.startsWith("//")) return false;
  if (raw.startsWith("/\\") || raw.startsWith("\\")) return false;
  return true;
}
