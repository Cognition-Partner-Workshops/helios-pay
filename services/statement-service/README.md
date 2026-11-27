# statement-service (PHP / Apache mod_php)

Partner-facing **remittance statement** capability for Helios Pay. Partners
upload a remittance advice CSV; the service parses the line items, stores a
summary, and can list prior imports.

> ⚠️ **INTENTIONALLY VULNERABLE — demo use only. Do not deploy.** This service
> ships an affected PHP runtime so the PHP2Shell vulnerabilities are real, not
> simulated.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness |
| GET | `/version` | Runtime + PHP2Shell affected-version report |
| GET | `/remittances` | List imported remittance summaries |
| POST | `/remittances/import` | Multipart upload of a remittance advice CSV |

`POST /remittances/import` is a reachable, pre-auth `multipart/form-data`
(RFC1867) endpoint — the exact request path PHP2Shell abuses.

## PHP2Shell — CVE-2026-109618 and CVE-2026-109619

Both are **PHP runtime** remote-code-execution flaws (CVSS 9.2), fixed in PHP
8.2.35 / 8.3.36 / 8.4.27 / 8.5.12. The request is processed by the PHP parser
before any application code runs, so application-level auth cannot block it.
This service is vulnerable because of *how it runs*, not a line of app code:

- **Runtime:** `php:8.5.11-apache` — below the 8.5.12 floor.
- **SAPI:** Apache **mod_php**, the highest-risk SAPI (request shutdown runs
  unconditionally, even when request startup OOMs).
- **Config** (`conf/php-vuln.ini`): finite `memory_limit` (controllable OOM for
  CVE-2026-109618), `session.upload_progress.enabled=On` with `cleanup=Off`
  (CVE-2026-109619 session lifecycle), `fatal_error_backtraces=On`
  (CVE-2026-109619 confirmed 8.5 producer).

The only complete fix is upgrading PHP. See the
[php.net advisory](https://www.php.net/archive/2026.php#2026-10-21-1).

## Runtime validation (how Devin detects it)

Two checks, both run against the live service:

1. **Affected-version detection** — `security/poc/v17_php2shell_version.sh`
   reads the runtime PHP version and compares it to the patched floor.
2. **Behavioral precondition evidence** — `security/poc/v18_php2shell_surface.sh`
   proves, live against the affected build, that the exact pre-auth request
   surfaces the CVEs are reached through are reachable and processed: the
   multipart/RFC1867 upload parser (CVE-2026-109618) and the
   `session.upload_progress` lifecycle (CVE-2026-109619). It does **not** execute
   code or prove RCE — a fatal/OOM alone is not code execution, and no weaponized
   PoC is shipped. Exploitation proof is intentionally out of scope.

`tests/run.php` runs in CI on the affected runtime and asserts the version floor
and the configured preconditions; upgrading PHP breaks it by design.

## Run

```sh
make up
curl http://localhost:8095/version
```
