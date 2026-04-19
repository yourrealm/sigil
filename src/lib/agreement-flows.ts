// Server-only flows that write AgreementRows into KV. Three entry points:
//
//   - checkStatus        → derive current state from GitHub, write to KV.
//   - createAcceptPr     → fork → sync → branch → commit → open PR, writing
//                          step updates to KV as it goes.
//   - createRevokePr     → same chain, but deletes the signature file.
//
// All three return Promise<void>. Callers are expected to `void` them - they
// drive the KV, the client poll drives the UI. On failure, the flow resets
// the row to { kind: "loading" } and schedules a checkStatus so the UI shows
// a brief "checking" flash before landing on the real state.

import { extract } from "@std/front-matter/yaml";
import {
  generateSignBranchName,
  getRepoFile,
  type GithubClient,
  githubClient,
  SIGN_BRANCH_PREFIX,
  signatureFileBase64,
} from "./github.ts";
import { parseCLA } from "./cla.tsx";
import {
  type AgreementRow,
  type ForkInfo,
  type MergedSignatureInfo,
  type OpenSignaturePr,
  signaturePath,
} from "./agreement.ts";
import { agreementKey, writeRow } from "./agreement-kv.ts";

interface Target {
  owner: string;
  repo: string;
  handle: string;
  token: string;
}

interface Cla {
  name: string;
  version: string;
  body: string;
}

// -- checkStatus -----------------------------------------------------------

export async function checkStatus(t: Target): Promise<void> {
  const key = agreementKey(t.owner, t.repo, t.handle);
  try {
    const row = await deriveRow(t);
    await writeRow(key, row);
  } catch (e) {
    console.error("[checkStatus] failed", e);
    // Leave the loading row in place; the TTL watcher will retry.
  }
}

async function deriveRow(t: Target): Promise<AgreementRow> {
  const { owner, repo, handle, token } = t;
  const cla = await getRepoFile(owner, repo, "CLA.md", token);
  if (cla.status !== "ok") return { kind: "unsigned" };
  const parsed = parseCLA(cla.content);
  if (!parsed.ok) return { kind: "unsigned" };
  const currentVersion = parsed.cla.version;

  const client = githubClient(token);
  const [signature, openPr] = await Promise.all([
    fetchSignatureVersion(client, owner, repo, handle),
    findOpenSignaturePr(client, owner, repo, handle),
  ]);

  if (openPr?.kind === "revoke") {
    return { kind: "revoke", reason: "", step: "pending", pr: openPr };
  }
  if (openPr?.kind === "sign") {
    return { kind: "accept", step: "pending", pr: openPr };
  }
  if (!signature) return { kind: "unsigned" };

  const merged = await findMergedSignature(client, owner, repo, handle);
  if (!merged) return { kind: "unsigned" };
  if (signature.agreementVersion === currentVersion) {
    return { kind: "signed", status: "current", merged };
  }
  return {
    kind: "signed",
    status: "mismatch",
    signedVersion: signature.agreementVersion,
    merged,
  };
}

async function fetchSignatureVersion(
  client: GithubClient,
  owner: string,
  repo: string,
  handle: string,
): Promise<{ agreementVersion: string } | null> {
  const path = signaturePath(handle);
  const { data, response } = await client.GET(
    "/repos/{owner}/{repo}/contents/{path}",
    {
      params: { path: { owner, repo, path } },
      headers: { Accept: "application/vnd.github.raw+json" },
      parseAs: "text",
    },
  );
  if (response.status === 404) return null;
  if (data === undefined) {
    throw new Error("signature fetch failed");
  }
  const fm = extract(data);
  const raw = (fm.attrs as Record<string, unknown>).agreement_version;
  const agreementVersion = typeof raw === "number"
    ? (Number.isInteger(raw) ? `${raw}.0` : String(raw))
    : String(raw ?? "");
  return { agreementVersion };
}

