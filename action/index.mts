import { gh, loadContext } from "./gh.mts";
import type { Context } from "./gh.mts";
import { validateSignatureChange } from "./signature.mts";
import type { BranchResult } from "./signature.mts";
import { validateContributionAuthors } from "./contribution.mts";
import type { ContributionResult } from "./contribution.mts";
import { validateCLAIntegrity } from "./cla.mts";
import { upsertStatusComment } from "./comment.mts";
import { enableAutoMerge, lastCommitDateForPath } from "./auto-merge.mts";
import process from "node:process";
import { writeSync } from "node:fs";

const SIGNATURE_PREFIX = ".signatures/cla/";

export interface PRFile {
  filename: string;
}

export type AutoMergeEligible = "none" | "revocation" | "sign";

export interface DispatchResults {
  cla: BranchResult;
  signature: BranchResult;
  contribution: ContributionResult | BranchResult;
  autoMergeEligible: AutoMergeEligible;
}

export async function dispatch(
  ctx: Context,
  files: PRFile[],
): Promise<DispatchResults> {
  const prAuthorLower = ctx.prAuthor.toLowerCase();
  let hasOwnSignatureChange = false;
  let hasNonSignatureFiles = false;
  let hasCLAChange = false;

  for (const f of files) {
    if (!f.filename.startsWith(SIGNATURE_PREFIX)) {
      hasNonSignatureFiles = true;
      if (f.filename === "CLA.md") hasCLAChange = true;
      continue;
    }
    const rest = f.filename.slice(SIGNATURE_PREFIX.length);
    const stem = rest.endsWith(".md") ? rest.slice(0, -3) : rest;
    if (stem.toLowerCase() === prAuthorLower) {
      hasOwnSignatureChange = true;
    } else {
      return {
        cla: { ok: true, summary: "skipped" },
        signature: {
          ok: false,
          summary: "PR modifies another contributor's signature file",
          details: f.filename,
        },
        contribution: { ok: true, summary: "skipped" },
        autoMergeEligible: "none",
      };
    }
  }

  const cla: BranchResult = !hasCLAChange
    ? { ok: true, summary: "no CLA.md changes" }
    : await validateCLAIntegrity(ctx);

  const signature: BranchResult = !hasOwnSignatureChange
    ? { ok: true, summary: "no signature changes" }
    : await validateSignatureChange(ctx);

  const contribution: ContributionResult | BranchResult = !hasNonSignatureFiles
    ? { ok: true, summary: "no code changes" }
    : await validateContributionAuthors(ctx);

  // Only signature-only PRs are eligible for auto-merge.
  const signatureOnly = hasOwnSignatureChange && !hasNonSignatureFiles;
  const autoMergeEligible: AutoMergeEligible = signatureOnly
    ? (signature.kind === "revocation" ? "revocation" : "sign")
    : "none";

  return { cla, signature, contribution, autoMergeEligible };
}

async function main(): Promise<void> {
  const ctx = loadContext();

  const { data: files } = await gh<PRFile[]>(
    ctx,
    `/repos/${ctx.owner}/${ctx.repo}/pulls/${ctx.prNumber}/files?per_page=100`,
  );

  const results = await dispatch(ctx, files);

  await upsertStatusComment(ctx, results);

  const allOk = results.cla.ok && results.signature.ok &&
    results.contribution.ok;

  if (ctx.autoMerge && allOk && results.autoMergeEligible !== "none") {
    await maybeAutoMerge(ctx, results.autoMergeEligible);
  } else if (ctx.autoMerge) {
    notice(
      `auto-merge skipped: allOk=${allOk} eligibility=${results.autoMergeEligible}`,
    );
  }

  if (!allOk) {
    const parts: string[] = [];
    if (!results.cla.ok) parts.push(`cla: ${results.cla.summary}`);
    if (!results.signature.ok) {
      parts.push(`signature: ${results.signature.summary}`);
    }
    if (!results.contribution.ok) {
      parts.push(`contribution: ${results.contribution.summary}`);
    }
    fail(parts.join("; "));
  }
}

async function maybeAutoMerge(
  ctx: Context,
  eligibility: Exclude<AutoMergeEligible, "none">,
): Promise<void> {
  try {
    if (eligibility === "sign") {
      const sigPath = `.signatures/cla/${ctx.prAuthor}.md`;
      const lastTouched = await lastCommitDateForPath(ctx, sigPath);
      if (lastTouched) {
        const ageDays = (Date.now() - lastTouched.getTime()) /
          (1000 * 60 * 60 * 24);
        if (ageDays < ctx.signCooldownDays) {
          warn(
            `auto-merge paused: last sign was ${
              ageDays.toFixed(1)
            } days ago (cooldown is ${ctx.signCooldownDays} days)`,
          );
          return;
        }
      }
    }
    await enableAutoMerge(ctx, ctx.prNodeId, ctx.autoMergeMethod);
    notice(`auto-merge enabled (${eligibility}, ${ctx.autoMergeMethod})`);
  } catch (err) {
    warn(
      `auto-merge request failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

// Write synchronously to stdout so workflow commands are not lost when
// the process exits before an async console.log flushes through the pipe.
function fail(message: string): void {
  writeSync(1, `::error::${message}\n`);
  process.exitCode = 1;
}

function warn(message: string): void {
  writeSync(1, `::warning::${message}\n`);
}

function notice(message: string): void {
  writeSync(1, `::notice::${message}\n`);
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    fail(err instanceof Error ? err.message : String(err));
  });
}
