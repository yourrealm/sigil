import { define } from "@/utils.ts";
import { GITHUB_OAUTH_AUTHORIZE, GITHUB_SCOPES } from "@/lib/github.ts";
import { oauthCreds } from "@/lib/env.ts";
import { buildCookie } from "@/lib/cookies.ts";

/** Only accept site-relative paths. Reject protocol-relative (`//evil`) and
 *  backslash-prefixed (`\evil` → normalized to `/evil` by some browsers). */
function safeReturnPath(raw: string): string | null {
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.startsWith("/\\") || raw.startsWith("\\")) return null;
  return raw;
}

export const handler = define.handlers({
  GET(ctx) {
    const forgeName = ctx.params.forge;
    if (forgeName !== "github") {
      return new Response("Unknown forge", { status: 404 });
    }

    const creds = oauthCreds(forgeName);
    if (!creds) {
      return new Response("OAuth not configured", { status: 500 });
    }

    const reqUrl = new URL(ctx.req.url);
    const requested = reqUrl.searchParams.get("return") ?? "/";
    const returnTo = safeReturnPath(requested);
    if (!returnTo) {
      return new Response("Invalid return URL", { status: 400 });
    }

    const state = randomToken(16);

    const authUrl = new URL(GITHUB_OAUTH_AUTHORIZE);
    authUrl.searchParams.set("client_id", creds.clientId);
    authUrl.searchParams.set("scope", GITHUB_SCOPES.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set(
      "redirect_uri",
      `${reqUrl.origin}/auth/${forgeName}/callback`,
    );

    const cookieOpts = {
      path: "/",
      httpOnly: true,
      secure: reqUrl.protocol === "https:",
      sameSite: "Lax" as const,
      maxAge: 600,
    };
    const headers = new Headers({ Location: authUrl.toString() });
    headers.append(
      "Set-Cookie",
      buildCookie(`oauth_state_${forgeName}`, state, cookieOpts),
    );
    headers.append(
      "Set-Cookie",
      buildCookie(`oauth_return_${forgeName}`, returnTo, cookieOpts),
    );
    return new Response(null, { status: 302, headers });
  },
});

function randomToken(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
