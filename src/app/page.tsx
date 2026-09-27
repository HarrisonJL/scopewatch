"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONTRACT_ADDRESS, chain } from "@/lib/genlayer";
import {
  useAuditScopeState,
  fetchTargets,
  fetchAttestations,
  isConfigured,
  type TargetSummary,
  type Attestation,
} from "@/lib/useAuditScopeState";
import { truncateAddress } from "@/lib/format";
import { Card, StatCard } from "@/components/ui";
import RegisterTargetForm from "@/components/RegisterTargetForm";
import TargetCard from "@/components/TargetCard";

export default function Home() {
  const { state, error, loading, refresh } = useAuditScopeState();
  const [targets, setTargets] = useState<TargetSummary[]>([]);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  // Distinct from the top-level `error` (get_state failing): this is
  // list_targets/get_attestations failing, e.g. Studio Next's "Server busy:
  // all 8 execution slots occupied" under load - confirmed live in sibling
  // GenLayer projects. Keeps the last good data on screen and retries
  // itself rather than going blank.
  const [dataError, setDataError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  // Exponential backoff (5s, 10s, 20s... capped at 60s), not a fixed
  // interval - Studio Next's rate limit is a real hourly cap (500/hour),
  // confirmed live, not just a burst limit.
  const retryAttempt = useRef(0);

  const refreshData = useCallback(async () => {
    if (!isConfigured()) return;
    try {
      const [t, a] = await Promise.all([fetchTargets(), fetchAttestations(0, 50)]);
      setTargets(t);
      setAttestations(a);
      setDataError(null);
      setHasLoadedOnce(true);
      retryAttempt.current = 0;
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Failed to load targets.");
      const delay = Math.min(5000 * 2 ** retryAttempt.current, 60000);
      retryAttempt.current += 1;
      setTimeout(refreshData, delay);
    }
  }, []);

  // Loads once on mount - no interval. A background timer here would be
  // pure unnecessary load on a shared, rate-limited endpoint; refreshAll
  // (below) covers "I just did something, check for real" instead.
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const refreshAll = useCallback(() => {
    refresh();
    refreshData();
  }, [refresh, refreshData]);

  if (!isConfigured()) {
    return (
      <Card>
        <p className="text-sm text-red-400">NEXT_PUBLIC_CONTRACT_ADDRESS is not set.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="mb-1 text-xl font-semibold">Audit-coverage targets</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Register a deployed contract&apos;s audit report alongside its audited and currently-deployed source, and
            any wallet can trigger a real validator committee to independently verify whether the report&apos;s
            claimed reference actually identifies this source, and whether what was audited still matches what&apos;s
            deployed - Match, Mismatch, or Unverified, not a badge nobody re-checks.
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="shrink-0 rounded-lg border border-[color:var(--surface-border)] px-3 py-1.5 text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Contract" value={truncateAddress(CONTRACT_ADDRESS)} hint={`chain ${chain.id}`} />
        <StatCard
          label="Targets registered"
          value={loading ? "…" : state ? String(state.target_count) : error ? "—" : "0"}
        />
        <StatCard
          label="Attestations made"
          value={loading ? "…" : state ? String(state.attestation_count) : error ? "—" : "0"}
        />
      </div>

      {error && (
        <Card>
          <p className="text-sm text-red-400">{error}</p>
        </Card>
      )}

      {dataError && (
        <Card>
          <p className="text-sm text-red-400">
            Couldn&apos;t refresh the target list ({dataError}) - retrying automatically. Showing the last data
            loaded successfully{targets.length === 0 ? " (none yet)" : ""}.
          </p>
        </Card>
      )}

      <Card title="Register a target">
        <RegisterTargetForm onSettled={refreshAll} />
      </Card>

      <div className="space-y-4">
        {targets.length === 0 ? (
          <Card>
            <p className="text-sm text-[color:var(--muted)]">
              {!hasLoadedOnce ? "Loading targets..." : "No targets registered yet."}
            </p>
          </Card>
        ) : (
          targets.map((t) => (
            <TargetCard
              key={t.target_id}
              targetId={t.target_id}
              attestations={attestations.filter((a) => a.target_id === t.target_id)}
              onSettled={refreshAll}
            />
          ))
        )}
      </div>
    </div>
  );
}