async function findOpenSignaturePr(
  client: GithubClient,
  owner: string,
  repo: string,
  handle: string,
): Promise<OpenSignaturePr | null> {
  const list = await client.GET("/repos/{owner}/{repo}/pulls", {
    params: {
      path: { owner, repo },
      query: { state: "open", per_page: 100 },
    },
  });
  if (!list.data) {
    throw new Error("pulls list failed");
  }
  const match = list.data.find((pr) =>
    pr.head?.user?.login === handle &&
    pr.head.ref.startsWith(SIGN_BRANCH_PREFIX)
  );
  if (!match) return null;
  const kind: "sign" | "revoke" = /^chore\(cla\):\s*revoke\b/i.test(match.title)
    ? "revoke"
    : "sign";
  const pr = await client.GET("/repos/{owner}/{repo}/pulls/{pull_number}", {
    params: { path: { owner, repo, pull_number: match.number } },
  });
  if (!pr.data) {
    throw new Error("pull fetch failed");
  }
  return {
    number: pr.data.number,
    htmlUrl: pr.data.html_url,
    mergeable: pr.data.mergeable,
    mergeableState: pr.data.mergeable_state,
    reviewDecision: null,
    kind,
  };
}

async function findMergedSignature(
  client: GithubClient,
  owner: string,
  repo: string,
  handle: string,
): Promise<MergedSignatureInfo | null> {
  const path = signaturePath(handle);
  const commits = await client.GET("/repos/{owner}/{repo}/commits", {
    params: { path: { owner, repo }, query: { path, per_page: 1 } },
  });
  if (!commits.data) {
    throw new Error("commits lookup failed");
  }
  if (!commits.data.length) return null;
  const commit = commits.data[0];

  let prNumber: number | null = null;
  let prHtmlUrl: string | null = null;
  const prs = await client.GET(
    "/repos/{owner}/{repo}/commits/{commit_sha}/pulls",
    { params: { path: { owner, repo, commit_sha: commit.sha } } },
  );
  if (prs.data && prs.data.length) {
    prNumber = prs.data[0].number;
    prHtmlUrl = prs.data[0].html_url;
  }

  return {
    commitSha: commit.sha,
    commitShortSha: commit.sha.slice(0, 8),
    commitUrl: commit.html_url,
    commitDate: commit.commit.committer?.date ?? "",
    verified: commit.commit.verification?.verified ?? false,
    prNumber,
    prHtmlUrl,
    fileUrl: `https://github.com/${owner}/${repo}/blob/${commit.sha}/${
      encodeURI(path)
    }`,
  };
}

// -- createAcceptPr / createRevokePr ---------------------------------------

export function createAcceptPr(t: Target, cla: Cla): Promise<void> {
  return runFlow(t, cla, "accept", "");
}

export function createRevokePr(
  t: Target,
  cla: Cla,
  reason: string,
): Promise<void> {
  return runFlow(t, cla, "revoke", reason);
}

