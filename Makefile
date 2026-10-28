build: ## Switch to correct NodeJS version and start backend
	@echo "Building....."
	@npm run build

start: ## Switch to correct NodeJS version and start backend
	@echo "Switching to correct NodeJS version and starting backend!"
	@npm run build && npm run start