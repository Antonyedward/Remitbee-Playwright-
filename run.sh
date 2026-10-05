#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run.sh — shortcut runner for the Remitbee CP Playwright flow suite
# (works with the macOS default bash 3.2)
#
# Usage:  ./run.sh <what> [headless] [extra playwright args]
#
#   ./run.sh all                    # every module (headed)
#   ./run.sh all headless           # every module (headless)
#   ./run.sh smoke                  # @smoke tests
#   ./run.sh smoke headless
#   ./run.sh regression             # @regression tests
#   ./run.sh regression headless
#   ./run.sh rates                  # one module (any name from the list below)
#   ./run.sh rates headless
#   ./run.sh AC-07                  # one test case by ID
#   ./run.sh "AC-(07|16)" headless  # several test cases by ID
#   ./run.sh failed                 # only the tests that failed last run
#   ./run.sh report                 # open the HTML report
#   ./run.sh control                # voice control panel → http://localhost:4000
#
# Modules: signup auth dashboard send-money exchange wallet recipients settings
#          transactions rates rewards schedule verification account escalation
#          dtone referral help currency-converter voice
# ─────────────────────────────────────────────────────────────────────────────
set -eo pipefail
cd "$(dirname "$0")"

usage() { sed -n '2,25p' "$0"; }

WHAT="$1"
if [ -z "$WHAT" ]; then usage; exit 1; fi
shift
MODE="headed"
if [ "$1" = "headless" ] || [ "$1" = "headed" ]; then MODE="$1"; shift; fi

export NODE_OPTIONS="--max-old-space-size=1024"
if [ "$MODE" = "headless" ]; then export HEADLESS=true; else export HEADLESS=false; fi

PW="npx playwright test --config=playwright.flow.config.ts --project=flow-chromium"
F="tests/flows"

module_file() {
  case "$1" in
    signup) echo 00-signup ;;           auth) echo 01-auth ;;
    dashboard) echo 02-dashboard ;;     send-money) echo 03-send-money ;;
    exchange) echo 04-exchange ;;       wallet) echo 05-wallet ;;
    recipients) echo 06-recipients ;;   settings) echo 07-settings ;;
    transactions) echo 08-transactions ;; rates) echo 09-rates ;;
    rewards) echo 10-rewards ;;         schedule) echo 11-schedule ;;
    verification) echo 12-verification ;; account) echo 13-account ;;
    escalation) echo 14-escalation ;;   dtone) echo 15-dtone ;;
    referral) echo 16-referral ;;       help) echo 17-help ;;
    currency-converter) echo 18-currency-converter ;; voice) echo 19-voice ;;
  esac
}

# Test-ID prefix -> spec file(s). RC- is used by both recipients and rates.
prefix_files() {
  case "$1" in
    SU) echo "$F/00-signup.flow.spec.ts" ;;      PA) echo "$F/01-auth.flow.spec.ts" ;;
    DB) echo "$F/02-dashboard.flow.spec.ts" ;;   SM) echo "$F/03-send-money.flow.spec.ts" ;;
    CE) echo "$F/04-exchange.flow.spec.ts" ;;    CADB) echo "$F/05-wallet.flow.spec.ts" ;;
    RC) echo "$F/06-recipients.flow.spec.ts $F/09-rates.flow.spec.ts" ;;
    ST) echo "$F/07-settings.flow.spec.ts" ;;    TX) echo "$F/08-transactions.flow.spec.ts" ;;
    RW) echo "$F/10-rewards.flow.spec.ts" ;;     SC) echo "$F/11-schedule.flow.spec.ts" ;;
    VF) echo "$F/12-verification.flow.spec.ts" ;; AC) echo "$F/13-account.flow.spec.ts" ;;
    ES) echo "$F/14-escalation.flow.spec.ts" ;;  DT) echo "$F/15-dtone.flow.spec.ts" ;;
    RV) echo "$F/16-referral.flow.spec.ts" ;;    HP) echo "$F/17-help.flow.spec.ts" ;;
    CC) echo "$F/18-currency-converter.flow.spec.ts" ;;
  esac
}

echo "▶ $WHAT ($MODE)"
case "$WHAT" in
  all)        $PW "$@" ;;
  smoke)      $PW --grep @smoke "$@" ;;
  regression) $PW --grep @regression "$@" ;;
  failed)     $PW --last-failed "$@" ;;
  report)     npx playwright show-report ;;
  control)    exec node voice-control/server.mjs ;;
  *)
    MOD="$(module_file "$WHAT")"
    if [ -n "$MOD" ]; then
      $PW "$F/$MOD.flow.spec.ts" "$@"
    else
      P="$(echo "$WHAT" | sed -n 's/^\([A-Z][A-Z]*\)-.*/\1/p')"
      if [ -n "$P" ]; then
        # trailing space stops AC-1 from also matching AC-10..AC-19
        $PW $(prefix_files "$P") --grep "$WHAT " "$@"
      else
        echo "Unknown option: $WHAT"; usage; exit 1
      fi
    fi ;;
esac
