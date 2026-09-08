# Helios Pay — Detailed Demo Walkthrough (run-of-show)

**Demo date:** _set before delivery_
**Length:** 25 minutes, 5 acts. Cut-down and deep-dive variants at the end.
**Audience:** CISO / Head of AppSec / platform leadership, plus a technical
lieutenant who will scrutinize the code.

This is the **minute-by-minute, click-by-click, say-this-out-loud narration**
for this repo — it is self-contained, so you can present from this file alone.
Every command, file path, button label, finding ID and number below is real and
matches this repo's code and the latest recorded scan in
[`SCAN-RESULTS.md`](SCAN-RESULTS.md).

> **Scan of record for this demo.** The primary run behind this script is the
> **deep, runtime-validated scan against this repo** (`helios-pay`):
> https://partner-workshops.devinenterprise.com/code-scan/3e7d46eeffcf4a51bcd680595a062619
> It fanned out to **40 agent sessions**, produced **28 findings** (7 P0 / 15 P1
> / 6 P2), **22 of them runtime-confirmed exploitable**, **0 false positives**,
> and — the new part — it validated **each finding in its own isolated sandbox**
> with its own freshly-booted stack and a standalone, replayable exploit script.
> All finding IDs below are from this run.
>
> One beat does **not** carry over — the V11 git-history recovery. This repo was
> created by migration (4 commits), so there is no add-then-remove secret history
> to show. Use the checked-in HMAC literal instead (see the deep-dive section).

Legend:
- 🖱️ **DO** — exactly where to click / what to type.
- 🗣️ **SAY** — words you can read aloud verbatim (paraphrase to taste).
- 💡 **WHY** — the point of the beat; what the room should feel.
- ⚠️ **WATCH** — failure mode + the recovery line so you never go silent.

---

## 0. Pre-flight (finish 10 minutes BEFORE the room)

Do this before anyone is watching. If a live scan is part of your plan, it must
be *started* here — a deep runtime-validated scan takes ~30–60 min, so you
present the **recorded** run above and, optionally, kick a fresh one at the top
of Act 2 to "have one cooking."

🖱️ **DO — bring the stack up and confirm it is green:**
```sh
cd helios-pay
cp .env.example .env      # first run only
make up                   # ~72s to boot + seed 3 tenants / 9 users / 201 invoices
curl -s localhost:8000/healthz && curl -s localhost:3000/healthz; echo
```
Expect HTTP 200 health payloads from both. Then:

🖱️ **DO — pre-warm every tab so nothing loads cold on stage.** Open, in order:
1. `http://localhost:3000` — the Helios Pay landing page (shows "201 invoices / 3 tenants / Local").
2. `http://localhost:3000/login` — leave it sitting on the login form.
3. A terminal, font size **18pt+**, in the repo root, `security/poc/` on `ls`.
4. The **deep runtime-validated scan** (scan of record): https://partner-workshops.devinenterprise.com/code-scan/3e7d46eeffcf4a51bcd680595a062619
5. The **remediation PR** (open, in this repo): https://github.com/Cognition-Partner-Workshops/helios-pay/pull/2
6. `demo/VULN-MAP.md` open in your editor **on your presenter screen only** — this is the answer key, never mirror it to the room.

🖱️ **DO — make the PoCs executable and smoke-test the two you will run live:**
```sh
chmod +x security/poc/*.sh
./security/poc/v02_bola.sh        # must print: PASS V02 ...
./security/poc/v07_prompt_injection.sh   # must print: PASS V07 ...
```
If both PASS in pre-flight, they will PASS on stage. If either fails, run
`make reset` (see [`RESET.md`](RESET.md)) and re-seed before the room fills.

