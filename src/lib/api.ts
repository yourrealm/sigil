// Browser-side fetchers targeting the `/api/{forge}/...` proxy. The proxy
// attaches the session token server-side when a session cookie is present,
// so callers never see or pass the access token.

import { extract } from "@std/front-matter/yaml";

const SIGN_BRANCH = "sigil/sign";

export interface SignatureRecord {
  agreementVersion: string;
  body: string;
}

export interface OpenSignaturePr {
  number: number;
  htmlUrl: string;
  mergeable: boolean | null;
  mergeableState: string;
  reviewDecision: string | null;
}

function proxyUrl(forge: string, path: string): string {
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `/api/${encodeURIComponent(forge)}/${trimmed}`;
}

export async function fetchSignature(
  forge: string,
  owner: string,
  repo: string,
  handle: string,
): Promise<SignatureRecord | null> {
  const path = `.cla-signatures/${handle}.md`;
  const url = proxyUrl(
    forge,
    `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${
      encodeURI(path)
    }`,
  );
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github.raw+json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`signature fetch failed: ${res.status}`);
  }
  const text = await res.text();
  const fm = extract(text);
  const raw = (fm.attrs as Record<string, unknown>).agreement_version;
  const agreementVersion = typeof raw === "number"
    ? (Number.isInteger(raw) ? `${raw}.0` : String(raw))
    : String(raw ?? "");
  return { agreementVersion, body: fm.body };
}

export async function findOpenSignaturePr(
  forge: string,
  owner: string,
  repo: string,
  handle: string,
): Promise<OpenSignaturePr | null> {
  const listUrl = proxyUrl(
    forge,
    `repos/${encodeURIComponent(owner)}/${
      encodeURIComponent(repo)
    }/pulls?state=open&head=${encodeURIComponent(`${handle}:${SIGN_BRANCH}`)}`,
  );
  const listRes = await fetch(listUrl, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!listRes.ok) {
    throw new Error(`pulls list failed: ${listRes.status}`);
  }
  const list = await listRes.json() as Array<{ number: number }>;
  if (!Array.isArray(list) || list.length === 0) return null;
  const { number } = list[0];

  const prUrl = proxyUrl(
    forge,
    `repos/${encodeURIComponent(owner)}/${
      encodeURIComponent(repo)
    }/pulls/${number}`,
  );
  const prRes = await fetch(prUrl, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!prRes.ok) throw new Error(`pull fetch failed: ${prRes.status}`);
  const pr = await prRes.json() as {
    number: number;
    html_url: string;
    mergeable: boolean | null;
    mergeable_state: string;
  };
  return {
    number: pr.number,
    htmlUrl: pr.html_url,
    mergeable: pr.mergeable,
    mergeableState: pr.mergeable_state,
    reviewDecision: null,
  };
}
