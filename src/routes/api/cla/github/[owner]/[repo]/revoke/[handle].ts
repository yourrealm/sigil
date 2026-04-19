import { z } from "zod";
import { define } from "@/utils.ts";
import { parseCookies } from "@/lib/cookies.ts";
import { getSession, sessionCookieName } from "@/lib/sessions.ts";
import { getRepoFile } from "@/lib/github.ts";
import { parseCLA } from "@/lib/cla.tsx";
import { isInFlight } from "@/lib/agreement.ts";
import { RepoTargetParams } from "@/lib/gh-ids.ts";
import {
  agreementKey,
  compareAndWriteRow,
  readRowEntry,
} from "@/lib/agreement-kv.ts";
import { createRevokePr } from "@/lib/agreement-flows.ts";

const Body = z.object({ reason: z.string().max(500).default("") });

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

    let reason = "";
    if (ctx.req.headers.get("content-length") !== "0") {
      try {
        const raw = await ctx.req.json();
        const parsed = Body.safeParse(raw);
        if (!parsed.success) {
          return new Response("Invalid body", { status: 400 });
        }
        reason = parsed.data.reason;
      } catch {
        // Empty or non-JSON body - treat as no reason.
      }
    }

    const key = agreementKey(owner, repo, handle);
    const entry = await readRowEntry(key);
    if (isInFlight(entry.row)) {
      return new Response(null, { status: 200 });
    }

    const fetched = await getRepoFile(owner, repo, "CLA.md", session.token);
    if (fetched.status !== "ok") {
      return new Response("CLA.md unavailable", { status: 502 });
    }
    const parsed = parseCLA(fetched.content);
    if (!parsed.ok) {
      return new Response("CLA.md invalid", { status: 502 });
    }

    // Atomic compare-and-write to avoid two concurrent POSTs both spawning a
    // flow. See the matching logic in accept/[handle].ts.
    const won = await compareAndWriteRow(
      key,
      { kind: "revoke", reason, step: "init" },
      entry.versionstamp,
    );
    if (!won) {
      return new Response(null, { status: 200 });
    }
    void createRevokePr(
      { owner, repo, handle, token: session.token },
      parsed.cla,
      reason,
    );
    return new Response(null, { status: 200 });
  },
});
