import { define } from "@/utils.ts";
import { parseCookies } from "@/lib/cookies.ts";
import { getSession, sessionCookieName } from "@/lib/sessions.ts";
import type { AgreementRow } from "@/lib/agreement.ts";
import { RepoTargetParams } from "@/lib/gh-ids.ts";
import { agreementKey, readRow, writeRow } from "@/lib/agreement-kv.ts";
import { checkStatus } from "@/lib/agreement-flows.ts";

// Poll endpoint. Client hits this every 1s via tanstack-query. Returns the
// current KV row; if absent, writes `loading`, kicks off a background derive,
// and returns `loading` so the client sees a "checking" card on the next tick.
export const handler = define.handlers({
  async GET(ctx) {
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
    if (current) {
      return Response.json(current satisfies AgreementRow);
    }

    const loading: AgreementRow = { kind: "loading" };
    await writeRow(key, loading);
    void checkStatus({ owner, repo, handle, token: session.token });
    return Response.json(loading);
  },
});
