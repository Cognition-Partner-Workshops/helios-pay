# Helios Pay — threat model

**Scan:** deep security scan of the whole repository, all vulnerability classes (no threat focus). User priorities: cross-tenant data, cloud account access, cross-service attack paths, AI chatbot prompt injection and exfiltration.

Built from `Cognition-Partner-Workshops/helios-pay` at `5ad1a6c` and extended at `888f830` for the statement service (PR #21). Sources: `README.md`, `SECURITY.md`, `docker-compose.yml`, `.env.example`, `services/*`, `web/`, `infra/`, `.github/workflows/`, `security/poc/v17_*`, `security/poc/v18_*`.

> `SECURITY.md` says Helios Pay is **intentionally vulnerable** and meant to run only on an isolated local or workshop network. The user chose to judge it as production, as Claude Security's assessments do.

## System overview and components

Helios Pay is a multi-tenant B2B payments and invoice platform. Tenants (`acme`, `globex`, `initech`) share one Postgres database. Rows are separated only by `tenant_id`.

| Component | Code | Role |
|---|---|---|
| **Web console** | `web/` | Next.js 14 operator console and Support Copilot UI (:3000). Keeps the JWT client-side. |
| **Core API** | `services/core-api/` | FastAPI (:8000). Auth, users, invoices, documents, imports, reports, copilot, diagnostics, admin. Owns the schema (Alembic). |
| **Partner gateway** | `services/partner-gateway/` | Express/TypeScript (:8080). Partner webhook registration and outbound HMAC-signed callbacks. |
| **Ledger worker** | `services/ledger-worker/` | Go (:8090). Ledger balances and refunds (money movement), on Postgres and Redis. |
| **Statement service** | `services/statement-service/` | PHP 8.5.11 on Apache mod_php (:80, published as :8095). Partner remittance-advice CSV upload (`POST /remittances/import`) and listing. Stores JSON records under `STATEMENT_DATA_DIR`; no database connection. |
| **Infrastructure** | `infra/terraform`, `infra/helm`, `docker-compose.yml`, `.env.example`, `Makefile`, `.github/workflows` | AWS VPC/SG, RDS, S3 documents bucket, IAM, Helm chart, compose stack, seed bring-up, CI/deploy. |

### Trust boundaries
- Internet → web (:3000), core-api (:8000) and partner-gateway (:8080).
- Internet → statement service (:8095): internet-facing, reachable by anyone, with Apache mod_php exposed directly and no WAF or reverse proxy (user's answer). It shares the compose network and the whole `.env` (`env_file: .env`) with the other services.
- Internal network → ledger-worker (:8090) and core-api `/admin/metrics`: internal-only in a real deployment (user's answer), although `docker-compose.yml` publishes :8090 and redis (:6379) to the host.
- Service → Postgres: one shared `helios` database. Every service uses the same superuser / RDS master account.
- Tenant ↔ tenant: isolation is application-enforced only (`require_tenant` in `app/services/authz.py`, or `tenant_id` filters in queries).
- Partner gateway → arbitrary partner URLs (outbound webhooks). In AWS, the instance metadata service is reachable; in compose, the `metadata` service stands in for it.
- Core API → LLM (copilot; `HELIOS_LLM_MODE=stub` by default). Invoice memo text reaches the model and its tools.

## Entry points and who can reach them
- **Unauthenticated, internet:** `POST /auth/login`, `POST /auth/password-reset/request|confirm`, `/healthz`, and `/legacy/debug` when `HELIOS_ENABLE_LEGACY` is on.
- **Statement service, unauthenticated, internet:** `GET /healthz`, `GET /version` (returns the exact PHP version and `affected`), `GET /remittances`, `POST /remittances/import` (multipart). `public/index.php` has no authentication, and PHP parses the request body before any application code runs, so an app-level check cannot stop runtime bugs such as PHP2Shell.
- **Unauthenticated, internal network only:** `GET /admin/metrics` (the admin router is mounted without `get_current_claims` in `app/main.py`) and ledger-worker `/refunds` (no auth in `cmd/server.go`).
- **Any authenticated role** (`get_current_claims` in `app/core/deps.py`, applied per router in `main.py`): copilot, diagnostics, documents, imports, invoices, reports and users. Role checks (`require_role`) and tenant checks (`require_tenant`) are applied per route, not globally.
- **Partner gateway:** `requireAuth` in `src/middleware/auth.ts` verifies the JWT (HS256, audience `helios`) but checks no role or tenant.
- The JWT secret `HELIOS_JWT_SECRET` is shared by core-api and partner-gateway, and both have hardcoded fallbacks.

## Assets and data sensitivity
- **Tenant billing data:** invoices, statements/documents, remittance records, payments and ledger balances. Refunds move money. Highest sensitivity.
- **Credentials and keys:** `users.password_hash`, password-reset tokens, the JWT signing secret, the webhook HMAC key, and the DB master credentials. Code execution in any container that loads the shared `.env`, including the statement service, yields all of them.
- **Infrastructure:** RDS instance, S3 documents bucket, IAM roles, and cloud metadata credentials.

## Attacker profiles
- **Who can get an account (user's answer):** anyone on the internet, through public sign-up. An attacker with a low-privilege account is therefore as likely as an anonymous one.
- Unauthenticated internet attacker reaching the public services: web console, core-api, partner-gateway and the statement service (no account needed there).
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
- The statement service runs Apache workers as `www-data`. It has no control specific to PHP2Shell: the runtime is unpatched, `memory_limit` is finite, upload progress is on and `fatal_error_backtraces` is on (`conf/php-vuln.ini`).

## Security Invariants
- **Vulnerable runtime components / PHP2Shell (CWE-1395, CWE-416, CWE-908; CVE-2026-109618, CVE-2026-109619):**
  - Every PHP runtime that ships (Dockerfile base images, distro packages, Bitnami images) is at or above 8.2.35 / 8.3.36 / 8.4.27 / 8.5.12 for its branch. Branches below 8.2 are not shipped.
  - Base images are pinned to a patched tag and rebuilt after a PHP security release.
  - `memory_limit=-1` is only a partial mitigation for CVE-2026-109618. Error-reporting settings (`error_reporting`, `@`, `display_errors`, `log_errors`) do not mitigate CVE-2026-109619. Neither replaces the upgrade.
  - **Gap:** `services/statement-service/Dockerfile` uses `php:8.5.11-apache-bookworm`, and `tests/run.php` plus the `statement-service` CI job assert the vulnerable floor, so an upgrade fails CI by design (demo). Only this service ships PHP.
- **Information disclosure (CWE-200):** services never report their runtime version or vulnerability status to callers. **Gap:** statement-service `GET /version` returns `phpVersion` and `affected`, and `display_errors=On`.
- **Least-privilege secrets (CWE-522):** each service receives only the secrets it needs. **Gap:** every compose service, including the statement service, loads the whole `.env`.
- **Authentication (CWE-287, CWE-347, CWE-306):**
  - Every non-public route depends on `get_current_claims`.
  - `decode_token` verifies HS256 with the configured secret and audience, never trusting the token header's `alg`.
  - No service starts with a default secret (`app/core/config.py`, `src/middleware/auth.ts`).
  - Ledger-worker routes verify the same JWT.
  - **Gaps:** the `alg=none` branch, the fallback secrets, the unauthenticated `/admin/metrics` and `/refunds`, and every statement-service route.
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
  - The S3 documents bucket is private. `infra/terraform/s3.tf` sets it `public-read`, which the Claude Security export does not report.

## Attack paths (drafted from the code; to confirm against findings)
Service-to-service links: core-api reaches `ledger_url` (`http://ledger-worker:8090`) and `gateway_url`; partner-gateway reaches `CORE_API_URL` and `LEDGER_URL` (`services/core-api/app/core/config.py`, `services/partner-gateway/src/config.ts`). All compose services share one flat network, one `.env` and one Postgres superuser; core-api and partner-gateway share `HELIOS_JWT_SECRET`.
1. **Internet → statement service → every tenant:** PHP2Shell RCE in `services/statement-service` (mod_php 8.5.11) → read the shared `.env` → forge an admin JWT for any tenant on core-api / partner-gateway, or connect to Postgres directly → all tenants' data; call ledger-worker `/refunds` on the internal network → money movement.
2. **Public sign-up → copilot → other tenants:** any account calls `POST /copilot/summarize` (`routers/copilot.py`), which loads the invoice by id with no `require_tenant`; and invoice memo text containing `lookup_invoice(<uuid>)` makes `copilot_tools.lookup_invoice` fetch any tenant's invoice into the summary (stored prompt injection → cross-tenant exfiltration).
3. **Partner webhook → cloud account:** webhook destinations pass only a substring denylist (`src/lib/urlguard.ts`) and `src/lib/dispatch.ts` follows redirects → instance metadata (`metadata` service in compose) → IAM credentials of the application role (`*:*`) → whole cloud account, including RDS and the S3 documents bucket.
4. **Low-privilege user → other tenant's admin:** users PATCH accepts `role`/`tenant_id` and any user id (`routers/users.py`, `schemas/user.py`) → admin in another tenant.
5. **Default/fallback secrets → forged tokens:** hardcoded JWT fallbacks and the `alg=none` branch (`app/core/security.py`, `src/middleware/auth.ts`) → tokens for any tenant across both services.
6. **Public bucket:** `infra/terraform/s3.tf` sets the documents bucket `public-read` → every tenant's statements.

## AI chatbot (Support Copilot)
- Code: `services/core-api/app/routers/copilot.py`, `app/services/copilot_tools.py`, `app/schemas/copilot.py`, UI in `web/`. `HELIOS_LLM_MODE=stub` by default (`.env.example`); in stub mode the tool call is driven by a regex over `invoice.memo_html`, which models what a real LLM would do with injected text.
- Invariants (CWE-1427 prompt injection, CWE-639, CWE-200): the copilot loads only invoices of `claims.tenant_id`; tools take the caller's tenant from the token, never from the model or the prompt; memo/document text is data, never instructions; tool results never include another tenant's rows; output rendered in the console is escaped (memo HTML goes through `dangerouslySetInnerHTML` in `web/components/InvoiceMemo.tsx`). **Gaps:** no tenant check on `invoice_id` or on `lookup_invoice`.

## Decisions from the user
- **Treat as production:** internet-facing, with real tenants and real money. The demo framing in `SECURITY.md` and `demo/SETUP.md` does not lower any finding.
- **Internal-only surfaces:** the ledger worker (`/refunds`, :8090) and core-api `/admin/metrics` are internal-only in a real deployment. An internet attacker cannot reach them directly; they matter for an attacker already inside the network, or one who gets there through another flaw (for example SSRF from the partner gateway).
- **Statement service exposure:** internet-facing, anyone can reach it; no WAF or reverse proxy in front of Apache mod_php.
- **Focus: cross-tenant data (user's answer, supersedes "all assets equal"):** exposure or modification of one tenant's data by another tenant, or by an outsider, is the most critical outcome. A finding the scanner confirms reaches another tenant's invoices, documents, users, remittances or ledger is the user's top priority.
- **Internet-facing with cloud account access (user's answer):** the application is internet-facing and its runtime has access to the company's cloud account. A foothold in any service (RCE, SSRF to instance metadata, leaked credentials) can reach that account, so cloud credentials and IAM are critical assets. `infra/terraform/iam.tf` grants the application policy `Action: *` on `Resource: *`.
- **Microservices talk to each other (user's answer):** findings must be read as steps in attack paths across services, not in isolation (see Attack paths).
- **AI chatbot (user's answer):** the Support Copilot must be checked for prompt injection and data exfiltration; data reaching it or its tools is in scope.
- **Production framing reconfirmed (user's answer):** nothing is ruled out and no risk is accepted.
- **Finding tags (user's answer):** Component, CVE, Compliance (PCI DSS v4.0 requirement, e.g. `PCI DSS 6.3.3`), Owning team, and CWE.
- **Triage scope:** weed out only duplicates and false positives. Seeded accounts and default secrets stay in scope.

## Out of scope / accepted risk
- None. The user ruled nothing out and accepted no risk.

## Open questions
- None open. Owning team (user's answer): one team per component: `web`, `core-api`, `partner-gateway`, `ledger-worker`, `statement-service`, and `platform` for Infrastructure.
