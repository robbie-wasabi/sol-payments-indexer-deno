mongo-up:
	docker compose up -d

mongo-down:
	docker compose down

mongo-wipe:
	docker compose down --volumes --remove-orphans
	docker volume rm $(docker volume ls -qf dangling=true)

mongo-restart:
	docker compose down --volumes --remove-orphans
	docker compose up -d

dev:
	deno run -A main.ts