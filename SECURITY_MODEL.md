# Helios Pay — security model

The security model of `Cognition-Partner-Workshops/helios-pay`, written for security scans and triage of imported findings (the HeliosSAST SARIF and the pentest CSV in `security/baseline/`). Built at `5ad1a6c` from `README.md`, `SECURITY.md`, `docker-compose.yml`, `.env.example`, `services/*`, `web/` and `infra/`.

> `SECURITY.md` says Helios Pay is **intentionally vulnerable** and meant to run only on an isolated local or workshop network. The system owner chose to judge it as production.

## System overview and components

Helios Pay is a multi-tenant B2B payments and invoice platform. Tenants (`acme`, `globex`, `initech`) share one Postgres database. Rows are separated only by `tenant_id`.

| Component | Code | Role |
|---|---|---|
| **Web console** | `web/` | Next.js 14 operator console and Support Copilot UI (:3000). Keeps the JWT client-side. |
| **Core API** | `services/core-api/` | FastAPI (:8000). Auth, users, invoices, documents, imports, reports, copilot, diagnostics, admin. Owns the schema (Alembic). |
| **Partner gateway** | `services/partner-gateway/` | Express/TypeScript (:8080). Partner webhook registration and outbound HMAC-signed callbacks. |
| **Ledger worker** | `services/ledger-worker/` | Go (:8090). Ledger balances and refunds (money movement), on Postgres and Redis. |
| **Infrastructure** | `infra/terraform`, `infra/helm`, `docker-compose.yml`, `.env.example`, `Makefile`, `.github/workflows` | AWS VPC/SG, RDS, S3 documents bucket, IAM, Helm chart, compose stack, seed bring-up, CI/deploy. |

