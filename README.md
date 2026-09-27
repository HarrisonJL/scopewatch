# ScopeWatch

A frontend for [AuditScope](https://github.com/HarrisonJL/auditscope), a reusable audit-coverage attestor on GenLayer. Register a deployed contract's audit report alongside its audited and currently-deployed source; any wallet can trigger a real validator committee to independently verify whether the report's claimed reference actually identifies that source, and whether what was audited still matches what's deployed - `MATCH` / `MISMATCH` / `UNVERIFIED`, not a badge nobody re-checks.

**Live on GenLayer Studio Next. Testnet only.**

## What this is for

AuditScope itself is a standalone Intelligent Contract - a building block other contracts (or frontends) call into, not an app. ScopeWatch is the demonstration layer: register a target, trigger a real attestation, and watch the actual proposer-prover consensus play out - an LLM proposes a pointer into the report, and code proves it, both against the report itself and against the source it's supposed to identify.

## A steward-flagged gap, closed

The original contract computed `MATCH` purely from the audited and deployed source hashing identically, plus a report reference that was merely grounded (really present in the report text) - with nothing tying the two together. A GenLayer steward review found the real consequence: a genuine audit report for a *completely different contract*, with its own real, grounded reference, would still produce `MATCH` as long as the audited and deployed pages happened to hash-match each other. The fix, `reference_verified`, requires the report's claimed token to also be found in the audited source's own URL or content, independently re-confirmed by every validator - a hash match with a missing or unrelated reference now fails closed to a new `UNVERIFIED` verdict. See [`auditscope/CONTRACT.md`](https://github.com/HarrisonJL/auditscope/blob/main/CONTRACT.md) for the live, on-chain proof - a target whose audit report is genuinely about an unrelated contract, reproduced and confirmed to fail closed. This app's "How it works" page explains it plainly too.

## A limitation shown, not hidden

`AttestButton`'s write flow checks the transaction's *actual resolved status* before showing a result - not "did the receipt merely avoid erroring." Every validator here has to fetch three pages *and* run an LLM extraction within one consensus round, which is measurably heavier than a pure-LLM call and can occasionally need a retry - confirmed live in the sibling AuditScope repo's own `CONTRACT.md`. If a user sees "consensus not reached, try again" here, that's this real, disclosed characteristic, not a bug being papered over.

## Development

```bash
npm install
cp .env.local.example .env.local   # already points at the live contract
npm run dev                         # http://localhost:3000
npm test                            # bindAttestation unit tests (vitest)
```

`.env.local` needs `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_GENLAYER_CHAIN=studionext`.

Stack: Next.js 16 + React 19 + Tailwind v4 + TypeScript via `genlayer-js` v2 (Studio Next's explicit-fees API), wallet connect via plain EIP-1193 (`window.ethereum`) with automatic network switching to chain `61997`.

## Contract

- **Address:** [`0xc105Dc370F3182F9Fa95aACe47aeF08C522cfa4b`](https://explorer-studio-dev.genlayer.com/address/0xc105Dc370F3182F9Fa95aACe47aeF08C522cfa4b) - a dedicated deployment for this Project, separate from the address submitted under Intelligent Contracts (the platform doesn't allow resubmitting the same contract address as evidence for two different submissions). Runs the exact same, fully self-audited and steward-fixed source.
- **Source (included in this repo):** [`contract/auditscope_studio_next.py`](contract/auditscope_studio_next.py) and [`contract/listing_gate_studio_next.py`](contract/listing_gate_studio_next.py) - exact mirrors of the deployed contracts, included directly here so the dashboard's calls can be verified against the real adjudication logic without leaving this repo.
- **Canonical source, design rationale, and full test suite:** [github.com/HarrisonJL/auditscope](https://github.com/HarrisonJL/auditscope) - that repo is the actual Intelligent Contracts submission and is where the contract is developed; see its `CONTRACT.md` for the self-audit and steward-review writeups this dashboard's "How it works" page summarizes.

## Known limitations

- **Testnet only.** No real value anywhere in this project.
- **Wallet click-through not tested end to end in a real browser extension** - the underlying `writeContract` calls this UI makes are proven correct (the exact same function names and argument shapes were exercised successfully against real Studio Next consensus via standalone scripts - see the contract repo's `CONTRACT.md`), but there's no MetaMask-equivalent extension in the environment this was built in. Read paths and every rendered state were verified live in a real browser against the deployed contract, seeded with real consensus-derived data from those same scripts.
- **No dedicated UI for `ListingGate`** - the composability example (a downstream contract that only lists a target once AuditScope's own `is_covered()` confirms it) is demonstrated live in the contract repo's `CONTRACT.md` rather than in this dashboard, to keep this Project's scope focused on the primitive itself.
