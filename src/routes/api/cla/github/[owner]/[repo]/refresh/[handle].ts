import { define } from "@/utils.ts";
import { parseCookies } from "@/lib/cookies.ts";
import { getSession, sessionCookieName } from "@/lib/sessions.ts";
import { isWorking } from "@/lib/agreement.ts";
import { RepoTargetParams } from "@/lib/gh-ids.ts";
import { agreementKey, readRow, writeRow } from "@/lib/agreement-kv.ts";
import { checkStatus } from "@/lib/agreement-flows.ts";

// Re-derive from GitHub on demand. No-op while a flow is mid-write - a
// working row is the source of truth for that window.
export const handler = define.handlers({
  async POST(ctx) {
    const p = RepoTargetParams.safeParse(ctx.params);
    if (!p.success) {
      return new Response("Invalid params", { status: 400 });
    }
    const { owner, repo, handle } = p.data;

    const cookies = parseCookies(ctx.req.headers.get("cookie"));
    const sid = cookies[sessionCookieName("github")];
    const session = sid ? await getSession(sid) : null;
    if (!session || session.login !== handle.toLowerCase()) {
      return new Response("Unauthorized", { status: 401 });
    }

    const key = agreementKey(owner, repo, handle);
    const current = await readRow(key);
    if (isWorking(current)) {
      return new Response(null, { status: 200 });
    }

    await writeRow(key, { kind: "loading" });
    void checkStatus({ owner, repo, handle, token: session.token });
    return new Response(null, { status: 200 });
  },
});