### Trust boundaries
- Internet → web (:3000), core-api (:8000) and partner-gateway (:8080).
- Internal network → ledger-worker (:8090) and core-api `/admin/metrics`: internal-only in a real deployment (owner's decision), although `docker-compose.yml` publishes :8090 and redis (:6379) to the host.
- Service → Postgres: one shared `helios` database. Every service uses the same superuser / RDS master account.
- Tenant ↔ tenant: isolation is application-enforced only (`require_tenant` in `app/services/authz.py`, or `tenant_id` filters in queries).
- Partner gateway → arbitrary partner URLs (outbound webhooks). In AWS, the instance metadata service is reachable; in compose, the `metadata` service stands in for it.
- Core API → LLM (copilot; `HELIOS_LLM_MODE=stub` by default). Invoice memo text reaches the model and its tools.

## Entry points and who can reach them
- **Unauthenticated, internet:** `POST /auth/login`, `POST /auth/password-reset/request|confirm`, `/healthz`, and `/legacy/debug` when `HELIOS_ENABLE_LEGACY` is on.
- **Unauthenticated, internal network only:** `GET /admin/metrics` (the admin router is mounted without `get_current_claims` in `app/main.py`) and ledger-worker `/refunds` (no auth in `cmd/server.go`).
- **Any authenticated role** (`get_current_claims` in `app/core/deps.py`, applied per router in `main.py`): copilot, diagnostics, documents, imports, invoices, reports and users. Role checks (`require_role`) and tenant checks (`require_tenant`) are applied per route, not globally.
- **Partner gateway:** `requireAuth` in `src/middleware/auth.ts` verifies the JWT (HS256, audience `helios`) but checks no role or tenant.
- The JWT secret `HELIOS_JWT_SECRET` is shared by core-api and partner-gateway, and both have hardcoded fallbacks.

## Assets and data sensitivity
- **Tenant billing data:** invoices, statements/documents, payments and ledger balances. Refunds move money. Highest sensitivity.
- **Credentials and keys:** `users.password_hash`, password-reset tokens, the JWT signing secret, the webhook HMAC key, and the DB master credentials.
- **Infrastructure:** RDS instance, S3 documents bucket, IAM roles, and cloud metadata credentials.

## Attacker profiles
- **Who can get an account (owner's decision):** anyone on the internet, through public sign-up. An attacker with a low-privilege account is therefore as likely as an anonymous one.
- Unauthenticated internet attacker reaching the public services: web console, core-api and partner-gateway.
- Low-privilege user (`viewer`) in one tenant, after another tenant's data or a higher role.
- `operator` in one tenant (can create invoices, upload statements and run bulk imports).
- Malicious partner or webhook destination (SSRF, redirect chains, oversized responses).
- Content-injection attacker writing invoice memo text (stored XSS in the console, prompt injection into copilot tools).
- Attacker already inside the internal network, for the internal-only surfaces below.

## Existing controls
- The signed JWT branch pins `algorithms=["HS256"]` and `audience="helios"` (`app/core/security.py`, `src/middleware/auth.ts`).
- Passwords are hashed with bcrypt.
- `require_role` and `require_tenant` helpers exist.
- Most data access goes through the SQLAlchemy ORM.
- CORS is limited to an allow-list (`HELIOS_CORS_ORIGINS`).
- Webhook URLs pass a denylist guard (`src/lib/urlguard.ts`; substring-based).
- Postgres is not published to the host in compose.

## Security Invariants
- **Authentication (CWE-287, CWE-347, CWE-306):**
  - Every non-public route depends on `get_current_claims`.
  - `decode_token` verifies HS256 with the configured secret and audience, never trusting the token header's `alg`.
  - No service starts with a default secret (`app/core/config.py`, `src/middleware/auth.ts`).
  - Ledger-worker routes verify the same JWT.
  - **Gaps:** the `alg=none` branch, the fallback secrets, and the unauthenticated `/admin/metrics` and `/refunds`.
- **Authorization and tenant isolation (CWE-639, CWE-862, CWE-915):**
  - Every lookup by id calls `require_tenant` or filters by `claims.tenant_id` in the query.
  - Users can change only their own record unless they are admin.
  - Update schemas (`app/schemas/user.py`) never accept `role` or `tenant_id`.
  - Partner-gateway write routes check role.
  - **Gaps:** invoice export, documents, copilot, users PATCH and statement upload.
- **Injection (CWE-89, CWE-78):**
  - SQL goes only through SQLAlchemy expressions or bound parameters.
  - `ORDER BY` columns and direction come from an allow-list, never from `safe_ident()` plus `text()` in `app/db/query_builder.py`.
  - User input never reaches a shell (`routers/diagnostics.py`).
- **Deserialization (CWE-502):** imports use `yaml.safe_load`, never `yaml.Loader` (`app/services/bulk_import.py`).
- **SSRF and egress (CWE-918):**
  - `src/lib/dispatch.ts` resolves the destination and rejects private, loopback and link-local addresses.
  - It re-checks every redirect hop (or disables redirects), sets timeouts and caps response size.
  - A substring denylist (`urlguard.ts`) is not sufficient.
- **XSS (CWE-79):**
  - React escapes output by default.
  - `dangerouslySetInnerHTML` (`web/components/InvoiceMemo.tsx`) is the escape hatch: its input must be sanitized, or rendered as text.
- **Path traversal and file handling (CWE-22, CWE-409):**
  - Document paths resolve inside the storage root (`app/services/storage.py`).
  - ZIP extraction rejects members whose paths leave the target directory, and enforces size and ratio limits.
- **Secrets and cryptography (CWE-798, CWE-321, CWE-337, CWE-640):**
  - No secret defaults (`app/core/config.py`, `services/partner-gateway/src/config.ts`).
  - Reset tokens come from `secrets` and are never returned to the caller (`app/services/reset.py`, `routers/auth.py`).
  - Webhooks are signed per partner.
  - Seeded accounts never share a published password (`app/seed.py`, `web/app/login/page.tsx`).
- **Money movement (CWE-367, CWE-682, CWE-1284):**
  - Refund amounts are positive and no larger than the balance.
  - The balance check and the ledger write happen in one transaction under a row lock.
  - The current balance is the latest entry, chosen deterministically (`internal/ledger/service.go`, `internal/ledger/repo.go`).
- **LLM tools (prompt injection):**
  - Copilot tools are scoped to the caller's tenant.
  - Memo text is treated as data, never as instructions (`app/services/copilot_tools.py`).
- **Infrastructure (CWE-668, CWE-250):**
  - RDS is not publicly accessible, and no security group opens 5432 to `0.0.0.0/0` (`infra/terraform/network.tf`, `rds.tf`).
  - Applications use a least-privilege DB role.
  - The S3 documents bucket is private. `infra/terraform/s3.tf` sets it `public-read` (HeliosSAST `V13-S3`, pentest `PT-004`).

## Decisions from the system owner
- **Treat as production:** internet-facing, with real tenants and real money. The demo framing in `SECURITY.md` and `demo/SETUP.md` does not lower any finding.
- **Internal-only surfaces:** the ledger worker (`/refunds`, :8090) and core-api `/admin/metrics` are internal-only in a real deployment. An internet attacker cannot reach them directly; they matter for an attacker already inside the network, or one who gets there through another flaw (for example SSRF from the partner gateway).
- **Triage scope:** weed out duplicates and false positives. Seeded accounts and default secrets stay in scope.
- **Style notes:** HeliosSAST `STYLE*` results (code style, no security claim) are dismissed as not actionable.
- **Pentest vs SAST overlap:** a pentest row and a HeliosSAST result for the same flaw at the same location (e.g. `PT-003`/`V10`, `PT-004`/`V13-S3`) are duplicates: keep the more complete one open, dismiss the other as duplicate.

## Out of scope / accepted risk
- None. The owner ruled nothing out and accepted no risk.

## Open questions
- Which assets matter most? Until the owner says, tenant billing data and money movement are assumed to rank highest.
