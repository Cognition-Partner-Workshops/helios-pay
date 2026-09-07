# Security Swarm Scan Results

Captured from real Security Swarm runs. Every finding ID, ACU figure and
duration below comes from the linked run — nothing here is illustrative.

Two sets of runs are recorded:

- The **five original runs** (baseline, runtime-validated, incremental,
  ingestion) ran against `main` of `Cognition-Partner-Workshops/helios-pay-demo`
  on 2026-09-02. That repository has since been deleted, so its GitHub links are
  dead — **the scan links still work**, because scan pages live in the Devin
  platform, not GitHub. These runs remain the richest evidence, and are the ones
  the demo script quotes.
- The **fresh runs against this repository** (2026-09-07) are in
  "Fresh runs against `helios-pay`" below. Use them when someone asks whether the
  numbers reproduce on the repo in front of them.

## Run summary

There are **two generations of scans** on this repo, and the distinction matters
when you present:

- **Baseline (static discovery)** — the first pass with the stock profiles. Fast,
  reasons about code only, does not boot the app.
- **Runtime-validated reruns** — same profiles forked with runtime-validation +
  reporting guidance. These **boot the full stack with `docker compose up` and
  fire live authenticated exploits** (the `security/poc/` scripts) before writing
  findings. They cost more ACUs and wall-clock, and they re-rank the report by
  what the validation stage could actually reach at runtime. Note that not every
  kept finding is a runtime-reachable one — the IaC findings (V13) are Terraform
  misconfigurations with no HTTP surface to exploit, and are kept on static
  reasoning. See "Honest gaps" #2 for exactly what the runtime stage did and did
  not prove.

