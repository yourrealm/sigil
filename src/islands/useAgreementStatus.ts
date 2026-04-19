import { queryOptions, useQuery } from "@tanstack/preact-query";
import { AgreementRow } from "@/lib/agreement.ts";

export interface AgreementTarget {
  owner: string;
  repo: string;
  handle: string;
}

function apiPath(t: AgreementTarget, tail = ""): string {
  return `/api/cla/github/${encodeURIComponent(t.owner)}/${
    encodeURIComponent(t.repo)
  }${tail}/${encodeURIComponent(t.handle)}`;
}

async function fetchStatus(t: AgreementTarget): Promise<AgreementRow> {
  const res = await fetch(apiPath(t, "/status"));
  if (!res.ok) {
    throw new Error(`status failed: ${res.status}`);
  }
  return AgreementRow.parse(await res.json());
}

export function useAgreementStatus(target: AgreementTarget) {
  return useQuery(queryOptions({
    queryKey: ["agreement", target.owner, target.repo, target.handle] as const,
    queryFn: () => fetchStatus(target),
    refetchInterval: 1000,
    refetchIntervalInBackground: false,
    staleTime: 0,
    retry: 1,
  }));
}

export async function postAccept(target: AgreementTarget): Promise<void> {
  const res = await fetch(apiPath(target, "/accept"), { method: "POST" });
  if (!res.ok) {
    throw new Error(`accept failed: ${res.status}`);
  }
}

export async function postRevoke(
  target: AgreementTarget,
  reason: string,
): Promise<void> {
  const res = await fetch(apiPath(target, "/revoke"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    throw new Error(`revoke failed: ${res.status}`);
  }
}

export async function postRefresh(target: AgreementTarget): Promise<void> {
  const res = await fetch(apiPath(target, "/refresh"), { method: "POST" });
  if (!res.ok) {
    throw new Error(`refresh failed: ${res.status}`);
  }
}
