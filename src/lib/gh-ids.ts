// Validation for GitHub identifiers that land in URL paths, KV keys, file
// paths, PR bodies, and commit messages. Reject anything that could smuggle
// `..`, newlines, backticks, or markdown/HTML injection into those sinks.
//
// GitHub rules:
//   - Login (user/org): 1–39 chars, alphanumeric or single hyphens, cannot
//     start or end with a hyphen, no consecutive hyphens.
//   - Repo name: up to 100 chars of [A-Za-z0-9._-], but never "." or "..".

import { z } from "zod";

export const GithubLogin = z
  .string()
  .regex(
    /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/,
    "invalid GitHub login",
  );

export const GithubRepoName = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/, "invalid GitHub repo name")
  .refine((s) => s !== "." && s !== "..", "invalid GitHub repo name");

export const RepoTargetParams = z.object({
  owner: GithubLogin,
  repo: GithubRepoName,
  handle: GithubLogin,
});
export type RepoTargetParams = z.infer<typeof RepoTargetParams>;