| Run | Generation | Scan link | ACUs | Wall-clock | Sessions |
|---|---|---|---:|---:|---:|
| Full (discovery) | baseline | [scan-20ff29f7](https://partner-workshops.devinenterprise.com/code-scan/20ff29f7cab54a5594c9746a213ce49f) | 18.4 | ~12m 40s | 6 |
| Ingestion-mode | baseline | [scan-850d79d1](https://partner-workshops.devinenterprise.com/code-scan/850d79d1f4fb4bb183ec9f36215672f7) | 11.6 | ~6m 20s | 5 |
| Full (runtime-validated) | runtime | [scan-e888214a](https://partner-workshops.devinenterprise.com/code-scan/e888214a52b544a4ae3ebb4daa971b3d) | 39.4 | ~32m | 10 |
| Ingestion (runtime-validated) | runtime | [scan-cd8a2a4f](https://partner-workshops.devinenterprise.com/code-scan/cd8a2a4f35c64203954da85d3904fed7) | 22.3 | ~45m | 8 |
| Incremental (post-V16, runtime) | runtime | [scan-54c05905](https://partner-workshops.devinenterprise.com/code-scan/54c059058dca493a91c1ad28dcabf5ab) | 41.9 | ~46m | 10 |
| Remediation (1 finding) | — | [PR #2](https://github.com/Cognition-Partner-Workshops/helios-pay/pull/2) | 1.7 | ~4m | 1 |

Every ACU, session count and finding total above is read straight from Devin
code-scan management — nothing is illustrative. Wall-clock is scan-create →
report-written; the runtime reruns are ~2.5–3.5× the baseline because the
validation stage boots the stack and runs live exploits.

Headline numbers for the room:
- **Baseline:** ~30 ACUs, under 20 minutes, to discover 24 real vulns across 4
  languages + IaC and triage 47 inherited scanner findings.
- **Runtime:** the same OWASP profile, forked to boot the app and exploit each
  candidate live, added a **validation stage** (5 → 10 sessions) and re-derived
  severity from proven reachability — 7 criticals on the full runtime run.

---

## Full scan (discovery)

Profile **OWASP Top 10 — General Purpose**, security type, unattended, normal effort.

| Field | Result |
|---|---|
| Scan link | https://partner-workshops.devinenterprise.com/code-scan/20ff29f7cab54a5594c9746a213ce49f |
| ACUs consumed | **18.37** (parent 2.69 + 15.68 across 5 children) |
| Wall-clock | **~12m 40s** (created 06:04:49 UTC → findings written 06:17:31 UTC) |
| Session count | **6** (1 parent + 5 children) |
| Total findings | **30** — 24 open, 6 dismissed as intra-scan duplicates |
| Severity (open) | 5 critical · 12 high · 6 medium · 1 low |
| Planted vulns found | **14 of 15** reachable on `main` (V01–V14) |
| Misses | **V15** (vulnerable pinned dependency) — see "Honest gaps" |
| False positives on decoys | **0 of 7** — none of D1–D7 was reported |

### Fan-out shape

The swarm decomposed the repo itself — this is the session tree to show on screen:

```
Security scan helios-pay-demo            (parent, 2.69 ACU)
├── Code Scan: Threat Model              (2.67 ACU)   ← builds the attack surface map first
├── Code Scan: Investigate Batch 0       (3.78 ACU)   ┐
├── Code Scan: Investigate Batch 1       (3.01 ACU)   ├ parallel deep-dives
├── Code Scan: Investigate Batch 2       (1.14 ACU)   ┘
└── Code Scan: Aggregate                 (5.08 ACU)   ← dedups, re-severities, writes findings
```

The **Aggregate** child is what produced the 6 dismissals: they are the same
defect reported twice by different investigate batches (e.g. zip-slip found from
both the upload route and the storage helper). The swarm collapsed them rather
than shipping duplicate tickets.

### Findings

| Finding ID | V-ID | Title | Sev |
|---|---|---|---|
| `sfind-c64433e388324f549f10a933aca922bb` | V06 | JWT `alg:none` accepted — signature verification bypass on all core-api auth | critical |
| `sfind-5f5e6f1132b2478cb5c2903885a51258` | V04 | SSRF: webhook dispatcher follows redirects to a fresh fetch with no re-validation → cloud metadata read | critical |
| `sfind-b193213166e24aa599e146af3642b38e` | V08 | Unsafe YAML deserialization (`yaml.load` full Loader) on uploaded bytes → RCE | critical |
| `sfind-7f34c418dc77456894dff257fd629aa1` | V14 + V02 | IDOR + mass assignment in `PATCH /users/{id}` → privilege escalation and tenant hopping | critical |
| `sfind-8e47e50543774603beea3e5dafb877dd` | V12 | Password-reset request returns the reset token in the HTTP response | critical |
| `sfind-d9fa8dc945b84c4ba57740bcb8c0e77d` | V01 | SQL injection via `ORDER BY` sort/direction in invoice search | high |
| `sfind-0e9a974579b643b999885a1291e5e8cd` | V02 | Cross-tenant invoice disclosure on `GET /invoices/export` | high |
| `sfind-c6348e5579cc476d97a270f9bbb8644c` | V03 | Refund TOCTOU race: non-atomic check-then-write allows over-refund | high |
| `sfind-ec8f00473c724774843c422bd9a15f61` | V04 | SSRF guard uses a substring denylist that is trivially bypassable | high |
| `sfind-685af8a24b0c4d5fb91511b889de1cc0` | V10 | Stored XSS via `dangerouslySetInnerHTML` on unsanitized invoice `memo_html` | high |
| `sfind-d228d7a893424d59ae4ead17cddb6278` | V09 | Zip-slip: archive members joined onto disk with no containment check → arbitrary file write | high |
| `sfind-c36fa8268c2c4125a8010a73db934cd0` | V09 | Path traversal / arbitrary file read in document download via `p` | high |
| `sfind-848ef9ed9cdc460cbd0f342ef026264c` | V12 | Predictable password-reset token (time-seeded non-crypto PRNG) | high |
| `sfind-f73fde81c26c42a09eba578623403835` | V13 | Security group exposes Postgres 5432 to `0.0.0.0/0` | high |
| `sfind-e0535ce25ecb4cb2b43fc4aaf1661e12` | V13 | IAM policy grants wildcard `Action`/`Resource` to application runtime | high |
| `sfind-7a5250b6638544bd83e92660e73807e2` | V13 | Documents S3 bucket public-read with wildcard-principal `GetObject` | high |
| `sfind-53210952ec4c4a6aa598a0ada3811506` | V13 | RDS instance publicly accessible with encryption at rest disabled | high |
| `sfind-0f7f21365b35497babe9fec2065e46eb` | V05 | Unauthenticated `/admin/metrics` exposes cross-tenant metadata and config | medium |
| `sfind-4abcb3c45fda4060b572f733a8c62d95` | V05 | Unauthenticated `/refunds` endpoint on ledger-worker | medium |
| `sfind-fa12f0d299884fa399b8f2ea1fdaa386` | V07 | Cross-tenant invoice disclosure (BOLA) in Copilot summarize | medium |
| `sfind-fff26b033da04310ba1ade2e64e5c063` | V02 | Missing tenant ownership checks on document endpoints (BOLA) | medium |
| `sfind-54da906da80e456d9eafdd04e777712e` | V11 | Hardcoded live-looking webhook HMAC signing key fallback in source | medium |
| `sfind-73f500898d764a6785126a93cb78d270` | V11 | JWT verification falls back to a hardcoded default secret | medium |
| `sfind-fe6387ffa4d442cb86afce4a7de695c5` | V11 | Hardcoded credential literals in CI workflow env | low |

Dismissed as duplicates by the Aggregate child (the defect stays reported via the
canonical finding above): `sfind-8fce205f31b441738e4ea4f7ef567647`,
`sfind-fbd38f103be34c2eb263653b4450e56a`, `sfind-f4a828387d7d4b3ab8546141fdaa304f`,
`sfind-c204e254aace42feb56a40367cffa50a`, `sfind-42e5b1d19935407284d8ff05315a099d`,
`sfind-064e902d72a24fd9a02a2899e3787c00`.

### What the discovery run got right that a SAST tool does not

- **V04 was reported as two findings, root cause and exploit path.** The bypassable
  substring denylist *and* the redirect re-fetch that actually reaches metadata.
  Grep-based tools find neither: the guard "looks like" a guard.
- **V03 (refund race) is a concurrency defect** with no injectable string anywhere.
  It was found by reasoning about the non-atomic check-then-write across
  `service.go` and `repo.go`.
- **V14 chains two defects** (IDOR + mass assignment) into one critical
  privilege-escalation finding rather than two mediums.
- **Zero hits on the 7 decoys**, including the two hardest: `reports.py`, which
  concatenates SQL but only from a server-side allowlist, and `Notes.tsx`, which
  uses `dangerouslySetInnerHTML` on DOMPurify-sanitized HTML while
  `InvoiceMemo.tsx` (correctly flagged) does not.

---

## Full scan — runtime-validated rerun

Profile **OWASP Top 10 — Helios Pay (runtime-validated)**
(`csprof-bd94e758577840d3b5753fc871d06075`) — a fork of the shared org profile
with runtime-validation and reporting guidance added, so the shared
`OWASP Top 10 — General Purpose` profile stays untouched. Security type,
unattended, normal effort, on `main`.

| Field | Result |
|---|---|
| Scan link | https://partner-workshops.devinenterprise.com/code-scan/e888214a52b544a4ae3ebb4daa971b3d |
| ACUs consumed | **39.38** (parent 3.25 + 36.13 across 9 children) |
| Wall-clock | **~32m** (created 10:10:54 UTC → report written ~10:43 UTC) |
| Session count | **10** (1 parent + 9 children) |
| Total findings | **32** — 26 open, 6 dismissed |
| Severity (open) | 7 critical · 12 high · 5 medium · 2 low |
| Severity (dismissed) | 1 critical · 3 high · 1 medium · 1 low (intra-scan duplicates) |
| Misses | **V15** (vulnerable pinned dependency) — same blind spot as the baseline |
| False positives on decoys | **0 of 7** treated as exploitable vulns |

**What "runtime-validated" actually did here.** The runtime profile adds a
**validation stage** that the baseline run does not have — the fan-out grew from
6 sessions to 10, with three dedicated `validate batch A/B/C` children. Those
children booted the whole stack (`docker compose up -d --build`, all services
healthy), authenticated via `POST /auth/login`, and fired live exploit requests
against `http://localhost:8000` (core-api) and `http://localhost:8090`
(ledger-worker) before the report was written. That is why this run costs ~2.5×
the ACUs of the baseline discovery scan and re-derives severity from proven
reachability — the full runtime run promoted to **7 criticals** (vs 5 on the
baseline).

### Fan-out shape

```
Security scan helios-pay-demo            (parent, 3.25 ACU)
├── Code Scan: Threat Model              (3.07 ACU)   ← attack-surface map
├── Code Scan: Investigate Batch 0       (3.90 ACU)   ┐
├── Code Scan: Investigate Batch 1       (3.00 ACU)   ├ parallel deep-dives
├── Code Scan: Investigate Batch 2       (1.66 ACU)   ┘
├── Code Scan: Aggregate                 (4.24 ACU)   ← dedups, writes findings
├── Code Scan: Validate Batch A          (9.89 ACU)   ┐  boot stack + live
├── Code Scan: Validate Batch B          (4.70 ACU)   ├  authenticated exploits
├── Code Scan: Validate Batch C          (4.09 ACU)   ┘  (docker compose up)
└── Code Scan: Final Report              (1.58 ACU)   ← leads with proven findings
```

### Notable findings (open)

| Finding ID | V-ID | Title | Sev |
|---|---|---|---|
| `sfind-500412d53cdd4c4cb98f488eafd00d99` | V06 | JWT `alg:none` accepted — auth bypass, forge any tenant/role | critical |
| `sfind-1254bd63756443a7ad17b9e0a8f8ca3a` | V04 | SSRF: webhook dispatch follows redirects, no allowlist re-check → IMDS | critical |
| `sfind-0a321ef89fe44dcfb96115658f8054ce` | V08 | RCE via unsafe `yaml.load` on uploaded bulk-import file | critical |
| `sfind-160eac1beb1a4fb78025f32e0c128480` | V14+V02 | Mass assignment + missing ownership → priv-esc and tenant takeover | critical |
| `sfind-26bb4208336c4000a5d95854b487067a` | V09 | Zip-slip arbitrary file write + unbounded `resolve_path` traversal | critical |
| `sfind-64cc5d486fd14e7185416f0698355bbc` | V09 | Path traversal / arbitrary file read via unsanitized `p` | critical |
| `sfind-57b535fe9fca435c811e8021c7e7969b` | V12 | Password-reset request returns the reset token in the HTTP response | critical |
| `sfind-9148177339c0449e9548a26d274854d5` | V01 | SQL injection via `ORDER BY` — `safe_ident` escapes quotes only | high |
| `sfind-697c4fdf93744099b33b34336c378514` | V02 | Missing tenant authz on invoice export (BOLA) | high |
| `sfind-d20a529732594038a685c61f4b6c173e` | V02 | Missing tenant authz on document list/download (BOLA) | high |
| `sfind-5dcde92f9db542d882872a5f95a95af4` | V07 | Missing tenant authz in Copilot summarize (BOLA + cross-tenant pivot) | high |
| `sfind-6eae4ed8310a45369eb9ef151ac9b09b` | V03 | Refund check-then-act TOCTOU → balance can go negative | high |
| `sfind-0dbf8b4f3ffa4d42a2d5d397039802a1` | V10 | Stored XSS via `dangerouslySetInnerHTML` on unsanitized memo | high |
| `sfind-b79fa08d7c7c47aeb5307d89cc7be50c` | V12 | Predictable time-seeded password-reset token | high |
| `sfind-86bf0bd48fdf4b039cf2679f61474ee8` | V11 | Hardcoded production-looking webhook HMAC key in source | high |
| `sfind-04d58f9701cd46b8baca974b2231acd5` | V13 | Security group exposes Postgres 5432 to `0.0.0.0/0` | high |
| `sfind-2035d40d89d947fda9fda5c2ac965717` | V13 | S3 documents bucket world-readable | high |
| `sfind-9934e722b98e4371a0f38f107ff5a03c` | V13 | RDS publicly accessible, unencrypted at rest | high |
| `sfind-5f68863d427a4dd2aeeac00ec9a4c25d` | V05 | Unauthenticated `/admin/metrics` exposes all tenants + config | medium |
| `sfind-f994798bb5ae42d79c24b441fa7f2e9a` | V04 | SSRF blocklist uses bypassable substring matching | medium |
| `sfind-15062efc6b4248229a0e3321ac3fced0` | V13 | IAM policy grants wildcard `Action`/`Resource` | medium |
| `sfind-1a50f7f4e6e64333a1ee819be245cc7e` | V11 | Weak hardcoded default secrets (JWT + HMAC) | medium |
| `sfind-7b65b12f9bb24d5da45ff7094d46a88a` | V11 | JWT verification falls back to weak shared default secret | medium |
| `sfind-eaff0977f106446199611cd2d4552b22` | D7 | Legacy debug router mounted without auth (feature-gated) | low |
| `sfind-c93881c8d48c42689433a5d69bc46318` | D2 | `eval()` of CLI arg — **explicitly noted not reachable from HTTP** | low |

The two `low/open` rows are the honest treatment of decoys D7 and D2: the run
kept them visible as dangerous *primitives* but wrote, in each finding, that
there is **no HTTP attack path** (D2 is gated behind `HELIOS_DEV_CLI=1`; D7 is
feature-flag disabled). It did not inflate either into an exploitable vuln.

Dismissed as intra-scan duplicates (defect still reported via the canonical
finding above): `sfind-6eddc419bec249869fa48726599a41db` (JWT alg=none),
`sfind-73fd47d906d74f70b30eb51f262de836` (zip-slip),
`sfind-807364bfa95b4b8588c672c0d9b65450` (reset token),
`sfind-ae9bc7a504e64600806eb9952adcc65f` (SQLi ORDER BY),
`sfind-436c1fc2a3054df99550d934b7f4e7b5` (export BOLA),
`sfind-47000156db474eb69e3b1eb940521f6b` (CI creds, demo/fake).

---

## Incremental scan (post-V16, runtime-validated)

**Status: completed.** PR #2 was merged to `main` (merge commit `50b9e56`,
introducing **V16** — authenticated OS command injection at
`POST /diagnostics/connectivity`, CWE-78), then a fresh scan with the same
runtime-validated OWASP profile was run against the updated default branch.

| Field | Result |
|---|---|
| Scan link | https://partner-workshops.devinenterprise.com/code-scan/54c059058dca493a91c1ad28dcabf5ab |
| ACUs consumed | **41.91** (parent 3.57 + 38.34 across 9 children) |
| Wall-clock | **~46m** (created 10:19:21 UTC → report written ~11:05 UTC) |
| Session count | **10** (1 parent + 9 children) |
| Total findings | **38** — 28 open, 10 dismissed |
| Severity (open) | 6 critical · 16 high · 3 medium · 3 low |
| New vulnerability caught | **V16** — see below |

**The beat that matters: V16 was caught as a new critical.**

| Finding ID | V-ID | Title | Sev |
|---|---|---|---|
| `sfind-69ce4d638612475ab3c60f331a326f27` | **V16** | OS command injection via `/diagnostics/connectivity` `host` field | **critical** |

The finding narrates the exact chain: `payload.host` is interpolated into
`command = f"getent hosts {payload.host}"` and run with `subprocess.run(...,
shell=True)`, stdout returned in the response. The report explicitly links it to
the `alg=none` bypass (making the auth-gated endpoint unauthenticated-reachable)
and the wildcard IAM role (`RCE on the app role → full AWS account compromise`) —
i.e. it re-found V16 **and** chained it to two other planted findings into one
realized unauthenticated-RCE path. The rest of the V01–V14 findings reappear, so
the incremental run demonstrates "new code lands → the swarm flags the new
critical" without losing the existing surface.

> Note the finding-count growth (32 → 38) is mostly finer-grained splitting on
> the same run-to-run variance you expect from an agentic scanner (e.g. reset
> token reported as both a `high` and a `medium` facet), plus the new V16
> finding. It is not 6 brand-new vulnerabilities. Count **distinct defects**, not
> rows, when you present.

---

## Ingestion-mode scan

Profile **Helios Pay — Prior Scanner Findings Ingestion (SARIF + Pentest CSV)**
(`csprof-ee00702ca1604625a59496ac19da0c1c`, mode `ingest`). Sources are in-repo:
`security/baseline/helios-sast.sarif` (41 results, tool `HeliosSAST`) and
`security/baseline/pentest-findings.csv` (6 rows).

| Field | Result |
|---|---|
| Scan link | https://partner-workshops.devinenterprise.com/code-scan/850d79d1f4fb4bb183ec9f36215672f7 |
| ACUs consumed | **11.60** (parent 2.37 + 9.24 across 4 children) |
| Wall-clock | **~6m 20s** (created 06:06:22 UTC → findings written 06:12:43 UTC) |
| Session count | **5** (1 parent + 4 children) |
| Findings imported | **47** = 41 SARIF + 6 pentest CSV. Nothing was silently dropped. |
| Kept open after triage | **12** (11 high, 1 low) |
| Dismissed after triage | **35** (1 high, 6 medium, 28 low) — duplicates, decoys, noise |
| Noise reduction | **74%** of the inherited backlog closed with a written reason |

### Fan-out shape

```
Perform security scan                    (parent, 2.37 ACU)
├── Ingest findings                      (2.60 ACU)  ← parses SARIF + CSV, normalises severity
├── Triage batch 1                       (1.65 ACU)  ┐
├── Triage batch 2                       (2.20 ACU)  ├ parallel reachability analysis
└── Triage batch 3                       (2.80 ACU)  ┘
```

### Validated — kept open

| Finding ID | Source | V-ID | Title |
|---|---|---|---|
| `sfind-b0ad69bce48f47009ec8ae7327334fb8` | CSV `PT-004` | V04 | Webhook redirect reaches internal metadata |
| `sfind-7b3cb439a7314fe49e2f378a44c7c045` | CSV `PT-002` | V03 | Refund requests can be double-spent |
| `sfind-077b3fefaab94bcd9175829bd7425b08` | CSV `PT-001` | V02 | Invoice export exposes cross-tenant data |
| `sfind-16b13acbc7084da8bd951b7e19a90da8` | SARIF | V10 | Invoice memo HTML rendered without sanitization |
| `sfind-4a7dcf4b30944c77949a58ffbb4a9035` | SARIF | V08 | Unsafe YAML loader can construct arbitrary Python objects |
| `sfind-c8635c703fbb47b6a3920edf4bdc1902` | SARIF | **V15** | PyYAML 5.3.1 affected by CVE-2020-14343 |
| `sfind-db55c1dd91584314a9ad953943373e96` | SARIF | V11 | Real-looking webhook HMAC secret embedded in source |
| `sfind-e32798676be24f6ba88118d847683c02` | SARIF | V13 | IAM policy grants all actions on all resources |
| `sfind-78905572f46a4d9f84b2fdd65c3baf5b` | SARIF | V13 | Postgres security group ingress open to the internet |
| `sfind-45bfe902b6764f769e12d6e0f9fe9337` | SARIF | V13 | S3 bucket allows public object reads |
| `sfind-38d94bc8474643c885e47b8e2114a683` | SARIF | V13 | Database publicly accessible without storage encryption |
| `sfind-85c9e024dd6c4cdda3cce99f3e6e390a` | SARIF | — | Redis client low-severity maintenance advisory |

**Pentest-only findings** (in the CSV, absent from the SARIF — the SAST tool could
not see them): `PT-001`, `PT-002`, `PT-004`. All three are cross-tenant,
financial-integrity or SSRF defects requiring multi-file reasoning, and all three
were independently re-confirmed against the code.

### Dismissed with a written reason — the signal-vs-noise beat

This is the strongest table in the deck. Each dismissal names the control that
makes the finding safe, at file and line.

| Finding ID | Inherited claim | Why it was dismissed |
|---|---|---|
| `sfind-b14af50a66054bb1801dfc41f24a3d9a` | SQL string concatenation → injection (**D1**) | The concatenated column comes only from the server-side allowlist `REPORT_COLUMNS` (`reports.py:9,27`); `tenant_id`/`customer` are bound parameters (`reports.py:32-34`). No attacker data reaches the SQL string. |
| `sfind-95fb028e51844aa8aaf957575c561178` | `eval()` → code injection (**D2**) | `run_expression()` hard-exits unless `HELIOS_DEV_CLI=1` (`cli.py:7`), default off, local CLI arg only, no HTTP entry point. |
| `sfind-996bffda4ab34ef897747a87be5fc88d` | Hardcoded API key (**D3**) | `MOCK_API_KEY` in `test/fixtures.ts:2` is a non-functional placeholder feeding a mocked partner client used only in tests. |
| `sfind-3b186f92f4354d42a01f39bb4ab5cf35` | `dangerouslySetInnerHTML` → XSS (**D5**) | `Notes.tsx:23` renders `DOMPurify.sanitize()` output (`Notes.tsx:14`). Explicitly contrasted with `InvoiceMemo.tsx`, which does the same render *without* sanitization and **stays open as V10**. |
| `sfind-6aa73fe99f7647618b5c8cc18b9a54fe` | Prototype pollution in transitive npm dep | Names no package or CVE; the cited lockfile line is inside a dev-only, optional `win32-arm64` native binding. The described condition does not exist. |
| `sfind-f170d2e0bb064859a55751df4916ceed` | Stored HTML executes in invoice console | Duplicate of SARIF V10, which is rated higher and stays open. Defect not suppressed. |
| `sfind-34c3d8547ef841fdaddd323b50d0f235` | Public S3 document bucket | Duplicate of SARIF V13-S3, which stays open. Defect not suppressed. |
| 28 further `low` entries | Style/informational noise (verbose health endpoint, etc.) | Closed as non-security noise. |

Note the discipline in the two duplicate rows: the swarm dismisses the *ticket*
and says in writing that the *vulnerability* remains reported elsewhere. That is
the answer to "how do I know you are not just closing my backlog?"

---

## Ingestion-mode — runtime-validated rerun

Same profile (`csprof-ee00702ca1604625a59496ac19da0c1c`, mode `ingest`), updated
in place with runtime-validation and reporting guidance. Same two in-repo sources
(41 SARIF results + 6 pentest CSV rows).

| Field | Result |
|---|---|
| Scan link | https://partner-workshops.devinenterprise.com/code-scan/cd8a2a4f35c64203954da85d3904fed7 |
| ACUs consumed | **22.32** (parent + 7 children) |
| Wall-clock | **~45m** (created 10:11:01 UTC → report written ~11:06 UTC) |
| Session count | **8** (1 parent + 7 children, incl. 2 runtime `validate findings` children) |
| Findings imported | **47** = 41 SARIF + 6 pentest CSV. Nothing silently dropped. |
| Kept open after triage | **11** (3 critical, 8 high) |
| Dismissed after triage | **36** (1 high, 7 medium, 28 low) |
| Noise reduction | **77%** of the inherited backlog closed with a written reason |

**The difference runtime validation makes to ingestion — this is the best beat in
the kit.** In the baseline ingestion run the three pentest-CSV-only findings were
kept open at their inherited severity. In the runtime rerun, all three were
**promoted to `critical` by the runtime validation stage** and moved to the top of
the report:

| Finding ID | Source | V-ID | Title | Sev |
|---|---|---|---|---|
| `sfind-2d0621ca9b724e208bea5a054ac678d4` | CSV `PT-001` | V02 | Invoice export exposes cross-tenant data | **critical** |
| `sfind-581172605e8d46a69fa8c7d9df94bd2f` | CSV `PT-002` | V03 | Refund requests can be double-spent | **critical** |
| `sfind-f7717aad335e41499f3b88f63d00c1a1` | CSV `PT-005` | V04 | Webhook redirect reaches internal metadata | **critical** |

Those are exactly the three defects a SAST tool could not see (they need
multi-file, multi-service and concurrency reasoning) — and they are now the top
three items in the report, ranked above every SARIF finding, because they are the
ones proven exploitable. That is the whole "signal, ranked by reality" argument in
one screen.

Kept open from SARIF (high): `sfind-6194e7727ee541c3b7478de20fe68ca4` (Postgres SG
open to internet), `sfind-4e163f19c3754f4f80b42e749d8dcfdb` (hardcoded webhook
HMAC), `sfind-426640ad1abd4ca9948588c86251514a` (public S3),
`sfind-4239a8ff44444a7db7ba01a7cff745c0` (wildcard IAM),
`sfind-3b2817b7b51d418aa07b1c5f22aa06fb` (**V15** — PyYAML 5.3.1 / CVE-2020-14343),
`sfind-36706bc50418490bb295d6c26b9da31d` (unsafe YAML loader),
`sfind-2f7f646c9d1b41d1a31b9906e3aabb24` (public + unencrypted RDS),
`sfind-12f9f5be5124457893ee0247d008a0f7` (stored XSS in invoice memo).

Decoys dismissed again, with reasons: `sfind-bfb4a5e660c3444fae0c12f215d92320`
(D5 sanitized `dangerouslySetInnerHTML`), `sfind-142c7fb67d61482fb1ac8f1c0f4fa634`
(D2 gated CLI `eval`), `sfind-4e94da62fb9344ff878f0d2eb2bcd41a` (D1 allowlisted
SQL concatenation), `sfind-5508f831f4434af2b83d5815bf3fde29` (D3 test-only mock
API key).

---

## Remediation

One finding was handed to Security Swarm for a fix, end to end.

| Field | Result |
|---|---|
| Finding | `sfind-0e9a974579b643b999885a1291e5e8cd` (V02, cross-tenant invoice export, high) |
| PR | **https://github.com/Cognition-Partner-Workshops/helios-pay/pull/2** |
| Branch | `devin/1788330935-export-invoice-tenant-check` |
| Commit | `20858da` |
| ACUs | 1.73 |
| CI | **4/4 green** (core-api, partner-gateway, ledger-worker, web) |

The diff is 6 lines of production code:

```python
 @router.get("/export")
-def export_invoice(invoice_id: uuid.UUID, db=Depends(get_db)):
+def export_invoice(
+    invoice_id: uuid.UUID,
+    claims: Claims = Depends(get_current_claims),
+    db=Depends(get_db),
+):
     invoice = db.get(Invoice, invoice_id)
     if invoice is None:
         raise HTTPException(status_code=404, detail="Invoice not found")
+    require_tenant(invoice, claims)
```

Three things worth pointing at on screen:

1. **It reused the codebase's own control.** `require_tenant(invoice, claims)` is
   the existing helper already used by `get_invoice` — not a bespoke inline check.
   The fix matches house style, so it survives review.
2. **It updated the test to assert the secure behaviour.** The old
   `test_export_leaks_cross_tenant` asserted `200` + a leaked row; it is now
   `test_export_enforces_tenant` (403, no leaked data) **plus** a new
   `test_export_own_tenant_invoice` (200 for your own invoice) proving the fix did
   not break the legitimate path. It did not delete the test to go green.
3. **404 vs 403 was preserved.** Missing invoices still 404; foreign-tenant
   invoices now 403.

> ⚠️ **Do not merge PR #2.** It is a demo artifact. Merging it removes V02 from
> the app and breaks the V02 exploit beat in `WALKTHROUGH.md` for the next demo.
> Show the diff and the green CI, then leave it open. If it is ever merged, revert
> on a branch to restore the vulnerable state.

---

## Fresh runs against `helios-pay`

Re-run on 2026-09-07 against `main` of this repository, with the same two
profiles as the recorded runs. This `main` is **post-V16** (command injection is
in) and **pre-remediation** (PR #2 is open, so V02 is still vulnerable), so it is
not directly comparable to the original baseline.

| Run | Scan link | ACUs | Sessions | Findings |
|---|---|---:|---:|---|
| Full (OWASP, runtime profile) | [scan-d503ef56](https://partner-workshops.devinenterprise.com/code-scan/d503ef56a2f845a69eb5bd160ef0070e) | 5.9 | 8 | 34 rows → **28 open** (8 critical, 14 high, 3 medium, 3 low), 6 dismissed as intra-scan duplicates |
| Ingestion (SARIF + pentest CSV) | [scan-010d097e](https://partner-workshops.devinenterprise.com/code-scan/010d097e5ea44eb1b5d57876bd8c1c7a) | — | — | 47 imported → **11 open** (3 critical, 8 high), 36 dismissed (1 high, 7 medium, 28 low) |

**The ingestion run reproduced the recorded result.** Same 47 inherited findings,
same triage shape, and the same duplicate-detection reasoning — for example the
pentest row PT-004 ("Public S3 document bucket") was dismissed as a duplicate of
SARIF rule `V13-S3` on the same `infra/terraform/s3.tf` lines, with the SARIF copy
kept as canonical. This is the run to show if anyone suspects the recorded
ingestion numbers were cherry-picked.

**The full run reached 15 of the 16 planted vulns**, missing only V15 (the
vulnerable PyYAML pin) — the same gap as both recorded discovery runs, for the
same reason (see "Honest gaps" #1). Confirmed present: V01 SQLi via `ORDER BY`,
V02 (as three findings — export BOLA, document-listing BOLA, document path
traversal), V03 refund TOCTOU, V04 SSRF (entry point, redirect-following, and the
bypassable blocklist), V05 unauthenticated admin router, V06 JWT `alg=none`, V07
copilot cross-tenant read, V08 `yaml.load` RCE, V09 Zip Slip, V10 stored XSS, V11
hardcoded HMAC key and JWT secret fallback, V12 predictable reset token, V13 IaC
(public S3, 5432 open to `0.0.0.0/0`, unencrypted RDS, publicly-accessible RDS,
`Action:*` on `Resource:*`), V14 mass assignment, V16 OS command injection.

One of those 15 is a **partial** hit worth stating accurately: on V07 the run
reported the cross-tenant read facet of the copilot endpoint but never named
prompt injection — the phrase appears nowhere in the run's findings. Do not claim
it caught the prompt-injection facet.

It also found a defect that was **not** planted: `POST
/auth/password-reset/request` returns the reset token in the HTTP response
(critical, account takeover of any user) — an amplifier of V12 that makes the
seed-brute-force step unnecessary. Nobody wrote that one deliberately, which
makes it a good answer to "does it only find what you told it to find?".

> ⚠️ **Do not present this run as runtime-validated.** It used the
> runtime-validated profile, but its findings carry no runtime evidence — no
> stack boot, no live request/response transcripts — and it cost 5.9 ACUs against
> the recorded runtime run's 39.4. Its orchestrator also stalled for ~90 minutes
> after the threat-model stage before producing findings (see "Honest gaps" #8).
> Treat it as a **static discovery run**, and use
> [scan-e888214a](https://partner-workshops.devinenterprise.com/code-scan/e888214a52b544a4ae3ebb4daa971b3d)
> when you need the runtime-validation beat.

---

## Honest gaps

Read these before you present. Every one of them is a better answer than a dodge.

1. **V15 (vulnerable pinned dependency, PyYAML 5.3.1 / CVE-2020-14343) was missed
   by *both* discovery runs** — the static baseline and the runtime-validated
   rerun. It was caught only by the ingestion runs
   (`sfind-c8635c703fbb47b6a3920edf4bdc1902` baseline,
   `sfind-3b2817b7b51d418aa07b1c5f22aa06fb` runtime). This is an honest and
   *useful* result: the OWASP Top 10 profile reasons about code reachability, not
   package inventory. If a CISO asks "does this replace my SCA tool?", the answer
   is no — and this repo proves it. Discovery found the *unsafe `yaml.load` call*
   (V08, critical) but not the *vulnerable version pin*. Complementary, not
   overlapping. **Runtime validation did not close this gap**, which is the
   sharper version of the same point.
2. **Runtime validation is evidenced at the stage level, not per-finding in this
   file.** What is independently verified: the validation children booted the
   full stack (`docker compose up -d --build`, all services healthy),
   authenticated via `POST /auth/login`, and issued live exploit requests against
   `localhost:8000` and `localhost:8090`. Per-finding request/response transcripts
   live on the scan pages, not in this document — if you want to show a specific
   exploit transcript on screen, open the finding in the UI during dry-run. Do not
   claim "every finding has an attached PoC transcript" from this file alone.
3. **Wall-clock for the runtime runs is scan-create → report-written and is
   approximate (±5 min).** The parent sessions idle in `waiting_for_user` after
   the report lands, which inflates any "last activity" reading. ACUs, session
   counts and finding totals are exact; treat the durations as indicative.
4. **No UI screenshots are embedded in this file.** The scan links above are the
   primary evidence, and the browser on the build machine could not reach the scan
   pages (SAML/Auth0 SSO). Capture your own during dry-run — the five worth having
   are the threat model, the session tree (use a runtime run: it shows the
   validate children), a validated finding with its exploit reasoning, a dismissed
   decoy (use the `Notes.tsx` vs `InvoiceMemo.tsx` one), and the PR #3 diff.
5. **Severity is re-derived, so it will not match your scanner's numbers.**
   The ingestion runs promoted and demoted inherited severities based on
   reachability — most visibly the three pentest-CSV findings promoted to
   `critical` in the runtime rerun. Expect to defend a specific re-rating; the
   written reason is on each finding.
6. **Finding counts differ between the five runs (30 / 47 / 32 / 47 / 38).** Rows
   are not defects: intra-scan duplicates are dismissed, and an agentic scanner
   splits or merges facets differently run to run. Count **distinct defects**. The
   stable claim is 15 planted vulns on the baseline `main` and 16 after V16, with
   14/15 and V16 found respectively, and **zero decoys ever reported as
   exploitable**.
7. **The scan parent sessions show `waiting_for_user`.** That is their idle state
   after writing findings, not an unfinished run. All five scans report
   `completed` in code-scan management.
8. **The fresh full run against this repo stalled, then recovered.** Its
   orchestrator finished the threat-model stage (17 repo-specific matchers, 108
   signals across 40 files) and then sat for ~90 minutes without launching an
   investigation session; it later completed on its own with the 34 findings
   above. A relaunch fired during the stall is still running and is a duplicate —
   ignore it. If a scan you launch live goes quiet after the threat model, that is
   the failure mode, and it is reported to Cognition. Do not launch a scan on
   stage during a demo; show a recorded run.
9. **PR #4 (this document) has no CI checks.** `.github/workflows/ci.yml` only
   triggers on `services/**`, `web/**` and the workflow file, so a docs-only
   change runs nothing. That is expected — it is not a green build, and it is not
   a broken one.
