// Client-safe: schema + types only. No Deno APIs. Both the browser bundle and
// the server-side KV helpers (`./agreement-kv.ts`) import from here.

import { z } from "zod";

/** The canonical path for a contributor's signature file inside the target
 *  repo. Centralised so UI copy, commit-time writes, and lookup reads all
 *  agree on the shape. */
export function signaturePath(handle: string): string {
  return `.signatures/cla/${handle}.md`;
}

export const ForkInfoSchema = z.object({
  ownerLogin: z.string(),
  repoName: z.string(),
  defaultBranch: z.string(),
});
export type ForkInfo = z.infer<typeof ForkInfoSchema>;

export const OpenSignaturePrSchema = z.object({
  number: z.number(),
  htmlUrl: z.string(),
  mergeable: z.boolean().nullable(),
  mergeableState: z.string(),
  reviewDecision: z.string().nullable(),
  kind: z.enum(["sign", "revoke"]),
});
export type OpenSignaturePr = z.infer<typeof OpenSignaturePrSchema>;

export const MergedSignatureInfoSchema = z.object({
  commitSha: z.string(),
  commitShortSha: z.string(),
  commitUrl: z.string(),
  commitDate: z.string(),
  verified: z.boolean(),
  prNumber: z.number().nullable(),
  prHtmlUrl: z.string().nullable(),
  fileUrl: z.string(),
});
export type MergedSignatureInfo = z.infer<typeof MergedSignatureInfoSchema>;

// Steps the server moves through during a flow.
//   init       → row written synchronously by the POST handler; no fork yet.
//   syncing    → fork exists, waiting for refs + fast-forwarding default branch.
//   branching  → creating the sign branch on the fork.
//   writing    → committing (accept) or deleting (revoke) the signature file.
//   opening_pr → opening the PR back to upstream.
//   pending    → PR is open, server idle until a maintainer acts.
const ACTIVE_STEP = z.enum(["syncing", "branching", "writing", "opening_pr"]);
export type ActiveStep = z.infer<typeof ACTIVE_STEP>;

export const AgreementRow = z.union([
  z.object({ kind: z.literal("loading") }),
  z.object({ kind: z.literal("unsigned") }),
  z.object({
    kind: z.literal("signed"),
    status: z.literal("current"),
    merged: MergedSignatureInfoSchema,
  }),
  z.object({
    kind: z.literal("signed"),
    status: z.literal("mismatch"),
    signedVersion: z.string(),
    merged: MergedSignatureInfoSchema,
  }),
  z.object({ kind: z.literal("accept"), step: z.literal("init") }),
  z.object({
    kind: z.literal("accept"),
    step: ACTIVE_STEP,
    branch: z.string(),
    fork: ForkInfoSchema,
  }),
  z.object({
    kind: z.literal("accept"),
    step: z.literal("pending"),
    pr: OpenSignaturePrSchema,
  }),
  z.object({
    kind: z.literal("revoke"),
    reason: z.string(),
    step: z.literal("init"),
  }),
  z.object({
    kind: z.literal("revoke"),
    reason: z.string(),
    step: ACTIVE_STEP,
    branch: z.string(),
    fork: ForkInfoSchema,
  }),
  z.object({
    kind: z.literal("revoke"),
    reason: z.string(),
    step: z.literal("pending"),
    pr: OpenSignaturePrSchema,
  }),
]);

export type AgreementRow = z.infer<typeof AgreementRow>;

/** Any active accept/revoke row - working *or* pending. Used to make POST
 *  accept/revoke idempotent (don't start a second flow against an open PR). */
export function isInFlight(row: AgreementRow | null): boolean {
  if (!row) return false;
  return row.kind === "accept" || row.kind === "revoke";
}

/** Only the mid-flow write window (fork → branch → commit → open PR). Used
 *  by refresh to avoid yanking the row out from under a running flow. A
 *  pending PR doesn't count: the server is idle, just waiting for the human. */
export function isWorking(row: AgreementRow | null): boolean {
  if (!row) return false;
  if (row.kind !== "accept" && row.kind !== "revoke") return false;
  return row.step !== "pending";
}
