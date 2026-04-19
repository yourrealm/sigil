import { define } from "../../../utils.ts";
import { getForge } from "../../../lib/forge.ts";
import { clearCookie, parseCookies } from "../../../lib/cookies.ts";
import { deleteSession, sessionCookieName } from "../../../lib/sessions.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const forgeName = ctx.params.forge;
    if (!getForge(forgeName)) {
      return new Response("Unknown forge", { status: 404 });
    }

    const cookies = parseCookies(ctx.req.headers.get("cookie"));
    const id = cookies[sessionCookieName(forgeName)];
    if (id) await deleteSession(id);

    const headers = new Headers({ Location: "/" });
    headers.append("Set-Cookie", clearCookie(sessionCookieName(forgeName)));
    return new Response(null, { status: 302, headers });
  },
});
