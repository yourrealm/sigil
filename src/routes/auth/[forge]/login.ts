import { define } from "@/utils.ts";
import { getForge, getOAuthCreds } from "@/lib/forge.ts";
import { buildCookie } from "@/lib/cookies.ts";

export const handler = define.handlers({
  GET(ctx) {
    const forgeName = ctx.params.forge;
    const forge = getForge(forgeName);
    if (!forge) return new Response("Unknown forge", { status: 404 });

    const creds = getOAuthCreds(forgeName);
    if (!creds) {
      return new Response(
        `OAuth not configured for ${forgeName}. Set ${forgeName.toUpperCase()}_CLIENT_ID and ${forgeName.toUpperCase()}_CLIENT_SECRET.`,
        { status: 500 },
      );
    }

    const reqUrl = new URL(ctx.req.url);
    const returnTo = reqUrl.searchParams.get("return") ?? "/";
    if (!returnTo.startsWith("/")) {
      return new Response("Invalid return URL", { status: 400 });
    }

    const state = randomToken(16);

    const authUrl = new URL(forge.oauthAuthorize);
    authUrl.searchParams.set("client_id", creds.clientId);
    authUrl.searchParams.set("scope", forge.scopes.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set(
      "redirect_uri",
      `${reqUrl.origin}/auth/${forgeName}/callback`,
    );

    const headers = new Headers({ Location: authUrl.toString() });
    headers.append(
      "Set-Cookie",
      buildCookie(`oauth_state_${forgeName}`, `${state}|${returnTo}`, {
        path: "/",
        httpOnly: true,
        secure: reqUrl.protocol === "https:",
        sameSite: "Lax",
        maxAge: 600,
      }),
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
