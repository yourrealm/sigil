import { gh } from "./gh.mts";
import type { Context, MergeMethod } from "./gh.mts";

const GRAPHQL_URL = "https://api.github.com/graphql";

export async function enableAutoMerge(
  ctx: Context,
  prNodeId: string,
  method: MergeMethod,
): Promise<void> {
  const query = `mutation($pr: ID!, $m: PullRequestMergeMethod!) {
    enablePullRequestAutoMerge(input: { pullRequestId: $pr, mergeMethod: $m }) {
      pullRequest { id }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${ctx.token}`,
      "content-type": "application/json",
      "user-agent": "sigil-action",
    },
    body: JSON.stringify({ query, variables: { pr: prNodeId, m: method } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`enableAutoMerge HTTP ${res.status}: ${text}`);
  }
  const body = await res.json() as { errors?: Array<{ message: string }> };
  if (body.errors && body.errors.length > 0) {
    throw new Error(
      `enableAutoMerge GraphQL: ${
        body.errors.map((e) => e.message).join("; ")
      }`,
    );
  }
}

interface CommitEntry {
  commit: {
    committer: { date: string } | null;
    author: { date: string } | null;
  };
}

export async function lastCommitDateForPath(
  ctx: Context,
  path: string,
): Promise<Date | null> {
  const query = new URLSearchParams({
    path,
    sha: ctx.baseSha,
    per_page: "1",
  }).toString();

  const { data } = await gh<CommitEntry[]>(
    ctx,
    `/repos/${ctx.owner}/${ctx.repo}/commits?${query}`,
    { allow404: true },
  );
  if (!Array.isArray(data) || data.length === 0) return null;

  const dateStr = data[0].commit.committer?.date ?? data[0].commit.author?.date;
  return dateStr ? new Date(dateStr) : null;
}
