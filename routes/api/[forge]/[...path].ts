import { define } from "../../../utils.ts";
import { getForge } from "../../../lib/forge.ts";
import { parseCookies } from "../../../lib/cookies.ts";
import { getSession, sessionCookieName } from "../../../lib/sessions.ts";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "cookie",
  "authorization",
]);

async function proxy(ctx: { req: Request; params: Record<string, string> }) {
  const forgeName = ctx.params.forge;
  const forge = getForge(forgeName);
  if (!forge) return new Response("Unknown forge", { status: 404 });

  const path = ctx.params.path ?? "";
  if (path.includes("..")) {
    return new Response("Invalid path", { status: 400 });
  }

  const reqUrl = new URL(ctx.req.url);
  const target = new URL(`${forge.apiBase}/${path}${reqUrl.search}`);

  const cookies = parseCookies(ctx.req.headers.get("cookie"));
  const sid = cookies[sessionCookieName(forgeName)];
  const session = sid ? await getSession(sid) : null;

  const outHeaders = new Headers();
  for (const [k, v] of ctx.req.headers) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) outHeaders.set(k, v);
  }
  outHeaders.set(
    "Accept",
    outHeaders.get("Accept") ?? "application/vnd.github+json",
  );
  outHeaders.set("User-Agent", "sigil");
  if (session) outHeaders.set("Authorization", `token ${session.token}`);

  const hasBody = ctx.req.method !== "GET" && ctx.req.method !== "HEAD";
  const upstream = await fetch(target, {
    method: ctx.req.method,
    headers: outHeaders,
    body: hasBody ? ctx.req.body : null,
    redirect: "manual",
  });

  const resHeaders = new Headers();
  for (const [k, v] of upstream.headers) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) resHeaders.set(k, v);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export const handler = define.handlers({
  GET: proxy,
  POST: proxy,
  PUT: proxy,
  PATCH: proxy,
  DELETE: proxy,
});
