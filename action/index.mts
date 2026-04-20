import { gh, loadContext } from "./gh.mts";
import type { Context } from "./gh.mts";
import { validateSignatureChange } from "./signature.mts";
import type { BranchResult } from "./signature.mts";
import { validateContributionAuthors } from "./contribution.mts";
import type { ContributionResult } from "./contribution.mts";
import { validateCLAIntegrity } from "./cla.mts";
import { upsertStatusComment } from "./comment.mts";
import process from "node:process";

const SIGNATURE_PREFIX = ".signatures/cla/";

export interface PRFile {
  filename: string;
}

export interface DispatchResults {
  cla: BranchResult;
  signature: BranchResult;
  contribution: ContributionResult | BranchResult;
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

  return { cla, signature, contribution };
}

async function main(): Promise<void> {
  const ctx = loadContext();

  const { data: files } = await gh<PRFile[]>(
    ctx,
    `/repos/${ctx.owner}/${ctx.repo}/pulls/${ctx.prNumber}/files?per_page=100`,
  );

  const results = await dispatch(ctx, files);

  await upsertStatusComment(ctx, results);

  if (!results.cla.ok || !results.signature.ok || !results.contribution.ok) {
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

function fail(message: string): void {
  console.log(`::error::${message}`);
  process.exitCode = 1;
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    fail(err instanceof Error ? err.message : String(err));
  });
}
