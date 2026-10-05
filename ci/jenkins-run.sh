#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ci/jenkins-run.sh — what the Jenkinsfile runs (works on any Linux agent or a Mac).
#
# Reads these environment variables (the Jenkins job parameters):
#   SUITE                  smoke | regression | all | module | test      (default smoke)
#   MODULE                 module name when SUITE=module, e.g. account, send-money
#   TEST_ID                test ID(s) when SUITE=test, e.g. AC-07 or AC-(07|16)
#   WORKERS                browsers in parallel (default auto):
#                            auto  = work it out from the machine's CPUs and free memory
#                            6     = exactly 6 browsers
#                            50%   = half of the CPU cores
#   MAX_WORKERS            upper limit for auto (default 10) — protects staging from overload
#   MB_PER_BROWSER         memory budget per browser for auto (default 700)
#   SPLIT_SHARED_ACCOUNTS  true = run Send Money (SM-) and Auth (PA-) with ONE browser
#                          after the rest, because they share test accounts (default true)
#   DRY_RUN=1              print the commands without running them
#
# Each pass writes its own results so nothing is overwritten:
#   playwright-report/<pass>/   HTML report      junit-results/<pass>.xml   JUnit
#   test-results/<pass>/        screenshots, videos and traces of failures
# Exit code is non-zero if any pass had a failure.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/.."

SUITE="${SUITE:-smoke}"
MODULE="${MODULE:-}"
TEST_ID="${TEST_ID:-}"
WORKERS="${WORKERS:-auto}"
MAX_WORKERS="${MAX_WORKERS:-10}"
MB_PER_BROWSER="${MB_PER_BROWSER:-700}"

# ── Decide how many browsers to run ─────────────────────────────────────────
cpu_count() {
  if command -v nproc >/dev/null 2>&1; then nproc
  elif [ "$(uname)" = "Darwin" ]; then sysctl -n hw.ncpu
  else echo 2; fi
}
free_mb() {
  if [ -r /proc/meminfo ]; then
    awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo
  elif [ "$(uname)" = "Darwin" ]; then
    # free + inactive pages on macOS
    vm_stat | awk -v ps="$(sysctl -n hw.pagesize)" '/Pages free|Pages inactive/ {gsub("\\.","",$NF); s+=$NF} END {print int(s*ps/1048576)}'
  else echo 4096; fi
}

case "$WORKERS" in
  auto|AUTO|"")
    CPUS=$(cpu_count); MEM=$(free_mb)
    BY_CPU=$(( CPUS > 1 ? CPUS - 1 : 1 ))          # leave one core for Jenkins / the OS
    BY_MEM=$(( MEM / MB_PER_BROWSER )); [ "$BY_MEM" -lt 1 ] && BY_MEM=1
    W=$BY_CPU; [ "$BY_MEM" -lt "$W" ] && W=$BY_MEM
    [ "$W" -gt "$MAX_WORKERS" ] && W=$MAX_WORKERS
    [ "$W" -lt 1 ] && W=1
    echo "Browsers: auto → $W  (CPUs: $CPUS → $BY_CPU, free memory: ${MEM} MB → $BY_MEM, limit: $MAX_WORKERS)"
    WORKERS=$W ;;
  *%)
    if ! [[ "$WORKERS" =~ ^[0-9]{1,3}%$ ]]; then echo "WORKERS must be auto, a number or a percentage like 50% (got '$WORKERS')"; exit 2; fi
    echo "Browsers: $WORKERS of CPU cores (Playwright decides)" ;;
  *)
    if ! [[ "$WORKERS" =~ ^[0-9]{1,2}$ ]] || [ "$WORKERS" -lt 1 ]; then echo "WORKERS must be auto, a number 1-99 or a percentage like 50% (got '$WORKERS')"; exit 2; fi
    echo "Browsers: $WORKERS (fixed)" ;;
esac
# For the split decision a percentage counts as "more than one browser"
WORKERS_NUM="${WORKERS%\%}"; [[ "$WORKERS" == *% ]] && WORKERS_NUM=2
SPLIT="${SPLIT_SHARED_ACCOUNTS:-true}"

export CI=true
export HEADLESS=true

PW=(npx playwright test --config=playwright.flow.config.ts --project=flow-chromium)
SHARED_IDS='(SM|PA)-[0-9]{2} '
SHARED_FILES=(tests/flows/01-auth.flow.spec.ts tests/flows/03-send-money.flow.spec.ts)

# run <pass-name> <command...>
run() {
  local name="$1"; shift
  echo ""
  echo "▶ [$name] $*"
  if [ "${DRY_RUN:-}" = "1" ]; then return 0; fi
  PW_OUTPUT_DIR="test-results/$name" \
  PW_REPORT_DIR="playwright-report/$name" \
  PW_JUNIT_FILE="junit-results/$name.xml" \
  "$@"
}

rc=0
TAG=()
INVERT=""

case "$SUITE" in
  smoke)      TAG=(--grep @smoke) ;;
  regression) TAG=(--grep @regression) ;;
  all)        INVERT="@voice" ;;   # voice tests need the Jev API key; run them separately
  module)
    if ! [[ "$MODULE" =~ ^[a-z][a-z-]*$ ]]; then echo "MODULE must be a module name like account or send-money (got '$MODULE')"; exit 2; fi
    run module "${PW[@]}" "${MODULE}.flow.spec" --workers="$WORKERS" || rc=$?
    exit $rc ;;
  test)
    if ! [[ "$TEST_ID" =~ ^[A-Z]{2,4}-[0-9|()]+$ ]]; then echo "TEST_ID must look like AC-07 or AC-(07|16) (got '$TEST_ID')"; exit 2; fi
    run test "${PW[@]}" --grep "${TEST_ID} " --workers=1 || rc=$?
    exit $rc ;;
  *) echo "Unknown SUITE '$SUITE' (use smoke, regression, all, module or test)"; exit 2 ;;
esac

if [ "$SPLIT" = "true" ] && [ "$WORKERS_NUM" -gt 1 ]; then
  MAIN_INVERT="$SHARED_IDS"; [ -n "$INVERT" ] && MAIN_INVERT="$SHARED_IDS|$INVERT"
  run main   "${PW[@]}" ${TAG[@]+"${TAG[@]}"} --grep-invert "$MAIN_INVERT" --workers="$WORKERS" || rc=$?
  run shared "${PW[@]}" "${SHARED_FILES[@]}" ${TAG[@]+"${TAG[@]}"} --workers=1 || rc=$?
else
  if [ -n "$INVERT" ]; then
    run main "${PW[@]}" ${TAG[@]+"${TAG[@]}"} --grep-invert "$INVERT" --workers="$WORKERS" || rc=$?
  else
    run main "${PW[@]}" ${TAG[@]+"${TAG[@]}"} --workers="$WORKERS" || rc=$?
  fi
fi
exit $rc
