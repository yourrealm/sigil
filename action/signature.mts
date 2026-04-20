import { gh } from "./gh.mts";
import type { Context } from "./gh.mts";
import { Buffer } from "node:buffer";

export interface BranchResult {
  ok: boolean;
  summary: string;
  details?: string;
  /** Only set by the signature axis: "sign" if the file exists at HEAD, "revocation" if deleted. */
  kind?: "sign" | "revocation";
}

export interface Frontmatter {
  [key: string]: string;
}

export interface ParsedDocument {
  frontmatter: Frontmatter | null;
  body: string;
}

export async function validateSignatureChange(
  ctx: Context,
): Promise<BranchResult> {
  const path = `.signatures/cla/${ctx.prAuthor}.md`;
  const sigText = await fetchContent(ctx, path, ctx.headSha);

  if (sigText == null) {
    return { ok: true, summary: "revocation", kind: "revocation" };
  }

  const sig = splitFrontmatter(sigText);
  if (!sig.frontmatter) {
    return { ok: false, summary: "signature file is missing frontmatter" };
  }
  if (!sig.frontmatter.agreement_version) {
    return {
      ok: false,
      summary: "signature frontmatter is missing agreement_version",
    };
  }

  const claText = await fetchContent(ctx, "CLA.md", ctx.headSha);
  if (claText == null) {
    return { ok: false, summary: "CLA.md not found at PR head" };
  }
  const cla = splitFrontmatter(claText);
  if (!cla.frontmatter || !cla.frontmatter.version) {
    return { ok: false, summary: "CLA.md is missing frontmatter or version" };
  }

  const sigVer = normalizeVersion(sig.frontmatter.agreement_version);
  const claVer = normalizeVersion(cla.frontmatter.version);
  if (sigVer !== claVer) {
    return {
      ok: false,
      summary:
        `signature version ${sigVer} does not match current CLA version ${claVer}`,
    };
  }

  const sigBody = normalizeNewlines(sig.body);
  const claBody = normalizeNewlines(cla.body);
  if (sigBody !== claBody) {
    return {
      ok: false,
      summary: "signature body does not match current CLA.md verbatim",
    };
  }

  return { ok: true, summary: `signed against CLA ${claVer}`, kind: "sign" };
}

export function splitFrontmatter(text: string): ParsedDocument {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: null, body: text };
  }
  const fm: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[m[1]] = value;
  }
  return { frontmatter: fm, body: match[2] };
}

export function normalizeVersion(v: unknown): string {
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return `${s}.0`;
  return s;
}

export function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

export async function fetchContent(
  ctx: Context,
  path: string,
  ref: string,
): Promise<string | null> {
  const { status, data } = await gh<
    { content: string; encoding: string } | null
  >(
    ctx,
    `/repos/${ctx.owner}/${ctx.repo}/contents/${path}?ref=${ref}`,
    { allow404: true },
  );
  if (status === 404 || !data) return null;
  if (data.encoding !== "base64") {
    throw new Error(`unexpected encoding for ${path}: ${data.encoding}`);
  }
  return Buffer.from(data.content, "base64").toString("utf8");
}
