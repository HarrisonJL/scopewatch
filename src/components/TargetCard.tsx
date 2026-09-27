"use client";

import { useEffect, useState } from "react";
import { fetchTarget, type Target, type Attestation } from "@/lib/useAuditScopeState";
import { timeAgo, truncateAddress, truncateHash, type Verdict } from "@/lib/format";
import { Card, VerdictBadge } from "@/components/ui";
import AttestButton from "@/components/AttestButton";

export default function TargetCard({
  targetId,
  attestations,
  onSettled,
}: {
  targetId: string;
  attestations: Attestation[]; // already filtered to this target, newest-first
  onSettled: () => void;
}) {
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    // Target metadata is immutable once registered, so a failed fetch (e.g.
    // Studio Next's "Server busy" or its 500-requests/hour rate limit, both
    // confirmed live in sibling GenLayer projects) just needs a retry, not
    // a permanent fallback. Backs off (5s, 10s, 20s... capped at 60s)
    // rather than a fixed interval.
    function load() {
      fetchTarget(targetId)
        .then((t) => {
          if (!cancelled) setTarget(t);
        })
        .catch(() => {
          if (cancelled) return;
          const delay = Math.min(5000 * 2 ** attempt, 60000);
          attempt += 1;
          setTimeout(load, delay);
        });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  const latest = attestations[0];
  const latestVerdict: Verdict = latest?.verdict ?? "NONE";

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{target?.name ?? targetId}</span>
            <span className="mono text-xs text-[color:var(--muted)]">{targetId}</span>
          </div>
          {target && (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
              <a href={target.audit_report_url} target="_blank" rel="noreferrer" className="text-[color:var(--accent)] hover:underline">
                Audit report ↗
              </a>
              <a href={target.audited_source_url} target="_blank" rel="noreferrer" className="text-[color:var(--accent)] hover:underline">
                Audited source ↗
              </a>
              <a href={target.deployed_source_url} target="_blank" rel="noreferrer" className="text-[color:var(--accent)] hover:underline">
                Deployed source ↗
              </a>
            </p>
          )}
        </div>
        <VerdictBadge verdict={latestVerdict} />
      </div>

      {latest && (
        <div className="mb-3 rounded-lg border border-[color:var(--surface-border)] p-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-[color:var(--muted)]">Claimed reference</span>
            <span className="mono text-sm">{latest.claimed_reference || "(none found)"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--muted)]">
            <span>grounded in report: {latest.grounded ? "yes" : "no"}</span>
            <span>verified against source: {latest.reference_verified ? "yes" : "no"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--muted)]">
            <span className="mono">audited: {truncateHash(latest.audited_hash)}</span>
            <span className="mono">deployed: {truncateHash(latest.deployed_hash)}</span>
          </div>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            {timeAgo(latest.attested_at)} · by {truncateAddress(latest.submitted_by)}
          </p>
        </div>
      )}

      <AttestButton targetId={targetId} onSettled={onSettled} />

      {attestations.length > 1 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]">
            {attestations.length - 1} earlier attestation{attestations.length - 1 === 1 ? "" : "s"}
          </summary>
          <div className="mt-2 space-y-2">
            {attestations.slice(1).map((a, i) => (
              <div key={`${a.attested_at}-${i}`} className="flex items-center justify-between rounded-lg border border-[color:var(--surface-border)] p-2 text-xs">
                <span className="mono">{a.claimed_reference || "(none)"}</span>
                <VerdictBadge verdict={a.verdict} />
                <span className="text-[color:var(--muted)]">{timeAgo(a.attested_at)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}
