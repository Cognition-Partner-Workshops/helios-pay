.PHONY: up down logs ps migrate seed test lint

up:
	docker compose up --build -d
	@printf "Waiting for postgres healthcheck"
	@until [ "$$(docker compose ps -q postgres | xargs -r docker inspect -f '{{.State.Health.Status}}')" = "healthy" ]; do printf "."; sleep 2; done
	@printf "\n"
	$(MAKE) migrate
	$(MAKE) seed

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

migrate:
	docker compose exec -T core-api alembic upgrade head

seed:
	docker compose exec -T core-api python -m app.seed

test:
	cd services/core-api && pytest
	cd services/partner-gateway && npm test
	cd services/ledger-worker && go test ./...
	cd web && npm run build

lint:
	cd services/core-api && ruff check .
	cd services/partner-gateway && npm run lint && npm run typecheck
	cd services/ledger-worker && go vet ./...
	cd web && npm run lint
