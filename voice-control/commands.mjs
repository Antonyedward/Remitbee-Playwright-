/**
 * voice-control/commands.mjs
 *
 * Turns a spoken sentence into ONE structured command, and turns a structured
 * command into the argument list for ./run.sh.
 *
 * Safety model
 *  - The transcript is never executed. It is only interpreted into a command
 *    object like { intent: 'run_module', module: 'account', mode: 'headless' }.
 *  - buildRunArgs() rebuilds the ./run.sh arguments from that object using the
 *    allow-lists below, and rejects anything else. The server calls it again on
 *    every run request, so a hand-crafted request cannot smuggle in arguments.
 *
 * Understanding
 *  1. Rules first (fast, free, predictable): keywords, module names, test IDs.
 *  2. If the rules cannot tell what was meant and TYPESAFE_API_KEY is set,
 *     Jev (TypeSafe) picks the intent / module / mode / test ID from fixed
 *     option lists. Jev only ever chooses from those lists; it never writes text.
 */

// ── Allow-lists ─────────────────────────────────────────────────────────────

/** module name → spec file number, plus words people may say for it */
export const MODULES = {
  signup:               { file: '00-signup',             say: ['signup', 'sign up', 'registration', 'register'] },
  auth:                 { file: '01-auth',               say: ['auth', 'authentication', 'login', 'log in', 'password'] },
  dashboard:            { file: '02-dashboard',          say: ['dashboard', 'home page'] },
  'send-money':         { file: '03-send-money',         say: ['send money', 'send-money', 'money transfer', 'transfer'] },
  exchange:             { file: '04-exchange',           say: ['exchange', 'currency exchange'] },
  wallet:               { file: '05-wallet',             say: ['wallet', 'wallets', 'balance'] },
  recipients:           { file: '06-recipients',         say: ['recipients', 'recipient', 'beneficiary', 'beneficiaries'] },
  settings:             { file: '07-settings',           say: ['settings', 'setting'] },
  transactions:         { file: '08-transactions',       say: ['transactions', 'transaction', 'history'] },
  rates:                { file: '09-rates',              say: ['rates', 'rate', 'rate alert', 'rate alerts'] },
  rewards:              { file: '10-rewards',            say: ['rewards', 'reward', 'promo', 'promo code'] },
  schedule:             { file: '11-schedule',           say: ['schedule', 'scheduled', 'scheduled transfer', 'scheduled transfers'] },
  verification:         { file: '12-verification',       say: ['verification', 'verify', 'kyc', 'persona'] },
  account:              { file: '13-account',            say: ['account', 'account details', 'profile'] },
  escalation:           { file: '14-escalation',         say: ['escalation', 'escalations', 'resolution centre', 'resolution center'] },
  dtone:                { file: '15-dtone',              say: ['dtone', 'dt one', 'd t one', 'dt 1', 'top up', 'top-up', 'gift card', 'esim', 'e sim'] },
  referral:             { file: '16-referral',           say: ['referral', 'referrals', 'refer', 'invite'] },
  help:                 { file: '17-help',               say: ['help', 'help centre', 'help center', 'support'] },
  'currency-converter': { file: '18-currency-converter', say: ['currency converter', 'converter', 'currency-converter'] },
  voice:                { file: '19-voice',              say: ['voice', 'jev', 'voice browser'] },
};

/** test-ID prefixes that ./run.sh understands */
export const PREFIXES = ['SU', 'PA', 'DB', 'SM', 'CE', 'CADB', 'RC', 'ST', 'TX', 'RW', 'SC', 'VF', 'AC', 'ES', 'DT', 'RV', 'HP', 'CC'];

/** modules that create data on staging (signups, recipients, a $12 schedule, escalations…) */
export const CREATES_DATA = new Set(['signup', 'recipients', 'schedule', 'verification', 'account', 'escalation', 'auth']);

export const INTENTS = {
  run_all:        'Run the whole flow suite (every module, about 2h45m)',
  run_smoke:      'Run only the smoke tests (@smoke)',
  run_regression: 'Run the regression tests (@regression)',
  run_module:     'Run one module (signup, account, escalation, …)',
  run_test:       'Run one or more test cases by ID, e.g. AC-07',
  rerun_failed:   'Run again only the tests that failed in the last run',
  stop:           'Stop the run that is in progress',
  status:         'Say how the current run is going',
  open_report:    'Open the HTML test report',
  confirm_yes:    'Answer yes / go ahead to a pending question',
  confirm_no:     'Answer no / cancel to a pending question',
  none:           'Not a command for the test runner',
};

