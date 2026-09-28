import { getWriteClient } from "@/lib/genlayer";

// Mirrors genlayer-js's internal status numbering (not exported from its
// public entry point - confirmed against real transactions in sibling
// GenLayer projects this account has built).
export const STATUS_NAMES: Record<string, string> = {
  "0": "UNINITIALIZED",
  "1": "PENDING",
  "2": "PROPOSING",
  "3": "COMMITTING",
  "4": "REVEALING",
  "5": "ACCEPTED",
  "6": "UNDETERMINED",
  "7": "FINALIZED",
  "8": "CANCELED",
  "9": "APPEAL_REVEALING",
  "10": "APPEAL_COMMITTING",
  "11": "READY_TO_FINALIZE",
  "12": "VALIDATORS_TIMEOUT",
  "13": "LEADER_TIMEOUT",
};
const DECIDED = new Set(["5", "6", "7", "8", "12", "13"]);

export const STATUS_COPY: Record<string, string> = {
  UNINITIALIZED: "Submitting...",
  PENDING: "Waiting for the network to pick up the transaction...",
  PROPOSING: "A leader validator is being assigned...",
  COMMITTING: "Validators are independently fetching the audit report and source pages, extracting the reference, hashing the source, and checking it against the source - this is the real work, it can take a bit.",
  REVEALING: "Validators are revealing their results...",
  ACCEPTED: "Consensus reached.",
  UNDETERMINED: "Validators couldn't reach a clear majority - may need a retry.",
  FINALIZED: "Confirmed final.",
  CANCELED: "Transaction was canceled.",
  APPEAL_REVEALING: "Under appeal - a fresh, larger committee is revealing results.",
  APPEAL_COMMITTING: "Under appeal - a fresh, larger committee is voting.",
  READY_TO_FINALIZE: "Consensus reached, wrapping up...",
  VALIDATORS_TIMEOUT: "Validators timed out fetching a page or running the extraction - may need a retry.",
  LEADER_TIMEOUT: "The leader timed out - may need a retry.",
};

export type Progress = { statusName: string; validators: string[]; votes: string[]; leader: string | null };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polls a transaction's live status instead of trusting genlayer-js's
// waitForTransactionReceipt default (10 retries x 3s = 30s - nowhere near
// enough once every validator has to fetch three pages AND run a real LLM
// extraction before COMMITTING can finish). Reports live status on every
// poll and keeps going while consensus is genuinely still in progress -
// there's no reliable SLA to bound it by.
export async function pollTransaction(
  client: ReturnType<typeof getWriteClient>,
  hash: `0x${string}`,
  target: "ACCEPTED" | "FINALIZED",
  onUpdate: (p: Progress) => void,
  cancelled: () => boolean
) {
  const targetNum = target === "FINALIZED" ? "7" : "5";
  while (!cancelled()) {
    try {
      // getTransaction's real shape (last_round/last_leader/txExecutionResultName
      // etc.) isn't in genlayer-js 2.0.0-rc.1's published types yet - confirmed
      // live against real transactions, just ahead of the RC's .d.ts.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = (await client.getTransaction({ hash: hash as `0x${string}` & { length: 66 } })) as any;
      if (tx) {
        const statusNum = String(tx.status);
        onUpdate({
          statusName: STATUS_NAMES[statusNum] ?? statusNum,
          // Studio Next's genlayer-js v2 returns these snake_case
          // (last_round/round_validators/validator_votes_name) - confirmed
          // directly against live transactions in sibling GenLayer projects.
          validators: tx.last_round?.round_validators ?? [],
          votes: tx.last_round?.validator_votes_name ?? [],
          leader: tx.last_leader ?? null,
        });
        if (statusNum === targetNum || (target === "ACCEPTED" && DECIDED.has(statusNum))) {
          return tx;
        }
      }
    } catch {
      // Transient RPC hiccup (e.g. not indexed yet right after submission) -
      // keep polling rather than failing outright.
    }
    await sleep(4000);
  }
  throw new Error("cancelled");
}

// A transaction that never reaches ACCEPTED can fail for two genuinely
// different reasons, confirmed against real transactions in sibling
// GenLayer projects: a deterministic contract-level rejection (an assert
// failure) resolves straight to a decided status with
// txExecutionResultName "FINISHED_WITH_ERROR" - every validator agrees the
// call reverts, there's nothing to retry about it. Genuine consensus
// trouble (real disagreement or timeouts) has no such field. This
// distinguishes them rather than showing the same message for both.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function describeFailure(tx: any, rejectionHint: string): string {
  const statusNum = String(tx.status);
  if (tx?.txExecutionResultName === "FINISHED_WITH_ERROR") {
    return `The contract rejected this call - ${rejectionHint}`;
  }
  const statusName = STATUS_NAMES[statusNum] ?? statusNum;
  return STATUS_COPY[statusName] ?? `Not accepted (status: ${statusName}).`;
}
