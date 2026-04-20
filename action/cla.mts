import type { Context } from "./gh.mts";
import type { BranchResult } from "./signature.mts";
import {
  fetchContent,
  normalizeNewlines,
  normalizeVersion,
  splitFrontmatter,
} from "./signature.mts";

export async function validateCLAIntegrity(
  ctx: Context,
): Promise<BranchResult> {
  const baseText = await fetchContent(ctx, "CLA.md", ctx.baseSha);
  const headText = await fetchContent(ctx, "CLA.md", ctx.headSha);

  if (baseText == null && headText != null) {
    return { ok: true, summary: "CLA.md added" };
  }
  if (baseText != null && headText == null) {
    return {
      ok: false,
      summary: "CLA.md is being removed",
      details: "Removing CLA.md would orphan every existing signature.",
    };
  }
  if (baseText == null && headText == null) {
    return { ok: true, summary: "no CLA.md changes" };
  }

  const base = splitFrontmatter(baseText!);
  const head = splitFrontmatter(headText!);

  const baseBody = normalizeNewlines(base.body);
  const headBody = normalizeNewlines(head.body);
  const bodyChanged = baseBody !== headBody;

  const baseVer = normalizeVersion(base.frontmatter?.version ?? "");
  const headVer = normalizeVersion(head.frontmatter?.version ?? "");
  const versionChanged = baseVer !== headVer;

  if (bodyChanged && !versionChanged) {
    return {
      ok: false,
      summary: `CLA.md body changed without a version bump (still ${headVer})`,
      details:
        "Bump the `version` field in CLA.md's frontmatter, or revert the body change. Leaving the version unchanged would invisibly invalidate every existing signature.",
    };
  }

  if (bodyChanged && versionChanged) {
    return { ok: true, summary: `CLA version ${baseVer} to ${headVer}` };
  }
  if (versionChanged) {
    return {
      ok: true,
      summary: `CLA version ${baseVer} to ${headVer} (body unchanged)`,
    };
  }
  return {
    ok: true,
    summary: "CLA.md frontmatter changed but body and version are stable",
  };
}