export const RUN_INTENTS = new Set(['run_all', 'run_smoke', 'run_regression', 'run_module', 'run_test', 'rerun_failed']);

// ── Helpers ─────────────────────────────────────────────────────────────────

const NUMBER_WORDS = {
  zero: 0, oh: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5,
  six: 6, seven: 7, eight: 8, ate: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

function norm(text) {
  return ` ${String(text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

/** "twenty one" → "21", "oh seven" → "07"; leaves digits alone */
function wordsToDigits(s) {
  const toks = s.split(' ');
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t in NUMBER_WORDS) {
      let n = NUMBER_WORDS[t];
      const next = toks[i + 1];
      if (n >= 20 && n % 10 === 0 && next in NUMBER_WORDS && NUMBER_WORDS[next] > 0 && NUMBER_WORDS[next] < 10) {
        n += NUMBER_WORDS[next]; i++;
      }
      out.push(String(n));
    } else out.push(t);
  }
  return out.join(' ');
}

/**
 * Find test IDs in a sentence. Handles "AC-07", "ac 7", "a c oh seven",
 * "AC07", "dt fourteen". Returns normalised IDs like ["AC-07"].
 * Only prefixes from PREFIXES are accepted.
 */
export function extractTestIds(text) {
  let s = norm(text).replace(/-/g, ' ');
  // join spelled letters: "a c" → "ac", "c a d b" → "cadb"
  s = s.replace(/\b((?:[a-z] ){1,3}[a-z])\b/g, (m) => m.replace(/ /g, ''));
  // the words "to", "for", "won" are numbers only right after a prefix; handled in wordsToDigits
  const prefixRe = PREFIXES.slice().sort((a, b) => b.length - a.length).map((p) => p.toLowerCase()).join('|');
  const re = new RegExp(`\\b(${prefixRe})\\s*((?:\\d+|(?:${Object.keys(NUMBER_WORDS).join('|')})(?:\\s+(?:${Object.keys(NUMBER_WORDS).join('|')}))?))(?=\\s|$)`, 'g');
  const ids = [];
  let m;
  while ((m = re.exec(s))) {
    const prefix = m[1].toUpperCase();
    let num = m[2];
    if (!/^\d+$/.test(num)) {
      const d = wordsToDigits(num).replace(/ /g, '');
      // "oh seven" → "07", "twenty one" → "21"
      num = /^\d+$/.test(d) ? d : '';
    }
    if (!num) continue;
    const n = parseInt(num, 10);
    if (!(n >= 1 && n <= 99)) continue;
    ids.push(`${prefix}-${String(n).padStart(2, '0')}`);
  }
  return [...new Set(ids)];
}

export function findModule(text) {
  const s = norm(text);
  let best = null;
  for (const [name, m] of Object.entries(MODULES)) {
    for (const word of m.say) {
      if (s.includes(` ${word} `) && (!best || word.length > best.len)) best = { name, len: word.length };
    }
  }
  return best?.name || null;
}

export function findMode(text) {
  const s = norm(text);
  if (/ (headless|head less|hedless|in the background|background|hidden|without (a |the )?browser|no browser) /.test(s)) return 'headless';
  if (/ (headed|with (a |the )?browser|visible|show (me )?the browser|head mode) /.test(s)) return 'headed';
  return null;
}

// ── Rule-based interpretation ───────────────────────────────────────────────

export function interpretByRules(text, { pending = false } = {}) {
  const s = norm(text);
  const mode = findMode(text);
  if (s.trim() === '') return { intent: 'none' };

  if (pending) {
    if (/^ (yes|yeah|yep|yup|sure|ok|okay|go|go ahead|start|start it|do it|confirm|confirmed|run it|please do)( please)? $/.test(s)) return { intent: 'confirm_yes' };
    if (/^ (no|nope|cancel|don t|do not|stop|never mind|nevermind|not now)( please)? $/.test(s)) return { intent: 'confirm_no' };
  }

  if (/ (stop|cancel|abort|kill|halt) /.test(s) && !/ (run|start|execute) /.test(s.replace(/ (stop|cancel|abort|kill|halt) (the )?run /, ' '))) return { intent: 'stop' };
  if (/ (status|progress|how s it going|how is it going|how far|what s running|what is running|anything failed|any failures so far) /.test(s)) return { intent: 'status' };
  if (/ (open|show)( the| me the)? (html )?report /.test(s)) return { intent: 'open_report' };

  const wantsRun = / (run|rerun|re run|start|execute|test|launch|kick off|trigger) /.test(s);
  if (/ (failed|failures|failing|fails) /.test(s) && (wantsRun || / again /.test(s))) return { intent: 'rerun_failed', mode };

  // "run the DT One module" is the module, not DT-01
  const namedModule = findModule(text);
  if (namedModule && / (module|suite) /.test(s)) return { intent: 'run_module', module: namedModule, mode };

  const ids = extractTestIds(text);
  if (ids.length) return { intent: 'run_test', ids, mode };

  if (/ smoke /.test(s)) return { intent: 'run_smoke', mode };
  if (/ (regression|regressions) /.test(s)) return { intent: 'run_regression', mode };
  if (/ (everything|all tests|all the tests|all modules|full suite|whole suite|entire suite|full run|complete suite) /.test(s) || /^ run all /.test(s)) return { intent: 'run_all', mode };

  const module = namedModule;
  if (module && (wantsRun || / (module|suite|tests) /.test(s) || s.trim().split(' ').length <= 3)) return { intent: 'run_module', module, mode };

  return null; // rules could not decide
}

// ── Jev interpretation (fallback) ───────────────────────────────────────────

let _jev = null;
async function jevClient() {
  if (_jev) return _jev;
  const apiKey = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY;
  if (!apiKey) return null;
  const sdk = await import('@typesafe-ai/sdk');
  const { MODEL } = await import('../flows/voice/jev-src/constants.mjs');
  _jev = {
    sdk,
    model: MODEL,
    client: new sdk.TypeSafeClient({ apiKey, defaultModel: MODEL, timeout: 8000, retry: { maxRetries: 1 }, logLevel: 'off' }),
  };
  return _jev;
}

export function hasJev() {
  return Boolean(process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY);
}

export async function interpretByJev(text, { pending = false, running = false } = {}) {
  const j = await jevClient();
  if (!j) return null;
  const { choice } = j.sdk;

  const moduleCriteria = Object.fromEntries(Object.entries(MODULES).map(([k, m]) => [k, `The ${k} module (people may say: ${m.say.join(', ')})`]));
  moduleCriteria.none = 'No module is named';

  // Test-ID candidates come from code (never generated by Jev); Jev only picks one.
  const idCandidates = extractTestIds(text);

  const questions = {
    intent: choice(
      { question: 'What does the user want the Playwright test runner to do, according to `transcript`?',
        focus: 'The user is a QA engineer controlling an automated test suite by voice. `state.pending_question` is set when the panel is waiting for a yes/no. `state.run_in_progress` says whether tests are running now.' },
      INTENTS,
    ),
    module: choice({ question: 'Which test module does the user name in `transcript`?', focus: 'Only what is said. none if no module is named.' }, moduleCriteria),
    mode: choice(
      { question: 'Does the user ask for the browser to be visible or hidden?', focus: 'headless = no visible browser / in the background. headed = show the browser. unspecified if not said.' },
      { headed: 'Show the browser window (headed)', headless: 'No visible browser (headless, background)', unspecified: 'Not mentioned' },
    ),
  };
  if (idCandidates.length) {
    const c = Object.fromEntries(idCandidates.map((id) => [id, null]));
    c.none = 'No test ID is meant';
    questions.test_id = choice({ question: 'Which test case ID does the user mean?', focus: 'Pick the ID the user asked to run.' }, c);
  }

  const state = { transcript: String(text).slice(-300), pending_question: pending, run_in_progress: running };
  const { data } = await j.client.systemOne({ state, questions, model: j.model }).withResponse();
  const a = data.answers || {};
  const intent = a.intent?.choice || 'none';
  const confidence = a.intent?.confidence ?? 0;
  if (confidence < 0.5) return { intent: 'none', via: 'jev', confidence };

  const out = { intent, via: 'jev', confidence };
  const mode = a.mode?.choice;
  if (mode === 'headed' || mode === 'headless') out.mode = mode;
  if (intent === 'run_module') {
    const m = a.module?.choice;
    if (!m || m === 'none' || !MODULES[m]) return { intent: 'none', via: 'jev', confidence, note: 'module not understood' };
    out.module = m;
  }
  if (intent === 'run_test') {
    const id = a.test_id?.choice;
    if (!id || id === 'none') return { intent: 'none', via: 'jev', confidence, note: 'test ID not understood' };
    out.ids = [id];
  }
  return out;
}

/** Rules first, Jev second. Always returns an object with `intent`. */
export async function interpret(text, ctx = {}) {
  const byRules = interpretByRules(text, ctx);
  if (byRules) return { ...byRules, via: 'rules' };
  if (hasJev()) {
    try {
      const byJev = await interpretByJev(text, ctx);
      if (byJev) return byJev;
    } catch (err) {
      return { intent: 'none', via: 'jev', error: String(err?.message || err) };
    }
  }
  return { intent: 'none', via: 'rules' };
}

// ── Command → ./run.sh arguments (the only way anything gets executed) ──────

const ID_RE = /^([A-Z]{2,4})-(\d{2})$/;

/**
 * Validate a command object and return { args, label, longRun, createsData }.
 * Throws on anything outside the allow-lists.
 */
export function buildRunArgs(cmd) {
  if (!cmd || !RUN_INTENTS.has(cmd.intent)) throw new Error('Not a run command');
  const mode = cmd.mode === 'headless' ? 'headless' : 'headed';
  let what;
  let label;
  let longRun = false;
  let createsData = false;

  switch (cmd.intent) {
    case 'run_all':        what = 'all';        label = 'the whole suite'; longRun = true; createsData = true; break;
    case 'run_smoke':      what = 'smoke';      label = 'the smoke tests'; break;
    case 'run_regression': what = 'regression'; label = 'the regression tests'; longRun = true; createsData = true; break;
    case 'rerun_failed':   what = 'failed';     label = 'the tests that failed last time'; break;
    case 'run_module': {
      if (!MODULES[cmd.module]) throw new Error(`Unknown module: ${cmd.module}`);
      what = cmd.module; label = `the ${cmd.module} module`;
      createsData = CREATES_DATA.has(cmd.module);
      break;
    }
    case 'run_test': {
      const ids = Array.isArray(cmd.ids) ? cmd.ids : [];
      if (!ids.length || ids.length > 10) throw new Error('Give between 1 and 10 test IDs');
      const parsed = ids.map((id) => {
        const m = ID_RE.exec(String(id));
        if (!m || !PREFIXES.includes(m[1])) throw new Error(`Not a valid test ID: ${id}`);
        return m;
      });
      const prefix = parsed[0][1];
      if (parsed.some((m) => m[1] !== prefix)) throw new Error('Test IDs must share one prefix (e.g. AC-07 and AC-16)');
      const nums = [...new Set(parsed.map((m) => m[2]))];
      what = nums.length === 1 ? `${prefix}-${nums[0]}` : `${prefix}-(${nums.join('|')})`;
      label = nums.length === 1 ? `test ${prefix}-${nums[0]}` : `tests ${nums.map((n) => `${prefix}-${n}`).join(', ')}`;
      break;
    }
    default: throw new Error('Not a run command');
  }
  return { args: [what, mode], label: `${label}, ${mode}`, longRun, createsData };
}

/** One sentence the panel shows and speaks back before starting. */
export function describe(cmd) {
  switch (cmd.intent) {
    case 'stop': return 'Stop the current run.';
    case 'status': return 'Report the status of the current run.';
    case 'open_report': return 'Open the HTML report.';
    case 'confirm_yes': return 'Yes.';
    case 'confirm_no': return 'No.';
    case 'none': return "I didn't catch a test-runner command.";
    default: {
      try {
        const b = buildRunArgs(cmd);
        let s = `Run ${b.label}.`;
        if (b.longRun) s += ' This takes a long time.';
        if (b.createsData) s += ' It creates test data on staging.';
        return s;
      } catch (e) { return String(e.message); }
    }
  }
}
