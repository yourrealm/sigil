// Server-only: Deno KV helpers for `AgreementRow`. Never import from a client
// island - the top-level `Deno.openKv` would blow up in the browser.

import { AgreementRow } from "./agreement.ts";

// 15 min - balances "forgotten tab eventually sees reality" with not hammering
// the GitHub API. The refresh endpoint resets the row so the poll re-derives.
const TTL_MS = 15 * 60 * 1000;

export type AgreementKey = readonly [
  "agreement",
  string,
  string,
  string,
];

export function agreementKey(
  owner: string,
  repo: string,
  handle: string,
): AgreementKey {
  return ["agreement", owner, repo, handle] as const;
}

// In prod (Deno Deploy), SIGIL_KV_PATH is unset and openKv() picks up the
// managed remote KV. Locally, a shared path lets dev processes and ad-hoc
// scripts operate on the same store.
const kv = await Deno.openKv(Deno.env.get("SIGIL_KV_PATH") || undefined);

export interface RowEntry {
  row: AgreementRow | null;
  versionstamp: string | null;
}

export async function readRow(key: AgreementKey): Promise<AgreementRow | null> {
  const entry = await readRowEntry(key);
  return entry.row;
}

export async function readRowEntry(key: AgreementKey): Promise<RowEntry> {
  const res = await kv.get<unknown>(key as unknown as Deno.KvKey);
  if (res.value === null) {
    return { row: null, versionstamp: null };
  }
  const parsed = AgreementRow.safeParse(res.value);
  return {
    row: parsed.success ? parsed.data : null,
    versionstamp: res.versionstamp,
  };
}

export async function writeRow(
  key: AgreementKey,
  row: AgreementRow,
): Promise<void> {
  const validated = AgreementRow.parse(row);
  await kv.set(key as unknown as Deno.KvKey, validated, { expireIn: TTL_MS });
}

/** Atomic set conditional on the key's current versionstamp. Returns false if
 *  the row changed underneath us (concurrent writer won the race). */
export async function compareAndWriteRow(
  key: AgreementKey,
  row: AgreementRow,
  expectedVersionstamp: string | null,
): Promise<boolean> {
  const validated = AgreementRow.parse(row);
  const res = await kv.atomic()
    .check({
      key: key as unknown as Deno.KvKey,
      versionstamp: expectedVersionstamp,
    })
    .set(key as unknown as Deno.KvKey, validated, { expireIn: TTL_MS })
    .commit();
  return res.ok;
}
