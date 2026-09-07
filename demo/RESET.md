# Resetting the Demo

Use this procedure between runs when a PoC has changed state or when you want
to return to the seeded baseline.

## Normal reset

Stop and remove the Compose containers, then bring the stack back:

```sh
make down
make up
```

`make up` reruns migrations and the idempotent seed. This is sufficient for
most runs, including the invoice memo changed by the XSS and prompt-injection
PoCs.

## Recreate the database volume

For a completely fresh database, remove the Compose volumes and recreate the
services:

```sh
make down
docker compose down -v
docker compose up -d --build
make migrate
make seed
```

The Postgres volume used by this Compose project is removed by `docker compose
down -v`; unrelated Docker volumes are not targeted. Wait for Postgres to be
healthy before running `make migrate` if the service has not finished starting:

```sh
docker compose ps
```

## Remove PoC artifacts

Remove the YAML deserialization marker and ZIP-slip files created in `/tmp`:

```sh
rm -f /tmp/helios-yaml-poc
rm -f /tmp/pwned /tmp/helios-zipslip-poc /tmp/helios-zipslip-marker
find /tmp -maxdepth 1 -type f -name '*helios*' -print
```

Remove any extracted statement directories created under the application
storage path from inside the core-api container:

```sh
docker compose exec -T core-api sh -lc \
  'find /app -type d \( -name uploads -o -name statements \) -print'
```

Delete only the PoC-created directories identified by that command. The exact
storage root is an application detail and should not be removed wholesale
when preserving another demo run.

## Restore the invoice memo

The simplest and safest way to restore a memo changed by the XSS or
prompt-injection PoCs is to reseed:

```sh
make seed
```

If the PoC created an additional invoice, the fresh-database procedure above
returns the entire dataset to the original seed.
