#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ci/jenkins-run.sh — what the Jenkinsfile runs (works on any Linux agent or a Mac).
#
# Reads these environment variables (the Jenkins job parameters):
#   SUITE                  smoke | regression | all | module | test      (default smoke)
#   MODULE                 module name when SUITE=module, e.g. account, send-money
#   TEST_ID                test ID(s) when SUITE=test, e.g. AC-07 or AC-(07|16)
#   WORKERS                browsers in parallel (default 6)
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
WORKERS="${WORKERS:-6}"
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

if [ "$SPLIT" = "true" ] && [ "$WORKERS" -gt 1 ]; then
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
