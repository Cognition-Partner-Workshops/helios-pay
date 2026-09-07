# Helios Pay Demo Setup

**Demo date:** 2026-09-02

Helios Pay is an intentionally vulnerable, local-only multi-tenant B2B
payments and invoice-financing platform. It is demo data only: never expose
the stack to the internet and never use real credentials.

## Prerequisites

- Docker with Docker Compose
- `make`
- `jq`
- Approximately 8 GB of available RAM

## Start the demo

Clone the repository and enter it:

```sh
git clone <repository-url> helios-pay-demo
cd helios-pay-demo
cp .env.example .env
make up
```

`make up` builds the containers, waits for Postgres, runs migrations, and
seeds the database. The measured boot-and-seed time is approximately **72
seconds**, meeting the five-minute target.

Verify the services:

```sh
curl http://localhost:8000/healthz
curl http://localhost:8080/healthz
curl http://localhost:8090/healthz
curl http://localhost:3000/healthz
```

The expected response from each endpoint is HTTP 200 with a service health
payload.

## Seeded access

The seed creates three tenants (`acme`, `globex`, and `initech`), with one
admin, operator, and viewer per tenant. Every seeded account uses:

```text
Password123!
```

Examples:

```text
admin@acme.example
operator@acme.example
viewer@acme.example
admin@globex.example
operator@globex.example
viewer@globex.example
admin@initech.example
operator@initech.example
viewer@initech.example
```

## Service URLs

| Surface | URL |
|---|---|
| Operator console | http://localhost:3000 |
| Core API | http://localhost:8000 |
| Partner gateway | http://localhost:8080 |
| Ledger worker | http://localhost:8090 |

Postgres and Redis are used by the Compose network. Postgres is intentionally
not published to the host.

## Run a proof of concept

Make the scripts executable if needed, then run one against the live stack:

```sh
chmod +x security/poc/*.sh
./security/poc/v02_bola.sh
```

The PoCs print evidence rather than silently returning a scanner-style
finding. See `demo/VULN-MAP.md` for the answer key and the captured outputs
from the integration gate.

## Start a Security Swarm scan

Open the Devin Security Swarm **app scan** UI, select this repository, choose
the default branch (`main`), and start a full scan. While the scan runs, use
the session tree to show the parallel agents working across Python,
TypeScript, Go, Next.js, Terraform, and the repository history. The scan
results should be recorded in `demo/SCAN-RESULTS.md` after the run.

For common local setup and reset problems, see
[`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).
