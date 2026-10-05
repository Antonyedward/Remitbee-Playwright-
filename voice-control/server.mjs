/**
 * voice-control/server.mjs — local voice control panel for the flow suite.
 *
 *   ./run.sh control          (or)   npm run voice:control
 *   then open http://localhost:4000 in Chrome and allow the microphone.
 *
 * - Listens on 127.0.0.1 only (nothing outside your Mac can reach it).
 * - Runs ./run.sh with arguments rebuilt from an allow-list (commands.mjs);
 *   spoken text is never passed to a shell.
 * - One run at a time. "Stop" kills the whole run (Playwright + browser).
 * - Streams progress to the page with Server-Sent Events.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { interpret, buildRunArgs, describe, hasJev, RUN_INTENTS } from './commands.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.env.VOICE_CONTROL_PORT || 4000);

// Load .env (TYPESAFE_API_KEY) the same way the suite does.
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(ROOT, '.env') });
} catch { /* dotenv missing: Jev fallback just stays off */ }

// ── Run state ───────────────────────────────────────────────────────────────

const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
const MAX_LOG = 400;

let run = null;          // the current / last run
const clients = new Set(); // SSE connections

function newRun(cmd, built) {
  return {
    id: Date.now(),
    command: cmd,
    label: built.label,
    args: built.args,
    startedAt: Date.now(),
    finishedAt: null,
    state: 'running',     // running | passed | failed | stopped | error
    total: null,
    passed: 0, failed: 0, skipped: 0, flaky: 0,
    current: null,
    failures: [],         // [{ id, title }]
    log: [],
    child: null,
    exitCode: null,
  };
}

function publicRun(r = run) {
  if (!r) return null;
  const { child, log, ...rest } = r;
  return { ...rest, done: r.passed + r.failed + r.skipped, elapsedSec: Math.round(((r.finishedAt || Date.now()) - r.startedAt) / 1000) };
}

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

/** Pull the test ID ("AC-07") and a short title out of a list-reporter line. */
function testName(line) {
  const parts = line.split(' › ');
  const title = (parts[parts.length - 1] || line).replace(/\s*\(\d+(\.\d+)?m?s\)\s*$/, '').trim();
  const id = (title.match(/\b([A-Z]{2,4}-\d{2})\b/) || [])[1] || null;
  return { id, title: title.slice(0, 140) };
}

function onLine(raw) {
  const line = raw.replace(ANSI, '').replace(/\r/g, '');
  if (!line.trim()) return;
  run.log.push(line);
  if (run.log.length > MAX_LOG) run.log.shift();
  broadcast('log', { line });

  let m;
  if ((m = line.match(/Running (\d+) tests? using/))) {
    run.total = Number(m[1]);
  } else if (/^\s*✓/.test(line) || /^\s*ok \d+/.test(line)) {
    run.passed++; run.current = testName(line);
  } else if (/^\s*[✘×x]\s+\d+/.test(line) || /^\s*✘/.test(line)) {
    const t = testName(line);
    // Playwright prints a retried failure twice; count each test once
    if (!run.failures.some((f) => f.title === t.title)) { run.failed++; run.failures.push(t); broadcast('failure', t); }
  } else if (/^\s*-\s+\d+\s/.test(line)) {
    run.skipped++;
  } else if (/^\s*\d+\s+\[flow-chromium\]/.test(line)) {
    run.current = testName(line);
  }
  broadcast('progress', publicRun());
}

