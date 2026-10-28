build: ## Switch to correct NodeJS version and start backend
	@echo "Building....."
	@npm run build

start: ## Switch to correct NodeJS version and start backend
	@echo "Switching to correct NodeJS version and starting backend!"
	@npm run build && npm run start
record: ## Record Giga API data into data/giga (env: GIGA_SINCE, GIGA_MAX_PAGES, GIGA_ORDER_NUMBERS)
	@npm run build && GIGA_RECORD_DIR=data/giga node dist/record.js
