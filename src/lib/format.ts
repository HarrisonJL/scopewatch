export function truncateAddress(address: string, chars = 4): string {
  if (!address || address.length < 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function truncateHash(hash: string, chars = 8): string {
  if (!hash || hash.length < chars * 2) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

export function timeAgo(isoString: string): string {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return isoString;
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export type Verdict = "MATCH" | "MISMATCH" | "UNVERIFIED" | "NONE";

export function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case "MATCH":
      return "Match";
    case "MISMATCH":
      return "Mismatch";
    case "UNVERIFIED":
      return "Unverified";
    default:
      return "No attestations yet";
  }
}

export function verdictClass(verdict: Verdict): string {
  switch (verdict) {
    case "MATCH":
      return "status-match";
    case "MISMATCH":
      return "status-mismatch";
    case "UNVERIFIED":
      return "status-unverified";
    default:
      return "status-none";
  }
}
