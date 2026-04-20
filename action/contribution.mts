import { ghPaginated } from "./gh.mts";
import type { Context } from "./gh.mts";
import {
  fetchContent,
  normalizeNewlines,
  normalizeVersion,
  splitFrontmatter,
} from "./signature.mts";

export interface UnlinkedCommit {
  sha: string;
  email: string | null;
  role: "author" | "committer";
}

export interface ContributionResult {
  ok: boolean;
  summary: string;
  unsigned: string[];
  stale: string[];
  unlinked: UnlinkedCommit[];
  claVersion?: string;
}

interface GHUserLike {
  login: string;
  type?: string;
}

interface CommitEntry {
  sha: string;
  author: GHUserLike | null;
  committer: GHUserLike | null;
  commit: {
    author?: { email?: string };
    committer?: { email?: string };
  };
}

export async function validateContributionAuthors(
  ctx: Context,
): Promise<ContributionResult> {
  const commits = await ghPaginated<CommitEntry>(
    ctx,
    `/repos/${ctx.owner}/${ctx.repo}/pulls/${ctx.prNumber}/commits?per_page=100`,
  );

  const unlinked: UnlinkedCommit[] = [];
  const logins = new Set<string>();

  if (!isBotLogin(ctx.prAuthor)) {
    logins.add(ctx.prAuthor);
  }

  for (const c of commits) {
    if (!c.author) {
      unlinked.push({
        sha: c.sha.slice(0, 7),
        email: c.commit.author?.email ?? null,
        role: "author",
      });
    } else if (!isBot(c.author)) {
      logins.add(c.author.login);
    }

    if (!c.committer) {
      unlinked.push({
        sha: c.sha.slice(0, 7),
        email: c.commit.committer?.email ?? null,
        role: "committer",
      });
    } else if (!isBot(c.committer)) {
      logins.add(c.committer.login);
    }
  }

  if (unlinked.length > 0) {
    return {
      ok: false,
      summary:
        `${unlinked.length} commit(s) have an email not linked to a GitHub account`,
      unlinked,
      unsigned: [],
      stale: [],
    };
  }

  const claText = await fetchContent(ctx, "CLA.md", ctx.headSha);
  if (claText == null) {
    return {
      ok: false,
      summary: "CLA.md not found at PR head",
      unlinked: [],
      unsigned: [],
      stale: [],
    };
  }
  const cla = splitFrontmatter(claText);
  if (!cla.frontmatter || !cla.frontmatter.version) {
    return {
      ok: false,
      summary: "CLA.md is missing frontmatter or version",
      unlinked: [],
      unsigned: [],
      stale: [],
    };
  }
  const claVer = normalizeVersion(cla.frontmatter.version);
  const claBody = normalizeNewlines(cla.body);

  const unsigned: string[] = [];
  const stale: string[] = [];

  for (const login of logins) {
    const sigText = await fetchContent(
      ctx,
      `.signatures/cla/${login}.md`,
      ctx.headSha,
    );
    if (sigText == null) {
      unsigned.push(login);
      continue;
    }
    const sig = splitFrontmatter(sigText);
    const ver = normalizeVersion(sig.frontmatter?.agreement_version ?? "");
    const body = normalizeNewlines(sig.body ?? "");
    if (ver !== claVer || body !== claBody) {
      stale.push(login);
    }
  }

  if (unsigned.length === 0 && stale.length === 0) {
    return {
      ok: true,
      summary: `all ${logins.size} contributor${
        logins.size === 1 ? "" : "s"
      } signed against CLA ${claVer}`,
      unlinked: [],
      unsigned: [],
      stale: [],
      claVersion: claVer,
    };
  }

  const parts: string[] = [];
  if (unsigned.length) parts.push(`${unsigned.length} unsigned`);
  if (stale.length) parts.push(`${stale.length} need to re-sign`);
  return {
    ok: false,
    summary: parts.join(", "),
    unlinked: [],
    unsigned,
    stale,
    claVersion: claVer,
  };
}

function isBot(user: GHUserLike | null): boolean {
  if (!user) return false;
  return user.type === "Bot" || isBotLogin(user.login);
}

function isBotLogin(login: string): boolean {
  return typeof login === "string" && login.endsWith("[bot]");
}
