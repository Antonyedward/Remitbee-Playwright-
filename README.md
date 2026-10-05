# Remitbee CP — Playwright Flow Automation

End-to-end UI tests for the Remitbee Customer Portal, run against staging
**https://www.cp.wisecapitals.com** with Playwright + TypeScript.

- 20 flow modules · 372 tests (`tests/flows/00-signup` … `19-voice`)
- Every test logs in by itself in a fresh browser (email → password → OTP)
- Runs **headed** (visible browser) by default; **headless** on demand
- 1 worker, sequential · full run ≈ 2h 45m headed

> Framework details: `reports/Remitbee-CP-Playwright-Framework-Guide.pdf`
> Last run report: `reports/Remitbee-CP-Playwright-Flow-Report-2026-10-01.pdf`

---

## 0. Quick start with `run.sh`

`run.sh` wraps all the commands below. Make it executable once, then run it from the project folder:

```bash
chmod +x run.sh                     # first time only

./run.sh all                        # all tests, headed
./run.sh all headless               # all tests, headless
./run.sh smoke                      # smoke, headed
./run.sh smoke headless             # smoke, headless
./run.sh regression                 # regression, headed
./run.sh regression headless        # regression, headless
./run.sh rates                      # one module, headed (any module name from section 5)
./run.sh rates headless             # one module, headless
./run.sh AC-07                      # one test case by ID
./run.sh "AC-(07|16)" headless      # several test cases by ID
./run.sh failed                     # only the tests that failed last run
./run.sh report                     # open the HTML report
./run.sh                            # show help
```

Anything after the mode is passed straight to Playwright, e.g. `./run.sh AC-07 headed --debug`.

---

## 1. Setup (first time only)

```bash
cd remitbee-playwright
npm install                          # install dependencies
npx playwright install chromium      # install the Chromium browser
cp .env.example .env                 # then fill in the values below
```

`.env` (never commit this file):

```bash
BASE_URL=https://www.cp.wisecapitals.com   # optional — this is the default
TYPESAFE_API_KEY=<jev ai key>              # only needed for 19-voice
HEADLESS=true                              # optional — make headless the default on this machine
```

Test accounts, the staging OTP and test data live in `config/environments.ts`
(each value can be overridden from `.env`).

---

## 2. Run ALL tests

```bash
# Headed (visible browser) — default
npm run test:flow

# Headless (no browser window)
npm run test:flow:headless

# Same thing without npm scripts
npx playwright test --config=playwright.flow.config.ts --project=flow-chromium
HEADLESS=true npx playwright test --config=playwright.flow.config.ts --project=flow-chromium
```

---

## 3. Run SMOKE tests (`@smoke` — 77 core tests)

```bash
# Headed
npm run flow:smoke

# Headless
npm run flow:smoke:headless
```

---

## 4. Run REGRESSION tests (`@regression`)

```bash
# Headed
npm run flow:regression

# Headless
npm run flow:regression:headless
```

---

## 5. Run ONE MODULE

```bash
# Headed
npm run flow:rates

# Headless — put HEADLESS=true in front of ANY npm script
HEADLESS=true npm run flow:rates
```

| # | Module | npm script | Test ID prefix |
|---|---|---|---|
| 00 | Signup | `npm run flow:signup` | `SU-` |
| 01 | Auth (login / OTP / forgot password) | `npm run flow:auth` | `PA-` |
| 02 | Dashboard | `npm run flow:dashboard` | `DB-` |
| 03 | Send Money | `npm run flow:send-money` | `SM-` |
| 04 | Exchange currency | `npm run flow:exchange` | `CE-` |
| 05 | Wallet | `npm run flow:wallet` | `CADB-` |
| 06 | Recipients | `npm run flow:recipients` | `RC-` |
| 07 | Settings | `npm run flow:settings` | `ST-` |
| 08 | Transactions | `npm run flow:transactions` | `TX-` |
| 09 | Rates | `npm run flow:rates` | `RC-` |
| 10 | Rewards | `npm run flow:rewards` | `RW-` |
| 11 | Schedule transfer | `npm run flow:schedule` | `SC-` |
| 12 | Verification | `npm run flow:verification` | `VF-` |
| 13 | Account | `npm run flow:account` | `AC-` |
| 14 | Escalation | `npm run flow:escalation` | `ES-` |
| 15 | DT One (top-up / bills / eSIM / gift card) | `npm run flow:dtone` | `DT-` |
| 16 | Referral | `npm run flow:referral` | `RV-` |
| 17 | Help Centre | `npm run flow:help` | `HP-` |
| 18 | Currency converter | `npm run flow:currency-converter` | `CC-` |
| 19 | Voice (Jev AI) | `npm run flow:voice` | *(no prefix — use the title)* |