⚠️ **WATCH:** if `make up` stalls, it is almost always host port 5432 already in
use — Helios keeps Postgres internal to Compose on purpose, so this is a *host*
Postgres conflict, not ours. If the console shows "Failed to fetch" on login, or
`curl localhost:3000` resets, you are on un-patched `main` — pull the setup fix
([`helios-pay` #4](https://github.com/Cognition-Partner-Workshops/helios-pay/pull/4)).
See [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) for both.

---

## Act 1 — The target: this is a real system, not a snippet (0–3 min)

**Goal of the act:** establish stakes. The room must believe this is the kind of
codebase they actually ship, so that finding bugs in it *means something*.

🖱️ **DO:** Present the landing page tab (`http://localhost:3000`). Point at the
three stat cards: **201 invoices**, **3 tenants (Acme, Globex, Initech)**,
**Local**.

🗣️ **SAY:**
> "This is Helios Pay — a multi-tenant B2B payments and invoice-financing
> platform. Three tenant companies share one deployment. There's real money
> movement: invoices, partner payouts, a settlement ledger. And it's polyglot,
> like yours — a Python FastAPI core API, a TypeScript partner gateway, a Go
> ledger worker, and a Next.js operator console. Four languages, one repo. Hold
> that thought, because that's exactly where scanners fall down."

🖱️ **DO:** Click **Sign in** (top-right nav) → you land on `/login`. The form is
**pre-filled** with `viewer@acme.example` / `Password123!`. Click **Sign in**.
You are redirected to `/invoices`.

🗣️ **SAY (as the invoice register loads):**
> "I'm logged in as a *viewer* at Acme — the lowest-privilege role. This is the
> billing register for Acme's tenant. Notice the record count in the corner —
> the app is showing me *only* Acme's invoices. Tenant isolation is the entire
> security model of a platform like this. Remember that promise. We're going to
> break it twice in the next ten minutes — once through the API, once through
> the AI assistant."

🖱️ **DO:** Click any invoice number (e.g. the first row) → `/invoices/{id}`.
Point at: the **customer name**, the **Total due** card, the **memo**, and the
right-hand **Support Copilot** panel with its **Summarize** button.

🗣️ **SAY:**
> "Invoice detail. Customer, amount, a free-text memo, and an AI 'Support
> Copilot' that summarizes the memo for a support agent. Keep the Copilot in
> mind — it's the newest feature and, like most AI features bolted onto real
> apps, it has the least security review."

💡 **WHY:** You've planted three loaded guns in plain sight — tenant isolation,
the memo field, the Copilot — and told the room to watch them. Payoff lands in
Act 3.

---

## Act 2 — Unleash the Swarm (3–8 min)

**Goal of the act:** show the *method* — parallel agents that read the whole
repo, reason about reachability, and then **prove each finding live in its own
isolated sandbox** — while a scan is visibly in motion.

🖱️ **DO:** Switch to the Security Swarm scan tab. If you are starting a fresh
scan live, start it now against `helios-pay`, branch `main`, deep effort,
runtime-validated profile. Otherwise open the **recorded deep run** and show its
session tree:
https://partner-workshops.devinenterprise.com/code-scan/3e7d46eeffcf4a51bcd680595a062619

🗣️ **SAY (while the session tree is on screen):**
> "Here's what's happening. This isn't one regex pass over one file at a time.
> The Swarm fans out into parallel agents. One builds a threat model of the
> whole system first — where does untrusted input enter, where does money move,
> where do tenants touch. Then parallel investigator agents deep-dive batches of
> the code across all four languages at once. Then — and this is the part that's
> new — each candidate finding gets handed to its *own* validator agent in its
> *own* isolated sandbox."

🖱️ **DO:** Point at the fan-out shape (mirror the tree in `SCAN-RESULTS.md`):
```
Security scan helios-pay        (parent, deep effort)
├── Threat Model                ← maps the attack surface first
├── Investigate Batch 0 ┐
├── Investigate Batch 1 ├ parallel deep-dives across Python/TS/Go/Next/Terraform
├── Investigate Batch 2 ┘
├── validate <finding-a>        ┐ each finding gets its OWN sandbox:
├── validate <finding-b>        │ fresh `docker compose up`, live exploit,
├── validate <finding-c>        ┘ saved PoC + request/response transcript, teardown
└── Aggregate                   ← dedups, re-severities, writes findings
```

🗣️ **SAY:**
> "Three things I want to set as expectations before we look at results. First:
> the goal is *not* the biggest finding count. A tool that prints 500 findings
> has just moved the work onto your team. The goal is a *defensible* set —
> reachable, evidence-backed. Second: this run didn't just read the code. Every
> validated finding got its own clean sandbox, its own booted copy of this
> stack, and a live authenticated exploit — so the reproductions don't leak into
> each other and each one is a self-contained thing I can hand you. Third: when
> it *couldn't* prove something at runtime, it said so instead of guessing."

💡 **WHY:** You're pre-empting the three objections every scanning tool eats:
"more noise," "how do you know it's real," and "is it just hallucinating
findings." Numbers to have ready from `SCAN-RESULTS.md` for this deep run:
**40 agent sessions, ~9.6 ACU, 28 findings (7 P0 / 15 P1 / 6 P2), 22
runtime-confirmed exploitable, 0 false positives.** Headline chain: **anonymous
→ RCE** and **anonymous → full AWS account takeover** both proven in the modeled
chain, with the `alg=none` JWT bypass as the master key.

💡 **WOW MOMENT #0 (new) — one isolated sandbox per finding.** Open one
`validate <id>` child session and show it booted its *own* stack and saved a
standalone exploit script + full HTTP transcript. This is the answer to "does it
actually reproduce these, or just claim them?" — you can replay any single
finding on its own, and explain to the room exactly how an attacker would.

---

## Act 3 — Cross-file findings, proven live (8–16 min)

**This is the technical-credibility core.** Three findings, each a live PoC,
each a bug that a single-file/regex scanner structurally cannot find. Run them
in this order — it builds from "API bug" to "AI bug" and keeps rising. Each
finding ID below was validated in its own isolated sandbox on the deep run.

### 3a. V02 — Cross-tenant data theft (BOLA) · ~2.5 min

🗣️ **SAY (set it up before running):**
> "Remember the promise from Act 1 — a viewer at Acme sees only Acme. Watch me
> break it. I'll log in as an Acme viewer, find an invoice that belongs to
> *Globex* — a different tenant — and export it anyway."

🖱️ **DO:** Run:
```sh
./security/poc/v02_bola.sh
```
Expected output (read the PASS line aloud):
```
PASS V02: Acme viewer exported Globex invoice <uuid> (Globex Customer …)
```

🗣️ **SAY:**
> "That's a Globex customer's invoice, pulled by an Acme user. Full cross-tenant
> breach. Now *why* does this happen — and this is the part your current tools
> miss."

🖱️ **DO:** Open `services/core-api/app/routers/invoices.py` and its sibling
`routers/documents.py` side by side on screen.

🗣️ **SAY:**
> "The normal `GET /invoices/{id}` handler calls `require_tenant()` — it checks
> the invoice belongs to your tenant. But the *export* handler right next to it
> loads the record by ID and forgets that one call. There's no signature for
> 'this function forgot the check that its sibling remembered.' You can only
> catch this by reasoning across files about what *should* be enforced. The
> Swarm flagged it as `sfind-4b9ba597a1dc422aa13a21b6d0f6b047` (BOLA in
> `GET /invoices/export`) — and it found the *same* class of gap on the document
> list/download path, `sfind-94d9da12f28241c7a439817f8b2c4131`."

💡 **WOW MOMENT #1 — reachability, not pattern-matching.** The bug is an *absent*
line, not a present one. Grep can't find an absence.

### 3b. V01 — Multi-hop SQL injection across four files · ~2.5 min

🗣️ **SAY:**
> "Second one. Classic SQL injection — except it's laundered through four files
> and a function literally named `safe_ident`."

🖱️ **DO:** Run:
```sh
./security/poc/v01_sqli.sh
```
Expected: two PASS lines — an invalid `ORDER BY` identifier surfaces a raw
Postgres error, and a boolean `ORDER BY` expression is accepted.

🖱️ **DO:** Trace the chain on screen (four files, in order):
`routers/invoices.py` → `schemas/invoice.py` → `services/search.py` →
`db/query_builder.py`.

🗣️ **SAY:**
> "The taint enters at the invoice search `sort` parameter, flows through the
> DTO, through the search service, and lands in raw SQL in the query builder.
> There's a sanitizer, `safe_ident()` — but it escapes *quotes*, which does
> exactly nothing when the value is dropped into an `ORDER BY` *identifier*
> position. It *looks* defended. A tool that trusts a function called
> `safe_ident` walks right past it. The Swarm followed the data three hops,
> understood the sink was an identifier context, and rated it **critical** —
> `sfind-449e218525ea4baea965c7dcb2b5180e`."

💡 **WHY:** This is the "our SAST would never" beat for the technical lieutenant.
Four-file taint + a decoy-named sanitizer is the exact shape their tools miss.

### 3c. V07 — Prompt injection → cross-tenant exfiltration via the Copilot · ~3 min

This is the closer for the act and the one execs remember. Do it **in the
browser** so the room sees the AI feature betray its tenant, then explain.

🖱️ **DO:** Run the scripted proof first (deterministic, no API key needed):
```sh
./security/poc/v07_prompt_injection.sh
```
Expected:
```
PASS V07: copilot summary leaked foreign invoice data: "… Globex Customer …"
```

🗣️ **SAY:**
> "Same broken promise as V02 — but through the AI. An attacker writes an
> invoice memo that embeds a *Globex* invoice id. The Copilot's summarize flow
> calls an internal `lookup_invoice()` tool that has database access but **no
> tenant scoping**. So the assistant cheerfully reads another tenant's invoice
> and pastes its customer and amount into the summary. Prompt injection driving
> an unscoped tool call, across the web app and the core API — finding
> `sfind-698d48d653034af5afcfc286dd809bb1`."

💡 **WOW MOMENT #2 — the AI-security beat.** Every CISO in 2026 is being asked
"are we safe to ship AI features." This is a concrete, reproduced answer:
the risk isn't the model, it's the *unscoped tool* behind it — and the Swarm
traced web UI → copilot router → tool (`copilot.py` → `copilot_tools.py`) to
prove it.

⚠️ **WATCH:** if a live browser Copilot click is flaky, the script above is the
canonical proof — lead with it and treat the UI click as garnish.

---

## Act 4 — Signal vs. noise: the decoys it refused to flag (16–21 min)

**Goal of the act:** prove judgment. Anyone can find bugs; the trust comes from
what it *declines* to alarm on. This is where you defeat "great, more noise."

🖱️ **DO:** Open these three decoys on screen, one at a time:

1. **D1 — looks like SQLi, isn't.** `services/core-api/app/routers/reports.py`.
   🗣️ "This builds a query with string concatenation — every SAST tool lights up
   red. But read it: the only things concatenated are *static, allowlisted
   column names*; every user value is a bound parameter. The Swarm read it,
   understood the values were parameterized, and stayed silent. Zero alert."

2. **D5 — the safe twin of V10.** `web/components/Notes.tsx` vs
   `web/components/InvoiceMemo.tsx`.
   🗣️ "Two components, both render HTML. `InvoiceMemo` uses
   `dangerouslySetInnerHTML` raw — that's our real stored-XSS, flagged as
   `sfind-6d09bb4a6665462d916e6c9e52a3fb42`. `Notes` runs the *same* data
   through DOMPurify first. Same repo, same-looking code, one dangerous and one
   safe. The Swarm flagged the first and used the second as the *proof* that the
   sanitization was simply omitted. That's the difference between reading tokens
   and reading meaning."

3. **D2 — the guarded `eval`.** `services/core-api/app/cli.py`.
   🗣️ "There's a literal `eval()` in here — catnip for a scanner. But it's behind
   a `HELIOS_DEV_CLI=1` guard, it's not wired to any route, and it's off in
   Compose. Not reachable in the running app. Cleared, never flagged."

🗣️ **SAY (the punchline):**
> "Here's the number that matters. We planted **seven** decoys designed to trip
> a scanner. Across every run, the Swarm flagged **zero** of them as
> exploitable — this deep run reported **0 false positives** out of 28 findings.
> And to make the contrast brutal, this repo ships a synthetic baseline from a
> legacy scanner — `security/baseline/helios-sast.sarif`, **41 findings** of
> noise, duplicates and those very decoys. When we fed that backlog into
> ingestion mode, the Swarm triaged it down to the real ones and dismissed the
> rest **with a written reason per finding**. That's your triage backlog,
> cleared."

💡 **WOW MOMENT #3 — 0/7 decoys + 0 false positives, plus 47-finding backlog
triaged.** Numbers from `SCAN-RESULTS.md`: ingestion imported **47** (41 SARIF +
6 pentest CSV), kept **11**, dismissed **36** with reasons — a **~77% noise
reduction**. Ingestion run:
https://partner-workshops.devinenterprise.com/code-scan/010d097e5ea44eb1b5d57876bd8c1c7a

---

## Act 5 — Remediation + the pilot close (21–25 min)

**Goal of the act:** land the operating model and ask for the pilot.

🖱️ **DO:** Open the remediation PR — still open, in this repo:
https://github.com/Cognition-Partner-Workshops/helios-pay/pull/2
Show the diff (the added `require_tenant()` check on the export route), the
plain-English explanation, and the **green CI checks**.

⚠️ **WATCH:** Leave this PR **unmerged**. Merging it fixes V02 for real and
kills the Act 3 cross-tenant beat for every future demo. If someone in the room
asks you to merge it, that is a great moment to say "a human owns that decision —
and today that human is you."

🗣️ **SAY:**
> "This is the part that changes your team's day. The Swarm didn't just file the
> cross-tenant bug from Act 3 — it opened this pull request that *fixes* it. One
> focused diff: it adds the missing tenant check to the export route. Tests are
> green. A developer's job here is thirty seconds of review, not an afternoon of
> investigation. And notice what it did *not* do: it did not merge. Agents
> investigate and prove and propose; CI gates; a human keeps merge authority.
> That's the operating model."

🖱️ **DO:** Bring up the economics line from `SCAN-RESULTS.md`.

🗣️ **SAY:**
> "Cost of what you just watched: this deep, runtime-validated run — 40 agent
> sessions that booted the app in an isolated sandbox per finding and exploited
> each one live — was about **9.6 ACUs**. That is the price of 28 findings, 22
> of them proven exploitable, with a replayable script for each. Proof, not a
> pile of maybes."

🗣️ **SAY (the close — ask for the pilot):**
> "So here's what I'd propose. Pick one real repository — ideally polyglot, one
> that your current scanner floods you on. We point the Swarm at its default
> branch, run it against your existing backlog in ingestion mode, and you judge
> it on two things: did it find something your tools missed, and did it clear
> noise you're currently paying people to triage. Which repo should we start
> with, and who owns its security backlog today?"

💡 **WHY:** The close is a *specific, small, measurable* next step with an owner
question — not "what did you think." That's what turns a demo into a pilot.

---

## The chained-exploit beat (the strongest single technical moment)

Use this when the room asks "so what's the *worst* case here?" or wants the
red-teamer's view. The deep run didn't just list findings — it composed them
into a single kill chain and proved the hops live.

🗣️ **SAY:**
> "A developer added an operator 'connectivity check' that pings a partner
> host."

🖱️ **DO:** Show `services/core-api/app/routers/diagnostics.py` (the `host` value
is interpolated into an f-string and run with `shell=True`). Then prove it:
```sh
./security/poc/v16_command_injection.sh    # returns injected uid= output
```

🗣️ **SAY:**
> "The Swarm caught this as **critical** OS command injection —
> `sfind-8e985b1aa5d7431a94266113f60e6655` — and here's the kicker: it didn't
> just find the injection, it *chained* it. It connected this to the `alg=none`
> JWT bypass — `sfind-529ab54e5d964006b844c09c7368d0e0`, its 'master key' — so
> the 'authenticated' endpoint is reachable with a forged, unsigned token. And
> it connected that to the wildcard IAM role —
> `sfind-1d5a6cca9ca44ff9b898633576cb9412`, `actions=["*"]` on `resources=["*"]`
> — so code execution on the app means the whole AWS account. Three separate
> findings composed into one **anonymous-to-RCE and anonymous-to-full-AWS-account-takeover**
> path. That is what a senior red-teamer does, and it did it here."

💡 **HONEST CAVEAT to deliver in the same breath (this builds trust):**
> "One thing I want to be straight about: the JWT bypass and the command
> injection were reproduced *live* in their own sandboxes. The wildcard-IAM hop
> was recorded as **static-only** — the `*:*` policy is genuinely in
> `infra/terraform/iam.tf`, but this local demo stack has no real AWS identity
> attached, so the Swarm did not fake an account-takeover it couldn't actually
> exercise. It told us that instead of dressing it up. That distinction — proven
> vs. reasoned — is exactly what you want from a tool you're going to trust."

💡 This is the strongest single technical moment in the kit if the audience is
deeply technical. Same scan of record:
https://partner-workshops.devinenterprise.com/code-scan/3e7d46eeffcf4a51bcd680595a062619

---

## Five-minute cut-down (hallway / exec drive-by)

1. 🖱️ Landing page → login (prefilled) → invoices → one invoice detail. 🗣️
   "Multi-tenant payments platform, four languages, real money."
2. 🖱️ `./security/poc/v02_bola.sh` → read the PASS line. 🗣️ "Acme user just
   stole a Globex invoice — cross-tenant breach the Swarm found by reasoning
   across sibling files, then proved live in its own sandbox."
3. 🖱️ Open the remediation PR. 🗣️ "It also opened the fix, tests green, human merges."
4. 🗣️ "28 findings, 22 proven exploitable, zero false positives, zero of seven
   planted decoys flagged. Which repo do we start on?"

(Swap V02 for `./security/poc/v07_prompt_injection.sh` if the audience is there
for the AI-security angle.)

---

## 45-minute deep dive (technical audience)

Run the full 25-minute flow, then:

1. Walk **all 16 vulnerabilities and all 7 decoys** in
   [`VULN-MAP.md`](VULN-MAP.md).
2. Run the chained-exploit beat live (above) and explain the V16 + V06 (`alg=none`)
   + V13 (wildcard IAM) chain, including the honest static-only caveat on the IAM
   hop.
3. Open a single `validate <id>` child session in the scan and show its isolated
   sandbox: the fresh `docker compose up`, the live exploit, the saved standalone
   PoC script + full request/response transcript. Contrast two:
   - **JWT predictable-secret fallback** (`sfind-9aad37d63d8a4139ae4b134e6b6980bd`)
     → **confirmed**: booted with `HELIOS_JWT_SECRET` unset, forged HS256
     admin/operator tokens as a viewer, got 200s where a viewer normally gets 403.
   - **Wildcard IAM** (`sfind-1d5a6cca9ca44ff9b898633576cb9412`) → **static-only /
     inconclusive**, honestly recorded, not dismissed. This is the exact
     honest-classification behavior you can show a CISO.
4. Open the ingestion-mode run and walk the triage of
   `security/baseline/helios-sast.sarif` (41 results) +
   `security/baseline/pentest-findings.csv` (6 rows) — 47 imported → 11 kept, 36
   dismissed with a written reason each.
5. Inspect the IaC misconfigs in `infra/terraform/` — beyond the wildcard IAM,
   the deep run also flagged public RDS (`sfind-846ca2e58d9c4e6881a3c12c49c98d26`),
   a 0.0.0.0/0 Postgres security group (`sfind-2946b0fef6e341b4a6c73085bdf88a26`),
   and a world-readable S3 documents bucket (`sfind-1daede5784ba45b98d3194b454ac2f46`).
   Then show the hardcoded webhook HMAC key (V11) — checked in as a literal
   default:
   ```sh
   grep -n -i hmac services/partner-gateway/src/config.ts
   ```
   ⚠️ **The git-history half of V11 cannot be demoed any more.** That beat relied
   on add-then-remove commits for `infra/terraform/secrets.auto.tfvars` surviving
   in the original `helios-pay-demo` repo, which has been deleted. This repo was
   created by migration, so its history is 4 commits and
   `git log -p -- infra/terraform/secrets.auto.tfvars` returns nothing. Do not
   promise "we can recover the secret from history" on stage. Make the point
   about history verbally instead:
   > "Secrets like this one usually also survive in git history long after
   > someone deletes the file — the Swarm reads history, not just the working
   > tree."
6. Open Q&A on pilot success criteria.

---

## Hard questions — have these ready

**"SAST drowns us in false positives. How is this different?"**
> Reachability analysis plus decoy reasoning. Point at D1/D2/D5 declined *with
> written reasons* while V01/V07/V10 are caught. This deep run: **0 false
> positives** across 28 findings, 0/7 planted decoys ever flagged, and the
> 47-finding legacy backlog triaged to 11 real. Every real finding ships a
> runnable PoC with captured output in `VULN-MAP.md`.

**"Can it find the cross-file / cross-service bugs our tools miss?"**
> Yes, and that's the whole point. V01 spans four files; V02 is a sibling-route
> authorization gap; V04 is a time-of-check/time-of-use SSRF across two files
> (`sfind-35c90b619af74de489250fa07823b539`); V07 is prompt injection driving an
> unscoped tool call across the web app and core API. All reproduced live in
> isolated sandboxes.

**"How do I know it isn't hallucinating findings?"**
> Because each one was validated in its own sandbox with a replayable script and
> a full HTTP transcript — and when it *couldn't* prove impact at runtime (the
> wildcard-IAM hop), it recorded that as static-only instead of claiming a
> takeover. Proven and reasoned findings are labeled differently. You can replay
> any one of them yourself.

**"Does it actually save time — can it fix things, or just file tickets?"**
> It opens CI-gated remediation PRs a human reviews in seconds — the remediation
> PR is the proof, one focused diff, tests green. And it triages your existing
> backlog: 47 inherited findings → 11 real, in ingestion mode, with reasons.

**"Is my code safe / does it leave the building?"**
> This is a local-only demo; for a pilot, discuss deployment model and data
> handling with Cognition — route security-questionnaire specifics to them.

**"Does this replace my SCA / dependency scanner?"**
> No — and the demo proves it honestly. Discovery reasons about code
> reachability, not package inventory: the vulnerable PyYAML pin (V15,
> CVE-2020-14343) is caught by ingestion, not by the OWASP discovery profile.
> Complementary, not a replacement. (Details in `SCAN-RESULTS.md` → "Honest gaps.")

---

## One-screen cheat sheet (print this)

| Beat | Command / click | Say in one line |
|---|---|---|
| Login | `localhost:3000` → Sign in (prefilled `viewer@acme.example`) | "Lowest-priv user, sees only Acme." |
| V02 BOLA | `./security/poc/v02_bola.sh` | "Acme user stole a Globex invoice." |
| V01 SQLi | `./security/poc/v01_sqli.sh` | "Injection laundered through 4 files past `safe_ident`." |
| V07 prompt inj | `./security/poc/v07_prompt_injection.sh` | "AI Copilot leaked another tenant's invoice." |
| Decoys | open `reports.py`, `Notes.tsx`, `cli.py` | "0/7 decoys, 0 false positives — judgment, not grep." |
| Isolation | open a `validate <id>` scan session | "Every finding proven in its own sandbox, own script." |
| Remediation | remediation PR (this repo, #2 — leave open) | "It opened the fix; human merges." |
| Chain | `./security/poc/v16_command_injection.sh` | "RCE + `alg=none` + wildcard IAM → account takeover." |
| Close | — | "28 found, 22 proven, 0 FP. Which repo do we pilot?" |

**Scan of record:** https://partner-workshops.devinenterprise.com/code-scan/3e7d46eeffcf4a51bcd680595a062619
**Never on the room's screen:** `demo/VULN-MAP.md` and this file's presenter
notes. Keep those on your laptop only.
