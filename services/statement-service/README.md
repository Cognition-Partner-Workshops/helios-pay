# statement-service (PHP / Apache mod_php)

Partner-facing **remittance statement** capability for Helios Pay. Partners
upload a remittance advice CSV; the service parses the line items, stores a
summary, and can list prior imports.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness |
| GET | `/version` | Runtime + PHP2Shell affected-version report |
| GET | `/remittances` | List imported remittance summaries |
| POST | `/remittances/import` | Multipart upload of a remittance advice CSV |

`POST /remittances/import` is a pre-auth `multipart/form-data` (RFC1867)
endpoint.

## PHP2Shell — CVE-2026-109618 and CVE-2026-109619

Both are **PHP runtime** remote-code-execution flaws (CVSS 9.2), fixed in PHP
8.2.35 / 8.3.36 / 8.4.27 / 8.5.12. The request is processed by the PHP parser
before any application code runs, so application-level auth cannot block it.
The only complete fix is upgrading PHP, so the runtime is what protects this
service:

- **Runtime:** `php:8.5.12-apache-bookworm` — the patched floor of the 8.5
  branch. Never pin a release below it.
- **Config** (`conf/php.ini`): production settings. Upload progress tracking,
  fatal error backtraces, `display_errors` and `expose_php` are off. This is
  hardening only; no ini setting fixes either CVE.

See the [php.net advisory](https://www.php.net/archive/2026.php#2026-10-21-1).

## Runtime validation

- `tests/run.php` runs inside the service image (`make test` and CI) and fails
  if the runtime is an affected PHP build or the hardening settings are missing.
- `security/poc/v17_php2shell_version.sh` reads `/version` from the live service
  and reports `FAIL V17` when the build is at or above the patched floor, which
  is the expected result now. `security/poc/v18_php2shell_surface.sh` then
  skips.

## Run

```sh
make up
curl http://localhost:8095/version
```
