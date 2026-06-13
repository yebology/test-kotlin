# ============================================================
# E2E Test Orchestrator — Makefile
# Usage: make [target]
# ============================================================

ORCH_DIR := orchestrator

.PHONY: install run generate execute resume compare clean typecheck help

## Default target
help: ## Show available commands
	@echo ""
	@echo "  E2E Test Orchestrator"
	@echo "  ─────────────────────"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""

install: ## Install dependencies
	@cd $(ORCH_DIR) && npm install

run: install ## Run wizard (interactive)
	@cd $(ORCH_DIR) && ./wizard.sh

generate: install ## Generate tests from codebase
	@cd $(ORCH_DIR) && ./wizard.sh --generate codebase

generate-req: install ## Generate tests from requirements
	@cd $(ORCH_DIR) && ./wizard.sh --generate requirements

generate-excel: install ## Generate tests from Excel (.xlsx)
	@cd $(ORCH_DIR) && ./wizard.sh --generate excel

execute: install ## Execute tests (parallel, deterministic)
	@cd $(ORCH_DIR) && ./wizard.sh --execute --workers 2

execute-4: install ## Execute tests with 4 workers
	@cd $(ORCH_DIR) && ./wizard.sh --execute --workers 4

resume: install ## Resume interrupted run
	@cd $(ORCH_DIR) && ./wizard.sh --resume

compare: install ## Compare two runs
	@cd $(ORCH_DIR) && ./wizard.sh --compare

verbose: install ## Run with verbose output
	@cd $(ORCH_DIR) && ./wizard.sh --verbose

typecheck: ## TypeScript type check (no emit)
	@cd $(ORCH_DIR) && npx tsc --noEmit

clean: ## Remove node_modules and build artifacts
	@rm -rf $(ORCH_DIR)/node_modules $(ORCH_DIR)/dist $(ORCH_DIR)/generated-prompts
	@echo "Cleaned."
