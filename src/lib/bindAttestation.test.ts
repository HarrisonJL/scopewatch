import { describe, expect, it } from "vitest";
import { bindAttestationFromDelta, findBoundAttestation } from "@/lib/bindAttestation";
import type { Attestation } from "@/lib/useAuditScopeState";

const ME = "0xAAAA000000000000000000000000000000AAAA";
const SOMEONE_ELSE = "0xBBBB000000000000000000000000000000BBBB";

function makeAttestation(overrides: Partial<Attestation> = {}): Attestation {
  return {
    target_id: "T1",
    claimed_reference: "e4f1a9c",
    grounded: true,
    reference_verified: true,
    audited_hash: "a".repeat(64),
    deployed_hash: "a".repeat(64),
    verdict: "MATCH",
    submitted_by: ME,
    attested_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("findBoundAttestation", () => {
  it("matches on target_id and submitted_by", () => {
    const mine = makeAttestation();
    const found = findBoundAttestation([mine], "T1", ME);
    expect(found).toBe(mine);
  });

  it("matches submitted_by case-insensitively", () => {
    const mine = makeAttestation({ submitted_by: ME.toLowerCase() });
    const found = findBoundAttestation([mine], "T1", ME);
    expect(found).toBe(mine);
  });

  it("does not match a record for a different target", () => {
    const other = makeAttestation({ target_id: "T2" });
    const found = findBoundAttestation([other], "T1", ME);
    expect(found).toBeNull();
  });

  it("does not match a record submitted by someone else", () => {
    const theirs = makeAttestation({ submitted_by: SOMEONE_ELSE });
    const found = findBoundAttestation([theirs], "T1", ME);
    expect(found).toBeNull();
  });
});

describe("bindAttestationFromDelta", () => {
  it("binds to the correct record when a concurrent attestation from someone else landed on top", () => {
    const theirs = makeAttestation({ target_id: "T2", submitted_by: SOMEONE_ELSE });
    const mine = makeAttestation();
    const result = bindAttestationFromDelta(10, 12, [theirs, mine], "T1", ME);
    expect(result).toEqual({ kind: "bound", attestation: mine });
  });

  it("reports no_new_record when attestation_count never increased (a real, live scenario for this contract family)", () => {
    const result = bindAttestationFromDelta(10, 10, [makeAttestation()], "T1", ME);
    expect(result).toEqual({ kind: "no_new_record" });
  });

  it("reports no_new_record when the count went backwards", () => {
    const result = bindAttestationFromDelta(10, 9, [], "T1", ME);
    expect(result).toEqual({ kind: "no_new_record" });
  });

  it("only searches within the delta window, not the whole history", () => {
    const newer2 = makeAttestation({ target_id: "T2" });
    const newer1 = makeAttestation({ target_id: "T2" });
    const stale = makeAttestation(); // matches, but outside the delta
    const result = bindAttestationFromDelta(10, 12, [newer2, newer1, stale], "T1", ME);
    expect(result).toEqual({ kind: "unmatched" });
  });

  it("reports unmatched when the count increased but nothing in the delta window matches", () => {
    const theirs = makeAttestation({ submitted_by: SOMEONE_ELSE });
    const result = bindAttestationFromDelta(10, 11, [theirs], "T1", ME);
    expect(result).toEqual({ kind: "unmatched" });
  });
});