function startRun(cmd) {
  if (run && run.state === 'running') throw new Error(`Already running ${run.label}. Say "stop" first.`);
  const built = buildRunArgs(cmd); // validates again — never trust the page
  run = newRun(cmd, built);

  const child = spawn(path.join(ROOT, 'run.sh'), built.args, {
    cwd: ROOT,
    detached: true, // own process group so "stop" can kill browser + workers
    env: { ...process.env, FORCE_COLOR: '0', CI: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  run.child = child;

  let buf = '';
  const feed = (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    lines.forEach(onLine);
  };
  child.stdout.on('data', feed);
  child.stderr.on('data', feed);
  child.on('error', (err) => {
    run.state = 'error'; run.finishedAt = Date.now();
    broadcast('finished', { ...publicRun(), error: String(err.message) });
  });
  child.on('close', (code) => {
    if (buf) onLine(buf);
    run.exitCode = code;
    run.finishedAt = Date.now();
    if (run.state === 'running') run.state = run.failed > 0 || (code !== 0 && run.passed === 0) ? 'failed' : 'passed';
    run.child = null;
    broadcast('finished', publicRun());
  });

  console.log(`▶ ./run.sh ${built.args.join(' ')}`);
  broadcast('started', publicRun());
  return publicRun();
}

function stopRun() {
  if (!run || run.state !== 'running' || !run.child) return false;
  run.state = 'stopped';
  const pid = run.child.pid;
  try { process.kill(-pid, 'SIGTERM'); } catch { /* already gone */ }
  setTimeout(() => { try { process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } }, 4000);
  return true;
}

function openReport() {
  const p = spawn('npx', ['playwright', 'show-report'], { cwd: ROOT, detached: true, stdio: 'ignore' });
  p.unref();
}

function statusSentence() {
  if (!run) return 'Nothing has run yet.';
  const r = publicRun();
  const counts = `${r.passed} passed, ${r.failed} failed${r.skipped ? `, ${r.skipped} skipped` : ''}`;
  const fails = r.failures.length ? ` Failed: ${r.failures.slice(0, 5).map((f) => f.id || f.title).join(', ')}.` : '';
  const mins = Math.round(r.elapsedSec / 60);
  if (r.state === 'running') {
    return `Running ${r.label}. ${r.done}${r.total ? ` of ${r.total}` : ''} done: ${counts}.${fails} ${mins} minute${mins === 1 ? '' : 's'} so far.`;
  }
  return `Last run, ${r.label}, ${r.state}. ${counts}.${fails}`;
}

// ── HTTP ────────────────────────────────────────────────────────────────────

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 10_000) throw new Error('Request too large'); }
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Only accept requests from this panel (blocks other websites in your browser).
  if (req.method === 'POST') {
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return send(res, 403, { error: 'Forbidden origin' });
  }

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, readFileSync(path.join(HERE, 'index.html')), 'text/html; charset=utf-8');
    }

    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`event: hello\ndata: ${JSON.stringify({ run: publicRun(), log: run?.log.slice(-80) || [], jev: hasJev() })}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      return send(res, 200, { run: publicRun(), sentence: statusSentence(), jev: hasJev() });
    }

    // Understand a sentence. Does NOT run anything.
    if (req.method === 'POST' && url.pathname === '/api/interpret') {
      const { text, pending } = await readJson(req);
      const cmd = await interpret(String(text || ''), { pending: Boolean(pending), running: run?.state === 'running' });
      let needsConfirm = false;
      let error = null;
      if (RUN_INTENTS.has(cmd.intent)) {
        try { buildRunArgs(cmd); needsConfirm = true; } catch (e) { error = e.message; }
      }
      return send(res, 200, { command: cmd, summary: error || describe(cmd), needsConfirm, error });
    }

    // Execute a confirmed command object.
    if (req.method === 'POST' && url.pathname === '/api/execute') {
      const { command } = await readJson(req);
      const intent = command?.intent;
      if (intent === 'stop') return send(res, 200, { ok: stopRun(), sentence: run?.state === 'stopped' ? 'Stopping the run.' : 'Nothing is running.' });
      if (intent === 'status') return send(res, 200, { ok: true, sentence: statusSentence() });
      if (intent === 'open_report') { openReport(); return send(res, 200, { ok: true, sentence: 'Opening the report.' }); }
      if (RUN_INTENTS.has(intent)) {
        const r = startRun(command);
        return send(res, 200, { ok: true, run: r, sentence: `Starting ${r.label}.` });
      }
      return send(res, 400, { ok: false, sentence: "That isn't a command I can run." });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (err) {
    return send(res, 400, { ok: false, error: String(err.message || err), sentence: String(err.message || err) });
  }
});

if (!existsSync(path.join(ROOT, 'run.sh'))) {
  console.error('run.sh not found next to voice-control/. Start this from the remitbee-playwright folder.');
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🎙  Voice control panel: http://localhost:${PORT}  (open in Chrome, allow the microphone)`);
  console.log(`   Jev understanding: ${hasJev() ? 'on (TYPESAFE_API_KEY found)' : 'off — rules only (add TYPESAFE_API_KEY to .env to turn it on)'}`);
  console.log('   Ctrl+C here stops the panel (and any run it started).\n');
});

function shutdown() {
  stopRun();
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