> `RC-` is used by both Recipients and Rates — always include the spec file when filtering by ID.

---

## 6. Run a SINGLE TEST CASE

```bash
# By test ID (note the trailing space inside the quotes — stops AC-1 also matching AC-10..AC-19)
npx playwright test --config=playwright.flow.config.ts --project=flow-chromium \
  tests/flows/13-account.flow.spec.ts --grep "AC-07 "

# Same, headless
HEADLESS=true npx playwright test --config=playwright.flow.config.ts --project=flow-chromium \
  tests/flows/13-account.flow.spec.ts --grep "AC-07 "

# By file + line number (line where the test starts)
npx playwright test --config=playwright.flow.config.ts --project=flow-chromium \
  tests/flows/13-account.flow.spec.ts:50

# By part of the title
npx playwright test --config=playwright.flow.config.ts --project=flow-chromium \
  --grep "valid email on forgot password"
```

## 7. Run SEVERAL specific test cases

```bash
# Several IDs in one module
npx playwright test --config=playwright.flow.config.ts --project=flow-chromium \
  tests/flows/14-escalation.flow.spec.ts --grep "ES-(02|11|14|20) "

# Smoke tests of one module only
npx playwright test --config=playwright.flow.config.ts --project=flow-chromium \
  tests/flows/03-send-money.flow.spec.ts --grep @smoke

# Everything except one module's tests
npx playwright test --config=playwright.flow.config.ts --project=flow-chromium --grep-invert "DT-"
```

## 8. Re-run only the tests that FAILED last time

```bash
npx playwright test --config=playwright.flow.config.ts --project=flow-chromium --last-failed
```

---

## 9. Headed vs headless — quick reference

| I want to… | Headed (visible browser) | Headless |
|---|---|---|
| Run everything | `npm run test:flow` | `npm run test:flow:headless` |
| Run smoke | `npm run flow:smoke` | `npm run flow:smoke:headless` |
| Run regression | `npm run flow:regression` | `npm run flow:regression:headless` |
| Run one module | `npm run flow:<module>` | `HEADLESS=true npm run flow:<module>` |
| Run one test | `npx playwright test … --grep "AC-07 "` | `HEADLESS=true npx playwright test … --grep "AC-07 "` |
| Force headed when `.env` has `HEADLESS=true` | add `--headed` | — |

How it works: `playwright.flow.config.ts` uses `headless: process.env.HEADLESS === 'true'`.

> Windows (cmd / PowerShell): `HEADLESS=true` in front of a command does not work — use
> `npx cross-env HEADLESS=true npm run flow:rates`, or set `HEADLESS=true` in `.env`.

---

## 10. Debugging a test

```bash
# Step through a test with the Playwright Inspector (pauses before each action)
npx playwright test --config=playwright.flow.config.ts --project=flow-chromium \
  tests/flows/13-account.flow.spec.ts --grep "AC-07 " --debug

# Interactive UI mode (pick tests, watch, time-travel)
npx playwright test --config=playwright.flow.config.ts --project=flow-chromium --ui

# Open the trace of a failed test
npx playwright show-trace "test-results/<test-folder>/trace.zip"
```

On failure each test saves to `test-results/<test-folder>/`:
`error-context.md` (error + page snapshot), screenshot, video and `trace.zip`.

---

## 11. Reports

```bash
npm run flow:report        # open the HTML report of the last run (playwright-report/)
```

PDF run summaries and the framework guide are kept in `reports/`.

---

## 12. Good to know

- **Do not click or type in the test browser while tests run** — it breaks the run.
- A full run creates staging data: new signup / verification accounts, recipients,
  one $12 scheduled transfer, escalations (closed by the tests) and a password-reset email.
- Parked tests are marked `test.fixme(...)` and show as **skipped**
  (DT-07, DT-09, HP-07…HP-14, CC-14). Change `test.fixme(` back to `test(` to re-enable.
- DT-14 is skipped until the QR test account (`DTONE_QR_EMAIL`) can log in on staging.
- Type-check after code changes: `npx tsc --noEmit -p .`
- All npm scripts use `cross-env NODE_OPTIONS=--max-old-space-size=1024` for long runs.

## 13. Project layout

