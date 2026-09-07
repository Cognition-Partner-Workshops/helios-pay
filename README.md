# Helios Pay

> ⚠️ **INTENTIONALLY VULNERABLE — demo use only, never deploy to the internet, never load real data**

Helios Pay is a multi-tenant B2B payments demo for the Devin Security Swarm.
The repository is designed to look like a small production platform while
providing an isolated foundation for later security exercises.

## Architecture

```text
                         +------------------+
                         |   web :3000      |
                         | Next.js console  |
                         +--------+---------+
                                  |
                         +--------v---------+
                         | core-api :8000   |
                         | FastAPI / DB API |
                         +---+----------+---+
                             |          |
                    +--------v--+   +---v----+
                    | postgres  |   | redis  |
                    | :5432     |   | :6379  |
                    +-----------+   +--------+
                             ^
                    +--------+---------+
                    | ledger-worker    |
                    | Go :8090         |
                    +------------------+

                    +------------------+
                    | partner-gateway |
                    | Express :8080   |
                    +------------------+
```

## Services

| Service | Stack | Port | Role |
|---|---|---:|---|
| `core-api` | Python 3.12 / FastAPI + SQLAlchemy 2 + Postgres | 8000 | tenants, users, invoices, payments, documents, copilot |
| `partner-gateway` | Node 22 / TypeScript / Express | 8080 | partner webhook registration, outbound callbacks, SARIF/CSV import |
| `ledger-worker` | Go 1.22 + Redis | 8090 | balance ledger, refunds, settlement jobs |
| `web` | Next.js 14 / React 18 | 3000 | operator console and Support Copilot |
| `postgres` | `postgres:16` | 5432 | shared `helios` database |
| `redis` | `redis:7` | 6379 | ledger locks and queues |

## Quickstart

This is a local-only demo. Do not expose the compose ports to the internet.

```sh
cp .env.example .env
make up
curl http://localhost:8000/healthz
```

Useful commands:

```sh
make logs
make ps
make test
make lint
make down
```