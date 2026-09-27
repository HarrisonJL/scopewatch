import { fetchAuditScopeState, fetchAttestations, type Attestation } from "@/lib/useAuditScopeState";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type BindResult =
  | { kind: "bound"; attestation: Attestation }
  // attestation_count never increased past beforeCount - the transaction
  // reached a decided consensus status, but attest()'s own bookkeeping
  // never ran (a validator-timeout / result-mismatch round can finalize
  // without ever appending a record - the same live-observed failure mode
  // documented in the sibling SolvencyOracle/PegWatch/QuoteKeeper projects).
  | { kind: "no_new_record" }
  // attestation_count increased but none of the newly-appended records
  // match this submission - shouldn't happen for a correctly-submitted
  // attestation, but fails safe rather than falling back to "latest".
  | { kind: "unmatched" };

// attest() has no caller-chosen ID and attestations are a single global
// log (not indexed per target) - a record's id is just its index, assigned
// by whichever transaction's append lands first. Match on the actual
// submitted fields within the delta window, never "the newest record".
export function findBoundAttestation(
  newAttestationsNewestFirst: Attestation[],
  targetId: string,
  submittedBy: string
): Attestation | null {
  const submittedByLower = submittedBy.toLowerCase();
  return (
    newAttestationsNewestFirst.find(
      (a) => a.target_id === targetId && a.submitted_by.toLowerCase() === submittedByLower
    ) ?? null
  );
}

export function bindAttestationFromDelta(
  beforeCount: number,
  afterCount: number,
  recentAttestationsNewestFirst: Attestation[],
  targetId: string,
  submittedBy: string
): BindResult {
  const delta = afterCount - beforeCount;
  if (delta <= 0) return { kind: "no_new_record" };
  const candidates = recentAttestationsNewestFirst.slice(0, delta);
  const match = findBoundAttestation(candidates, targetId, submittedBy);
  return match ? { kind: "bound", attestation: match } : { kind: "unmatched" };
}

// Real I/O wrapper around bindAttestationFromDelta - retries briefly for
// read-node lag, but never falls back to "just show whatever's newest".
export async function resolveBoundAttestation(
  beforeCount: number,
  targetId: string,
  submittedBy: string,
  retries = 4,
  retryDelayMs = 2000
): Promise<BindResult> {
  for (let i = 0; i < retries; i++) {
    const state = await fetchAuditScopeState();
    const afterCount = state.attestation_count;
    if (afterCount > beforeCount) {
      const recent = await fetchAttestations(0, afterCount - beforeCount);
      return bindAttestationFromDelta(beforeCount, afterCount, recent, targetId, submittedBy);
    }
    if (i < retries - 1) await sleep(retryDelayMs);
  }
  return { kind: "no_new_record" };
}
