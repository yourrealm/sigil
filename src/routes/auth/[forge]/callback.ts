import { define } from "@/utils.ts";
import { getForge, getOAuthCreds } from "@/lib/forge.ts";
import { buildCookie, clearCookie, parseCookies } from "@/lib/cookies.ts";
import {
  createSession,
  SESSION_TTL_MS,
  sessionCookieName,
} from "@/lib/sessions.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const forgeName = ctx.params.forge;
    const forge = getForge(forgeName);
    if (!forge) return new Response("Unknown forge", { status: 404 });

    const creds = getOAuthCreds(forgeName);
    if (!creds) return new Response("OAuth not configured", { status: 500 });

    const reqUrl = new URL(ctx.req.url);
    const code = reqUrl.searchParams.get("code");
    const returnedState = reqUrl.searchParams.get("state");
    if (!code || !returnedState) {
      return new Response("Missing code or state", { status: 400 });
    }

    const cookies = parseCookies(ctx.req.headers.get("cookie"));
    const stateCookie = cookies[`oauth_state_${forgeName}`];
    if (!stateCookie) {
      return new Response("Missing state cookie", { status: 400 });
    }

    const [storedState, returnTo] = splitOnce(stateCookie, "|");
    if (storedState !== returnedState) {
      return new Response("State mismatch", { status: 400 });
    }

    // Exchange code → access token
    const tokenRes = await fetch(forge.oauthToken, {
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
    const userRes = await fetch(`${forge.apiBase}/user`, {
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

    const safeReturn = returnTo && returnTo.startsWith("/") ? returnTo : "/";

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
    return new Response(null, { status: 302, headers });
  },
});

function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}