async function runFlow(
  t: Target,
  cla: Cla,
  kind: "accept" | "revoke",
  reason: string,
): Promise<void> {
  const { owner, repo, handle, token } = t;
  const key = agreementKey(owner, repo, handle);
  const client = githubClient(token);
  const base = kind === "accept"
    ? ({ kind: "accept" } as const)
    : ({ kind: "revoke", reason } as const);

  try {
    // 1. Fork upstream (idempotent).
    const forkRes = await client.POST("/repos/{owner}/{repo}/forks", {
      params: { path: { owner, repo } },
      body: {},
    });
    if (!forkRes.data) {
      throw new Error("fork failed");
    }
    const fork: ForkInfo = {
      ownerLogin: forkRes.data.owner.login,
      repoName: forkRes.data.name,
      defaultBranch: forkRes.data.default_branch,
    };
    const branch = generateSignBranchName();

    await writeRow(
      key,
      { ...base, step: "syncing", branch, fork } as AgreementRow,
    );

    // 2. Wait for fork refs to materialize.
    const forkReady = await waitForForkReady(client, fork);
    if (!forkReady) {
      throw new Error("fork never became ready");
    }

    // 3. Fast-forward the fork's default branch.
    const syncRes = await client.POST(
      "/repos/{owner}/{repo}/merge-upstream",
      {
        params: { path: { owner: fork.ownerLogin, repo: fork.repoName } },
        body: { branch: fork.defaultBranch },
      },
    );
    if (!syncRes.data) {
      throw new Error("fork sync failed");
    }

    // 4. Learn upstream HEAD.
    const headRes = await client.GET(
      "/repos/{owner}/{repo}/branches/{branch}",
      { params: { path: { owner, repo, branch: fork.defaultBranch } } },
    );
    if (!headRes.data) {
      throw new Error("branch head lookup failed");
    }
    const upstreamSha = headRes.data.commit.sha;

    // 5. Create the signing branch on the fork.
    await writeRow(
      key,
      { ...base, step: "branching", branch, fork } as AgreementRow,
    );
    const branchRes = await client.POST(
      "/repos/{owner}/{repo}/git/refs",
      {
        params: { path: { owner: fork.ownerLogin, repo: fork.repoName } },
        body: { ref: `refs/heads/${branch}`, sha: upstreamSha },
      },
    );
    if (!branchRes.data) {
      throw new Error("branch create failed");
    }

    // 6. Write (accept) or delete (revoke) the signature file on the branch.
    await writeRow(
      key,
      { ...base, step: "writing", branch, fork } as AgreementRow,
    );
    const path = signaturePath(handle);
    if (kind === "accept") {
      const commitRes = await client.PUT(
        "/repos/{owner}/{repo}/contents/{path}",
        {
          params: {
            path: { owner: fork.ownerLogin, repo: fork.repoName, path },
          },
          body: {
            message:
              `chore(cla): sign ${cla.name} v${cla.version} as @${handle}`,
            content: signatureFileBase64({
              handle,
              claName: cla.name,
              version: cla.version,
              claBody: cla.body,
            }),
            branch,
          },
        },
      );
      if (!commitRes.data) {
        throw new Error("commit failed");
      }
    } else {
      const pathParams = {
        owner: fork.ownerLogin,
        repo: fork.repoName,
        path,
      } as const;
      const get = await client.GET("/repos/{owner}/{repo}/contents/{path}", {
        params: { path: pathParams, query: { ref: branch } },
      });
      if (!get.data) {
        throw new Error("signature lookup failed");
      }
      if (Array.isArray(get.data) || get.data.type !== "file") {
        throw new Error("signature lookup returned non-file");
      }
      const blobSha = get.data.sha;
      const del = await client.DELETE(
        "/repos/{owner}/{repo}/contents/{path}",
        {
          params: { path: pathParams },
          body: {
            message:
              `chore(cla): revoke ${cla.name} v${cla.version} as @${handle}`,
            sha: blobSha,
            branch,
          },
        },
      );
      if (!del.data) {
        throw new Error("delete failed");
      }
    }

    // 7. Open the PR back to upstream.
    await writeRow(
      key,
      { ...base, step: "opening_pr", branch, fork } as AgreementRow,
    );
    const title = kind === "accept"
      ? `chore(cla): sign ${cla.name} v${cla.version} as @${handle}`
      : `chore(cla): revoke ${cla.name} CLA v${cla.version} as @${handle}`;
    const reasonBlock = kind === "revoke" && reason.trim()
      ? `\n\n**Reason**\n\n> ${reason.trim().replace(/\n/g, "\n> ")}\n`
      : "";
    const body = kind === "accept"
      ? `Signing **${cla.name} CLA v${cla.version}** as @${handle}.\n\n` +
        `Opened via [withsigil.eu](https://withsigil.eu).`
      : `Withdrawing signature of **${cla.name} CLA v${cla.version}** as @${handle}.` +
        reasonBlock +
        `\n\nPast contributions remain licensed under the version previously signed - that grant is perpetual. Opened via [withsigil.eu](https://withsigil.eu).`;
    const prRes = await client.POST("/repos/{owner}/{repo}/pulls", {
      params: { path: { owner, repo } },
      body: {
        title,
        head: `${fork.ownerLogin}:${branch}`,
        base: fork.defaultBranch,
        body,
        maintainer_can_modify: true,
      },
    });
    if (!prRes.data) {
      throw new Error("pull request failed");
    }

    await writeRow(key, {
      ...base,
      step: "pending",
      pr: {
        number: prRes.data.number,
        htmlUrl: prRes.data.html_url,
        mergeable: null,
        mergeableState: "unknown",
        reviewDecision: null,
        kind: kind === "accept" ? "sign" : "revoke",
      },
    } as AgreementRow);
  } catch (e) {
    console.error(`[${kind} flow] failed`, e);
    await writeRow(key, { kind: "loading" });
    void checkStatus(t);
  }
}

async function waitForForkReady(
  client: GithubClient,
  fork: ForkInfo,
): Promise<string | null> {
  for (let i = 0; i < 40; i++) {
    const { data, response } = await client.GET(
      "/repos/{owner}/{repo}/branches/{branch}",
      {
        params: {
          path: {
            owner: fork.ownerLogin,
            repo: fork.repoName,
            branch: fork.defaultBranch,
          },
        },
      },
    );
    if (data) return data.commit.sha;
    if (response.status !== 404 && response.status !== 409) {
      throw new Error("fork readiness check failed");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}
