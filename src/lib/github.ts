import createClient from "openapi-fetch";
import type { paths } from "./github-api.d.ts";

export const SIGIL_CLIENT_ID = "sigil@0.1.0";
export const SIGN_BRANCH_PREFIX = "sign-";
export const GITHUB_API = "https://api.github.com";
export const GITHUB_OAUTH_AUTHORIZE =
  "https://github.com/login/oauth/authorize";
export const GITHUB_OAUTH_TOKEN = "https://github.com/login/oauth/access_token";
export const GITHUB_SCOPES = ["public_repo"] as const;

export type GithubClient = ReturnType<typeof createClient<paths>>;

export function githubClient(token?: string): GithubClient {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "sigil",
  };
  if (token) headers.Authorization = `token ${token}`;
  return createClient<paths>({ baseUrl: GITHUB_API, headers });
}

export type FileFetch =
  | { status: "ok"; content: string }
  | { status: "not_found" }
  | { status: "error"; httpStatus: number; message: string };

/** Raw-contents fetch used for public CLA.md reads. Token is optional. */
export async function getRepoFile(
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<FileFetch> {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${
    encodeURIComponent(repo)
  }/contents/${encodeURI(path)}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw+json",
    "User-Agent": "sigil",
  };
  if (token) headers.Authorization = `token ${token}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return { status: "not_found" };
  if (!res.ok) {
    return {
      status: "error",
      httpStatus: res.status,
      message: `github contents API returned ${res.status}`,
    };
  }
  return { status: "ok", content: await res.text() };
}

/** btoa is UTF-16-naive; go via bytes so non-ASCII CLA bodies encode correctly. */
function base64EncodeUtf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export interface SignatureFileArgs {
  handle: string;
  claName: string;
  version: string;
  claBody: string;
}

/** Build the signature file: attestation in frontmatter, CLA body verbatim
 *  after. The gatekeeper Action checks the attestation wording, that
 *  agreement_version matches `CLA.md`, and that the body equals `CLA.md`. */
export function signatureFileBase64(args: SignatureFileArgs): string {
  const { handle, claName, version, claBody } = args;
  const attestation =
    `I, @${handle}, agree to the following ${claName} Contributor License Agreement, version ${version}.`;
  const fm = [
    "---",
    `agreement_version: ${JSON.stringify(version)}`,
    `attestation: ${JSON.stringify(attestation)}`,
    `client: ${SIGIL_CLIENT_ID}`,
    "---",
    "",
    "",
  ].join("\n");
  return base64EncodeUtf8(fm + claBody.trimEnd() + "\n");
}

/** Each sign attempt gets a unique branch so we never have to reset a stale ref. */
export function generateSignBranchName(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${SIGN_BRANCH_PREFIX}${hex}`;
}
