#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$PROJECT_ROOT/backend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

pass=0
fail=0

run_suite() {
  local name="$1"
  shift
  printf "\n${CYAN}${BOLD}▶ %s${RESET}\n" "$name"
  if "$@"; then
    printf "${GREEN}✓ %s passed${RESET}\n" "$name"
    ((pass++)) || true
  else
    printf "${RED}✗ %s failed${RESET}\n" "$name"
    ((fail++)) || true
  fi
}

printf "${BOLD}==============================${RESET}\n"
printf "${BOLD}       Z80LAB Test Runner     ${RESET}\n"
printf "${BOLD}==============================${RESET}\n"

# --- JS / Vitest (assembler unit tests) ---
run_suite "Vitest (assembler)" \
  bash -c "cd '$BACKEND' && npm test"

# --- PHP / PHPUnit (Laravel backend) ---
if command -v php &>/dev/null && [ -f "$BACKEND/vendor/bin/phpunit" ]; then
  run_suite "PHPUnit (Laravel)" \
    bash -c "cd '$BACKEND' && php artisan test --ansi"
else
  printf "\n${YELLOW}⚠ PHPUnit skipped (php or vendor not available)${RESET}\n"
fi

# --- Summary ---
printf "\n${BOLD}==============================${RESET}\n"
total=$((pass + fail))
if [ "$fail" -eq 0 ]; then
  printf "${GREEN}${BOLD}All %d suite(s) passed${RESET}\n" "$total"
else
  printf "${RED}${BOLD}%d/%d suite(s) failed${RESET}\n" "$fail" "$total"
fi
printf "${BOLD}==============================${RESET}\n"

[ "$fail" -eq 0 ]
