import { Card } from "@/components/ui";

export default function About() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold">How ScopeWatch works</h1>
        <p className="text-sm text-[color:var(--muted)]">
          A frontend for <span className="mono">AuditScope</span>, a reusable audit-coverage attestor on GenLayer -
          not a product with its own trust model, just a window onto real consensus.
        </p>
      </div>

      <Card title="Let the LLM point, let code prove">
        <p className="text-sm leading-relaxed text-[color:var(--foreground)]">
          An audit badge gets treated as a permanent safety certificate, but an audit is a scoped review of specific
          code at a specific commit. Registering a target here means pointing at an audit report and the audited and
          currently-deployed source, as plain URLs - clicking &quot;Attest now&quot; triggers a real GenLayer
          validator committee. Every validator independently fetches the report and extracts a bare identifying
          token (a commit hash, tag, or version), re-fetches the report themselves to confirm that token is genuinely
          there (not a hallucinated citation), hashes the audited and deployed source deterministically, and checks
          the token against the audited source itself.
        </p>
      </Card>

      <Card title="A steward-flagged gap, and how it was closed">
        <p className="text-sm leading-relaxed text-[color:var(--foreground)]">
          The original version of this contract computed <span className="mono">MATCH</span> purely from the audited
          and deployed source hashing identically, plus a report reference that was merely grounded (really present
          in the report text) - with nothing tying the two together. A GenLayer steward review found the real
          consequence: a genuine audit report for a completely different contract, with its own real, grounded
          reference, would still produce <span className="mono">MATCH</span> as long as the audited and deployed
          pages happened to hash-match each other. <span className="mono">reference_verified</span> closes this: the
          report&apos;s claimed token must also be found in the audited source&apos;s own URL or content, independently
          re-confirmed by every validator. A hash match with a missing or unrelated reference now fails closed to a
          new <span className="mono">UNVERIFIED</span> verdict, never <span className="mono">MATCH</span>. See{" "}
          <a
            href="https://github.com/HarrisonJL/auditscope/blob/main/CONTRACT.md"
            target="_blank"
            rel="noreferrer"
            className="text-[color:var(--accent)] hover:underline"
          >
            CONTRACT.md
          </a>{" "}
          for the live, on-chain proof - a target whose audit report is genuinely about an unrelated contract,
          reproduced and confirmed to fail closed.
        </p>
      </Card>

      <Card title="Whitespace normalization, deliberately conservative">
        <p className="text-sm leading-relaxed text-[color:var(--foreground)]">
          Source comparison strips trailing whitespace and blank lines only - never leading whitespace, since Python
          indentation is semantically significant and a line dedented out of a function is a real code change, not
          formatting noise. A comment-only or pure-reformatting edit still reads as <span className="mono">MISMATCH</span>{" "}
          here, which is the deliberate, conservative direction to err in for a tool whose whole point is flagging
          real changes.
        </p>
      </Card>

      <Card title="A real limitation, shown honestly, not hidden">
        <p className="text-sm leading-relaxed text-[color:var(--foreground)]">
          Every validator here has to fetch three pages <em>and</em> run an LLM extraction within the same consensus
          round - meaningfully heavier, in real-world latency, than a pure-LLM call. If you click &quot;Attest
          now&quot; and see a message about consensus not being reached, that&apos;s this kind of thing, not a broken
          app - click &quot;Try again.&quot;
        </p>
      </Card>
    </div>
  );
}
