"use client";

import { useRef, useState } from "react";
import { CONTRACT_ADDRESS, getWriteClient, estimateAndAttachFees } from "@/lib/genlayer";
import { useWallet } from "@/lib/useWallet";
import { pollTransaction, STATUS_COPY, describeFailure, type Progress } from "@/lib/pollTransaction";
import { Button, Field, inputClass } from "@/components/ui";

const MAX_TARGET_ID_LEN = 32;
const MAX_NAME_LEN = 100;
const ACCEPTED = "5";

export default function RegisterTargetForm({ onSettled }: { onSettled: () => void }) {
  const { account, connecting, error: walletError, connect } = useWallet();
  const [targetId, setTargetId] = useState("");
  const [name, setName] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [auditedUrl, setAuditedUrl] = useState("");
  const [deployedUrl, setDeployedUrl] = useState("");
  const [stage, setStage] = useState<"idle" | "submitting" | "waiting" | "done">("idle");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const busy = stage === "submitting" || stage === "waiting";

  async function submit() {
    if (!account) return;
    const id = targetId.trim();

    if (!id || id.length > MAX_TARGET_ID_LEN) {
      setError(`Give the target a short identifier, e.g. VAULT1 (1-${MAX_TARGET_ID_LEN} chars).`);
      return;
    }
    if (!name.trim() || name.length > MAX_NAME_LEN) {
      setError("Give the target a display name.");
      return;
    }
    for (const [label, url] of [
      ["audit report", reportUrl],
      ["audited source", auditedUrl],
      ["deployed source", deployedUrl],
    ] as const) {
      if (!url.trim().startsWith("https://")) {
        setError(`The ${label} URL must start with https://`);
        return;
      }
    }

    setStage("submitting");
    setError(null);
    cancelledRef.current = false;
    try {
      const client = getWriteClient(account);
      const fees = await estimateAndAttachFees(client);
      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "register_target",
        args: [id, name.trim(), reportUrl.trim(), auditedUrl.trim(), deployedUrl.trim()],
        value: 0n,
        fees,
      });
      setStage("waiting");
      const tx = await pollTransaction(client, txHash, "ACCEPTED", setProgress, () => cancelledRef.current);
      const statusNum = String(tx.status);
      if (statusNum !== ACCEPTED) {
        setError(describeFailure(tx, "is this target ID already registered, or a URL not https://?"));
        setStage("idle");
        return;
      }
      setTargetId("");
      setName("");
      setReportUrl("");
      setAuditedUrl("");
      setDeployedUrl("");
      setStage("done");
      onSettled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register target.");
      setStage("idle");
    } finally {
      setProgress(null);
    }
  }

  if (!account) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-[color:var(--muted)]">Connect a wallet to register a target (any wallet can call this).</p>
        <Button onClick={connect} loading={connecting}>
          Connect wallet
        </Button>
        {walletError && <p className="text-sm text-red-400">{walletError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Target ID (short, e.g. VAULT1)">
          <input className={inputClass} value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="VAULT1" disabled={busy} />
        </Field>
        <Field label="Display name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Example Vault" disabled={busy} />
        </Field>
      </div>

      <Field label="Audit report URL (https://)">
        <input className={inputClass} value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} placeholder="https://example.com/audit-report" disabled={busy} />
      </Field>
      <Field label="Audited source URL (the code as it was when reviewed)">
        <input className={inputClass} value={auditedUrl} onChange={(e) => setAuditedUrl(e.target.value)} placeholder="https://example.com/audited-source" disabled={busy} />
      </Field>
      <Field label="Deployed source URL (what's actually live now)">
        <input className={inputClass} value={deployedUrl} onChange={(e) => setDeployedUrl(e.target.value)} placeholder="https://example.com/deployed-source" disabled={busy} />
      </Field>

      <Button onClick={submit} loading={busy} disabled={busy}>
        Register target
      </Button>

      {progress && stage === "waiting" && (
        <p className="text-xs text-[color:var(--muted)]">{STATUS_COPY[progress.statusName] ?? progress.statusName}</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {stage === "done" && <p className="text-sm text-[color:var(--accent)]">Target registered.</p>}
    </div>
  );
}