```
tests/flows/                 20 spec files (what to test)
flows/FlowBase.ts            shared base: login + OTP, cookies, pop-ups, navigation
flows/<module>/*Flow.ts      page helpers per module (how to do it on the page)
flows/voice/                 Jev AI voice helper
config/environments.ts       URLs, test accounts, test data (ENV)
utils/api-utils.ts           API helpers
test-data/                   dummy upload files
playwright.flow.config.ts    runner config (headed/headless, timeouts, reporters)
reports/                     PDF reports
```

## 14. Voice control panel (run the suite by talking)

Start it from the project folder:

```bash
./run.sh control            # or: npm run voice:control
```

Then open **http://localhost:4000** in **Chrome**, click the 🎤 button (or press Space) and allow the microphone.

| Say | What runs |
|---|---|
| "run the account module" / "run escalation headless" | `./run.sh account headed` / `./run.sh escalation headless` |
| "run AC 07" / "run A C oh seven and A C sixteen" | `./run.sh AC-07` / `./run.sh "AC-(07\|16)"` |
| "run smoke tests" / "run regression headless" / "run everything" | `smoke` / `regression headless` / `all` |
| "rerun the failed tests" | `./run.sh failed` |
| "status" / "how is it going" | Speaks the progress and failures so far |
| "stop" | Stops the run (Playwright and its browser) |
| "open the report" | Opens the HTML report |

- Every run asks for a **"yes"** first (the panel shows what it understood). Say "no" to cancel.
- There's also a text box if you want to type commands instead.
- One run at a time. Progress, failures and the live output show on the page; it speaks each failure and a summary at the end (switch off with the checkboxes).
- Understanding works by rules first. If `TYPESAFE_API_KEY` is in `.env`, Jev is used for sentences the rules don't catch (the badge shows "Jev: on").
- Safety: the server listens on localhost only, and spoken text is never run in a shell. It is turned into a fixed command (module / test ID / mode) and checked against the allowed list before `run.sh` is started.
- Ctrl+C in the terminal stops the panel and any run it started.
- Test IDs in one command must share a prefix (AC-07 and AC-16 is fine; AC-07 and ES-11 is not).

Files: `voice-control/server.mjs` (runner + web server), `voice-control/commands.mjs` (allowed commands, rules, Jev questions), `voice-control/index.html` (panel).

## 16. Jenkins

The pipeline is in `Jenkinsfile`; the test logic it runs is in `ci/jenkins-run.sh`.

**Job parameters**

| Parameter | Values | Meaning |
|---|---|---|
| SUITE | smoke, regression, all, module, test | What to run |
| MODULE | account, send-money, … | Used when SUITE = module |
| TEST_ID | e.g. `AC-07`, `AC-(07|16)` | Used when SUITE = test |
| WORKERS | `auto` (default), a number like `6`, or `50%` | Browsers in parallel. **auto** works it out on the agent: CPU cores − 1, limited by free memory (700 MB per browser) and by MAX_WORKERS. The console shows the choice, e.g. `Browsers: auto → 6 (CPUs: 8 → 7, free memory: 4300 MB → 6, limit: 10)` |
| MAX_WORKERS | `10` | Upper limit for auto, so staging is not overloaded |
| SPLIT_SHARED_ACCOUNTS | true / false | Run Send Money (SM-) and Auth (PA-) with one browser after the rest |

**What a build produces:** JUnit results (pass/fail trend per test), one Playwright HTML report per pass ("main", "shared"), and the screenshots, videos and traces of failures as build artifacts. Test failures mark the build **UNSTABLE** (yellow), not FAILED.

**One-time setup (DevOps)**
1. Agent with label `selenium` and Docker. The build runs in `mcr.microsoft.com/playwright:v1.61.1-noble` (Node + Chromium included). No Docker? See the comment at the top of the Jenkinsfile.
2. Plugins: Pipeline, Docker Pipeline, Credentials Binding, JUnit, HTML Publisher, Timestamper.
3. Credentials (kind *Secret text*): `remitbee-pw-common-password` (test accounts password) and `remitbee-pw-otp` (static OTP).
4. Network access from the agent to `www.cp.wisecapitals.com` and `api.wisecapitals.com`.
5. Create a Pipeline (or Multibranch) job pointing at this repository.

**Try it locally first** (prints the commands without running):
```bash
SUITE=regression DRY_RUN=1 bash ci/jenkins-run.sh
```
Run it for real on your Mac exactly as Jenkins would:
```bash
SUITE=smoke WORKERS=6 bash ci/jenkins-run.sh
```
