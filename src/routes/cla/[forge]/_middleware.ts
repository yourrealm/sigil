import { define } from "@/utils.ts";
import { parseCookies } from "@/lib/cookies.ts";
import {
  getSession,
  sessionCookieName,
  sessionToAuth,
} from "@/lib/sessions.ts";

export const handler = define.middleware(async (ctx) => {
  ctx.state.auth = null;
  ctx.state.token = null;
  const { forge } = ctx.params;
  const cookies = parseCookies(ctx.req.headers.get("cookie"));
  const sid = cookies[sessionCookieName(forge)];
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      ctx.state.auth = sessionToAuth(session);
      ctx.state.token = session.token;
    }
  }
  return ctx.next();
});
