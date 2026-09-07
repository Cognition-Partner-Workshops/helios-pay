# Troubleshooting

## Host port 5432 is already in use

The Compose Postgres service listens on port 5432 inside the Compose network
but does **not** publish port 5432 to the host. A host Postgres or a leftover
test container on another port should not conflict with the demo.

The published demo ports are 8000, 8080, 8090, 3000, and 6379. If one is
occupied, identify the process and stop it before restarting the stack:

```sh
ss -ltnp | grep -E ':(8000|8080|8090|3000|6379)\b'
docker ps
```

Do not stop a process you do not recognize on a shared machine. Choose a
different host environment or stop the known offending local process.

## Docker runs out of memory

Allocate approximately 8 GB of RAM to Docker Desktop or the Docker VM. Close
other containers and retry:

```sh
docker system df
make down
make up
```

Avoid deleting unrelated images or volumes on a shared workstation.

## Reset the stack

For a normal restart, reset the Compose services and rebuild:

```sh
make down
make up
```

This reruns the migration and seed steps. The seed is idempotent, so it is
safe to rerun:

```sh
make seed
```

## Inspect logs

Follow all service logs:

```sh
make logs
```

Inspect one service:

```sh
docker compose logs core-api
docker compose logs partner-gateway
docker compose logs ledger-worker
docker compose logs web
```

Add `-f` to follow a service while reproducing a problem.

## The web app cannot reach the API

Check that core-api is healthy:

```sh
curl http://localhost:8000/healthz
```

The web app uses `NEXT_PUBLIC_API_URL`, defaulting to
`http://localhost:8000`. Check `.env` for an accidental override, then
recreate the web service after changing it:

```sh
docker compose up -d --force-recreate web
```

## Console login shows "Failed to fetch"

The browser blocks the login request before it is sent unless core-api allows
the console's origin. `HELIOS_CORS_ORIGINS` controls the allowed origins.
Confirm the preflight succeeds:

```sh
curl -i -X OPTIONS http://localhost:8000/auth/login \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

A healthy response is `200` with an `access-control-allow-origin` header. If
the console is served from a different host or port, update both
`NEXT_PUBLIC_API_URL` and `HELIOS_CORS_ORIGINS`, then recreate core-api:

```sh
docker compose up -d --force-recreate core-api
```

## A PoC fails after another PoC

Several PoCs intentionally mutate demo state: invoices, ledger entries,
documents, reset tokens, and marker files. Review
[`RESET.md`](RESET.md), reset the relevant state, and rerun the PoC. Do not
interpret a state-dependent failure as evidence that the vulnerability
disappeared.
