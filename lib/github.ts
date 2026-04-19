import { getForge } from "./forge.ts";

export type FileFetch =
  | { status: "ok"; content: string }
  | { status: "not_found" }
  | { status: "error"; httpStatus: number; message: string };

export async function getRepoFile(
  forge: string,
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<FileFetch> {
  const f = getForge(forge);
  if (!f) return { status: "error", httpStatus: 400, message: "Unknown forge" };

  const url = `${f.apiBase}/repos/${encodeURIComponent(owner)}/${
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
      message: `${forge} contents API returned ${res.status}`,
    };
  }
  const content = await res.text();
  return { status: "ok", content };
}
