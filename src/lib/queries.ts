import { queryOptions } from "@tanstack/preact-query";
import {
  fetchSignature,
  findOpenSignaturePr,
  type OpenSignaturePr,
  type SignatureRecord,
} from "@/lib/api.ts";

export interface ForgeTarget {
  forge: string;
  owner: string;
  repo: string;
}

export function signatureQuery(target: ForgeTarget, handle: string) {
  return queryOptions<SignatureRecord | null>({
    queryKey: ["signature", target.forge, target.owner, target.repo, handle],
    queryFn: () =>
      fetchSignature(target.forge, target.owner, target.repo, handle),
    staleTime: 5 * 60 * 1000,
  });
}

export function openPrQuery(target: ForgeTarget, handle: string) {
  return queryOptions<OpenSignaturePr | null>({
    queryKey: ["openPr", target.forge, target.owner, target.repo, handle],
    queryFn: () =>
      findOpenSignaturePr(target.forge, target.owner, target.repo, handle),
    staleTime: 20 * 1000,
    refetchInterval: (q) => q.state.data ? 20 * 1000 : false,
  });
}
