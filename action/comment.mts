import { gh } from "./gh.mts";
import type { Context } from "./gh.mts";
import type { BranchResult } from "./signature.mts";
import type { ContributionResult } from "./contribution.mts";

export const COMMENT_MARKER = "<!-- sigil:gate:v1 -->";

export interface CommentResults {
  cla: BranchResult;
  signature: BranchResult;
  contribution: ContributionResult | BranchResult;
}

interface CommentEntry {
  id: number;
  body: string;
}

export async function upsertStatusComment(
  ctx: Context,
  results: CommentResults,
): Promise<void> {
  const body = renderBody(ctx, results);

  const { data: comments } = await gh<CommentEntry[]>(
    ctx,
    `/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.prNumber}/comments?per_page=100`,
  );

  const existing = comments.find(
    (c) => typeof c.body === "string" && c.body.includes(COMMENT_MARKER),
  );

  if (existing) {
    await gh(
      ctx,
      `/repos/${ctx.owner}/${ctx.repo}/issues/comments/${existing.id}`,
      { method: "PATCH", body: { body } },
    );
  } else {
    await gh(
      ctx,
      `/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.prNumber}/comments`,
      { method: "POST", body: { body } },
    );
  }
}

function renderBody(
  ctx: Context,
  { cla, signature, contribution }: CommentResults,
): string {
  const signingUrl = `${ctx.baseUrl}/cla/github/${ctx.owner}/${ctx.repo}`;
  const allOk = cla.ok && signature.ok && contribution.ok;
  const lines: string[] = [COMMENT_MARKER, ""];

  if (allOk) {
    lines.push(`Thanks @${ctx.prAuthor}! All CLA checks pass.`);
    return lines.join("\n");
  }

  lines.push(`Hey @${ctx.prAuthor}, thanks for opening this.`, "");
  lines.push("Before this can merge, the following needs to be addressed:");
  lines.push("");

  if (!cla.ok) {
    lines.push(`**${cla.summary}.**`);
    if (cla.details) {
      lines.push("");
      lines.push(cla.details);
    }
    lines.push("");
  }

  if (!contribution.ok) {
    const c = contribution as ContributionResult;
    const unlinked = c.unlinked ?? [];
    const unsigned = c.unsigned ?? [];
    const stale = c.stale ?? [];

    if (unlinked.length > 0) {
      lines.push(
        "**Commits with unlinked emails.** These commit authors or committers have an email that isn't linked to any GitHub account, so we can't verify their signature:",
      );
      for (const u of unlinked.slice(0, 10)) {
        lines.push(`- \`${u.sha}\` (${u.role}: ${u.email || "unknown email"})`);
      }
      lines.push("");
      lines.push(
        "Fix by [adding the email](https://github.com/settings/emails) to a GitHub account, then force-push.",
      );
      lines.push("");
    }

    if (unsigned.length > 0) {
      const header = unsigned.length === 1
        ? "**The following author needs to sign the CLA:**"
        : "**The following authors need to sign the CLA:**";
      lines.push(header);
      for (const login of unsigned) {
        lines.push(`- @${login}: [sign here](${signingUrl})`);
      }
      lines.push("");
    }

    if (stale.length > 0) {
      lines.push(
        "**The CLA has changed since these authors last signed. They need to re-sign:**",
      );
      for (const login of stale) {
        lines.push(`- @${login}: [re-sign here](${signingUrl})`);
      }
      lines.push("");
    }
  }

  if (!signature.ok) {
    lines.push(`**Signature issue:** ${signature.summary}.`);
    if (signature.details) {
      lines.push(`> ${signature.details}`);
    }
    lines.push("");
  }

  lines.push(
    "Once signed, rebase this PR onto the latest main and the CLA check will re-run.",
  );
  return lines.join("\n");
}
