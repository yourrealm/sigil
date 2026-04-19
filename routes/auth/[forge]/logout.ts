import { define } from "@/utils.ts";
import { getForge } from "@/lib/forge.ts";
import { clearCookie, parseCookies } from "@/lib/cookies.ts";
import { deleteSession, sessionCookieName } from "@/lib/sessions.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const forgeName = ctx.params.forge;
    if (!getForge(forgeName)) {
      return new Response("Unknown forge", { status: 404 });
    }

    const cookies = parseCookies(ctx.req.headers.get("cookie"));
    const id = cookies[sessionCookieName(forgeName)];
    if (id) await deleteSession(id);

    const reqUrl = new URL(ctx.req.url);
    const referer = ctx.req.headers.get("referer");
    let location = "/";
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.origin === reqUrl.origin) {
          location = refUrl.pathname + refUrl.search;
        }
      } catch {
        // Malformed Referer - fall back to "/".
      }
    }

    const headers = new Headers({ Location: location });
    headers.append("Set-Cookie", clearCookie(sessionCookieName(forgeName)));
    return new Response(null, { status: 302, headers });
  },
});
