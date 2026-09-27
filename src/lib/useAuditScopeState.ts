"use client";

import { useCallback, useEffect, useState } from "react";
import { CONTRACT_ADDRESS, getReadClient } from "@/lib/genlayer";
import type { Verdict } from "@/lib/format";

export type AuditScopeState = {
  target_count: number;
  attestation_count: number;
};

export type TargetSummary = {
  target_id: string;
  name: string;
};

export type Target = {
  name: string;
  audit_report_url: string;
  audited_source_url: string;
  deployed_source_url: string;
  registrant: string;
  registered_at: string;
};

export type Attestation = {
  target_id: string;
  claimed_reference: string;
  grounded: boolean;
  reference_verified: boolean;
  audited_hash: string;
  deployed_hash: string;
  verdict: Exclude<Verdict, "NONE">;
  submitted_by: string;
  attested_at: string;
};

export function isConfigured(): boolean {
  return CONTRACT_ADDRESS.length > 0;
}

// Standalone (not just the hook's internal refresh) so bindAttestation.ts's
// count-delta check can read a fresh attestation_count without going
// through React state.
export async function fetchAuditScopeState(): Promise<AuditScopeState> {
  const client = getReadClient();
  return (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "get_state",
    args: [],
  })) as AuditScopeState;
}

// No automatic interval polling - Studio Next's public RPC caps at both 30
// requests/minute AND 500/hour, shared across every visitor, not per-user
// (confirmed live and documented in the sibling PegWatch project's
// incident). This app only needs fresh state on load and after the current
// user's own actions (already wired via onSettled everywhere below), not a
// live feed of everyone else's activity. Loads once; call `refresh()` for
// a manual retry/refresh.
export function useAuditScopeState() {
  const [state, setState] = useState<AuditScopeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isConfigured()) {
      setError("NEXT_PUBLIC_CONTRACT_ADDRESS is not set.");
      setLoading(false);
      return;
    }
    try {
      setState(await fetchAuditScopeState());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read contract state.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { state, error, loading, refresh };
}

export async function fetchTargets(): Promise<TargetSummary[]> {
  const client = getReadClient();
  return (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "list_targets",
    args: [],
  })) as TargetSummary[];
}

export async function fetchTarget(targetId: string): Promise<Target> {
  const client = getReadClient();
  return (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "get_target",
    args: [targetId],
  })) as Target;
}

export async function fetchAttestations(offset: number, limit: number): Promise<Attestation[]> {
  const client = getReadClient();
  return (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "get_attestations",
    args: [offset, limit],
  })) as Attestation[];
}
