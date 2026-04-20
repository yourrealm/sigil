import { readFileSync } from "node:fs";
import process from "node:process";

const API = "https://api.github.com";

export type MergeMethod = "MERGE" | "SQUASH" | "REBASE";

export interface Context {
  token: string;
  baseUrl: string;
  owner: string;
  repo: string;
  prNumber: number;
  prNodeId: string;
  baseSha: string;
  headSha: string;
  prAuthor: string;
  autoMerge: boolean;
  autoMergeMethod: MergeMethod;
  signCooldownDays: number;
}

export interface GHOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  allow404?: boolean;
}

export interface GHResponse<T = unknown> {
  status: number;
  data: T;
}

export function loadContext(): Context {
  const token = process.env.INPUT_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set");
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is not set");
  }
  const event = JSON.parse(readFileSync(eventPath, "utf8"));

  const pr = event.pull_request;
  if (!pr) {
    throw new Error("this action must run on a pull_request event");
  }

  const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY is not set");
  }

  const baseUrl = (process.env.INPUT_BASE_URL || "https://withsigil.eu")
    .replace(/\/+$/, "");

  const autoMerge = (process.env.INPUT_AUTO_MERGE || "false").toLowerCase() ===
    "true";
  const methodRaw = (process.env.INPUT_AUTO_MERGE_METHOD || "REBASE")
    .toUpperCase();
  const autoMergeMethod: MergeMethod =
    methodRaw === "SQUASH" || methodRaw === "MERGE" || methodRaw === "REBASE"
      ? methodRaw
      : "REBASE";
  const cooldownRaw = parseInt(
    process.env.INPUT_SIGN_COOLDOWN_DAYS || "30",
    10,
  );
  const signCooldownDays = Number.isFinite(cooldownRaw) && cooldownRaw >= 0
    ? cooldownRaw
    : 30;

  return {
    token,
    baseUrl,
    owner,
    repo,
    prNumber: pr.number,
    prNodeId: pr.node_id,
    baseSha: pr.base.sha,
    headSha: pr.head.sha,
    prAuthor: pr.user.login,
    autoMerge,
    autoMergeMethod,
    signCooldownDays,
  };
}

export async function gh<T = unknown>(
  ctx: Context,
  path: string,
  opts: GHOptions = {},
): Promise<GHResponse<T>> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      authorization: `Bearer ${ctx.token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "sigil-action",
      ...(opts.body ? { "content-type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (opts.allow404 && res.status === 404) {
    return { status: 404, data: null as T };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `GitHub API ${res.status} on ${opts.method || "GET"} ${path}: ${text}`,
    );
  }
  return { status: res.status, data: (await res.json()) as T };
}

export async function ghPaginated<T>(ctx: Context, path: string): Promise<T[]> {
  const all: T[] = [];
  let nextUrl: string | null = path.startsWith("http") ? path : `${API}${path}`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: {
        authorization: `Bearer ${ctx.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "sigil-action",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status} on GET ${nextUrl}: ${text}`);
    }
    const page = (await res.json()) as T[];
    all.push(...page);
    nextUrl = parseNextLink(res.headers.get("link"));
  }

  return all;
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}
