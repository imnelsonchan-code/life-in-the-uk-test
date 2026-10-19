#!/usr/bin/env node
/**
 * Regression test suite for the Life in the UK app.
 *
 * Two layers:
 *   1. Invariants — rules that must ALWAYS hold (schema shapes, unique ids,
 *      every button wired to a handler, manifest matches the files).
 *   2. Snapshot — the exact pool contents (counts and every id). Differences
 *      mean something changed; that is either a bug or an intentional edit.
 *
 * Usage:
 *   node tools/test.js              # run the suite
 *   node tools/test.js --update     # re-record the snapshot after an intended change
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QDIR = path.join(ROOT, 'app', 'data', 'questions');
const APPDIR = path.join(ROOT, 'app');
const SNAPSHOT = path.join(__dirname, 'snapshot.json');

const UPDATE = process.argv.includes('--update');

const CATEGORIES = [
  { id: 'values_principles', prefix: 'val' },
  { id: 'what_is_uk', prefix: 'uk' },
  { id: 'history', prefix: 'hist' },
  { id: 'modern_society', prefix: 'soc' },
  { id: 'government_law', prefix: 'gov' },
];
const CAT_IDS = new Set(CATEGORIES.map((c) => c.id));
const PREFIX = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.prefix]));

const SHAPES = {
  single: { opts: [4], ans: 1 },
  truefalse: { opts: [2], ans: 1 },
  two: { opts: [4, 5], ans: 2 },
  statement: { opts: [4], ans: 1 },
};

let pass = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) pass++;
  else failures.push(name + (detail ? ` — ${detail}` : ''));
}

function section(title) {
  console.log(`\n${title}`);
}

/* ---------------------------------------------------------------- load --- */

const manifest = JSON.parse(fs.readFileSync(path.join(QDIR, 'index.json'), 'utf8'));
const files = fs.readdirSync(QDIR).filter((f) => f.endsWith('.json') && f !== 'index.json');

const pool = [];
const byCat = {};
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  if (!Array.isArray(arr)) failures.push(`file is not an array: ${f}`);
  pool.push(...arr);
}
for (const q of pool) {
  if (!byCat[q.category]) byCat[q.category] = [];
  byCat[q.category].push(q);
}

/* ----------------------------------------------------------- invariants --- */

section('Schema invariants');

check('pool is not empty', pool.length > 0, `got ${pool.length}`);
check(
  'every category is present',
  CATEGORIES.every((c) => (byCat[c.id] || []).length > 0),
  CATEGORIES.filter((c) => !(byCat[c.id] || []).length).map((c) => c.id).join(', ')
);

const idSeen = new Map();
const reqFields = ['id', 'category', 'subcategory', 'type', 'difficulty', 'question', 'options', 'answer', 'explanation', 'source'];
let shapeErrors = 0;
let prefixErrors = 0;
let fieldErrors = 0;
let dupIds = 0;

for (const q of pool) {
  for (const f of reqFields) {
    if (q[f] === undefined || q[f] === null || q[f] === '') {
      fieldErrors++;
      break;
    }
  }
  if (idSeen.has(q.id)) dupIds++;
  idSeen.set(q.id, q);

  if (!CAT_IDS.has(q.category)) fieldErrors++;
  const expectPrefix = PREFIX[q.category];
  if (expectPrefix && !String(q.id).startsWith(expectPrefix + '-')) prefixErrors++;

  const shape = SHAPES[q.type];
  if (!shape) {
    shapeErrors++;
    continue;
  }
  if (!Array.isArray(q.options) || !shape.opts.includes(q.options.length)) shapeErrors++;
  if (!Array.isArray(q.answer) || q.answer.length !== shape.ans) shapeErrors++;
  if (Array.isArray(q.answer)) {
    if (new Set(q.answer).size !== q.answer.length) shapeErrors++;
    if (q.answer.some((i) => !Number.isInteger(i) || i < 0 || i >= (q.options || []).length)) shapeErrors++;
  }
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) fieldErrors++;
  if (q.type === 'truefalse' && JSON.stringify(q.options) !== JSON.stringify(['True', 'False'])) shapeErrors++;
  if (q.type === 'two' && !/^Which TWO/.test(q.question)) shapeErrors++;
  if (q.type === 'statement' && q.question !== 'Which of these statements is correct?') shapeErrors++;
}

check('no missing required fields', fieldErrors === 0, `${fieldErrors} question(s)`);
check('no duplicate ids', dupIds === 0, `${dupIds} duplicate(s)`);
check('ids match their category prefix', prefixErrors === 0, `${prefixErrors} mismatch(es)`);
check('every question matches its type shape', shapeErrors === 0, `${shapeErrors} problem(s)`);

const sigSeen = new Set();
let dupSigs = 0;
for (const q of pool) {
  const sig = String(q.question).toLowerCase() + '||' + (q.options || []).map((o) => String(o).toLowerCase()).sort().join('|');
  if (sigSeen.has(sig)) dupSigs++;
  sigSeen.add(sig);
}
check('no two questions share the same wording and options', dupSigs === 0, `${dupSigs} pair(s)`);

const batchPairs = pool.filter((q) => q.batch);
const badBatch = batchPairs.filter((q) => q.batch !== 'new');
check('only known batch values are used', badBatch.length === 0, [...new Set(badBatch.map((q) => q.batch))].join(', '));

/* ------------------------------------------------------------- manifest --- */

section('Manifest');

check('manifest total equals the pool size', manifest.total === pool.length, `${manifest.total} vs ${pool.length}`);
for (const c of manifest.categories) {
  const inFile = JSON.parse(fs.readFileSync(path.join(QDIR, c.file), 'utf8')).length;
  check(`manifest count matches file: ${c.file}`, c.count === inFile, `${c.count} vs ${inFile}`);
}
check(
  'manifest covers every pool file',
  files.length === manifest.categories.length,
  `${files.length} files vs ${manifest.categories.length} manifest rows`
);

/* -------------------------------------------------------------- archive --- */

section('Removed-question archive');

const archivePath = path.join(ROOT, 'app', 'data', 'removed', 'duplicates.json');
check('archive file exists', fs.existsSync(archivePath));
if (fs.existsSync(archivePath)) {
  const arch = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
  check('archive is non-empty', arch.length > 0, `got ${arch.length}`);
  const stillPresent = arch.filter((a) => idSeen.has(a.id)).map((a) => a.id);
  check('no archived question is still in the pool', stillPresent.length === 0, stillPresent.join(', '));
  const archDup = arch.length - new Set(arch.map((a) => a.id)).size;
  check('no duplicate entries in the archive', archDup === 0, `${archDup}`);
}

/* --------------------------------------------------------- app wiring --- */

section('App wiring');

const html = fs.readFileSync(path.join(APPDIR, 'index.html'), 'utf8');
const appjs = fs.readFileSync(path.join(APPDIR, 'js', 'app.js'), 'utf8');

// Parse (without running) the script: a stray apostrophe or brace in the plan
// text otherwise slips past every other check and only shows up as a blank page.
let parseError = null;
try {
  new Function(appjs);
} catch (e) {
  parseError = e.message;
}
check('app.js parses as JavaScript', parseError === null, parseError || '');

const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
check('six tabs are declared', tabs.length === 6, `got ${tabs.length}: ${tabs.join(', ')}`);
for (const t of ['practice', 'plan', 'mock', 'stats', 'cheat', 'user']) {
  check(`tab present: ${t}`, tabs.includes(t));
}

const actions = new Set([
  ...[...appjs.matchAll(/data-action="([^"$]+)"/g)].map((m) => m[1]),
  // Plan days carry their action in data — go: { action: 'start-mock' } — and
  // render it dynamically, so those escape the data-action scan above.
  ...[...appjs.matchAll(/\baction: '([a-z-]+)'/g)].map((m) => m[1]),
]);
// An action is "handled" if it appears in a switch case, or is targeted by a
// delegated listener such as closest('[data-action="x"]') / dataset.action === 'x'.
const handled = new Set([
  ...[...appjs.matchAll(/case '([^']+)'/g)].map((m) => m[1]),
  ...[...appjs.matchAll(/closest\('\[data-action="([^"]+)"\]'\)/g)].map((m) => m[1]),
  ...[...appjs.matchAll(/dataset\.action === '([^']+)'/g)].map((m) => m[1]),
]);
const unhandled = [...actions].filter((a) => !handled.has(a));
check('every data-action has a handler', unhandled.length === 0, unhandled.join(', '));

// The reverse: a handler wired to an action no template ever emits is dead code.
const deadHandlers = [...handled].filter((a) => !actions.has(a));
check('no handler is wired to an action nothing emits', deadHandlers.length === 0, deadHandlers.join(', '));

for (const fn of ['loadData', 'buildData', 'startPractice', 'renderPracticeHome', 'renderMock', 'renderResults', 'renderStats', 'renderPlan', 'renderCheatsheet']) {
  check(`function defined: ${fn}`, new RegExp(`function ${fn}\\s*\\(`).test(appjs));
}

check('references the manifest', appjs.includes("data/questions/index.json"));
check('new-batch wiring present', appjs.includes('DATA.batchNew') && appjs.includes("'start-new'"));

const css = fs.readFileSync(path.join(APPDIR, 'css', 'styles.css'), 'utf8');
check('stylesheet is non-trivial', css.length > 2000, `${css.length} bytes`);

/* --------------------------------------------------- home-screen app --- */

section('Home-screen app');

const manifestPath = path.join(APPDIR, 'manifest.webmanifest');
check('manifest exists', fs.existsSync(manifestPath));
if (fs.existsSync(manifestPath)) {
  let man = null;
  try {
    man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    check('manifest is valid JSON', false, e.message);
  }
  if (man) {
    check('manifest is valid JSON', true);
    check('manifest has a name', !!man.name && !!man.short_name);
    check('manifest has a description', !!man.description);
    check('manifest opens standalone', man.display === 'standalone', man.display);
    check('manifest start_url is app-relative', /^\./.test(man.start_url), man.start_url);
    check('manifest scope is app-relative', /^\./.test(man.scope), man.scope);
    check('manifest sets a theme colour', !!man.theme_color, man.theme_color);
    const sizes = (man.icons || []).map((i) => i.sizes);
    check('manifest icon is 192', sizes.includes('192x192'), sizes.join(','));
    check('manifest icon is 512', sizes.includes('512x512'), sizes.join(','));
    check('manifest has a maskable icon', (man.icons || []).some((i) => /maskable/.test(i.purpose || '')));
    for (const icon of man.icons || []) {
      check(`icon on disk: ${icon.src}`, fs.existsSync(path.join(APPDIR, icon.src)));
    }
    // The icons must sit inside the declared scope: GitHub Pages serves app/.
    check(
      'icons stay inside the app directory',
      (man.icons || []).every((i) => !i.src.startsWith('/') && !i.src.startsWith('..'))
    );
  }
}

check('apple-touch-icon on disk', fs.existsSync(path.join(APPDIR, 'icons', 'apple-touch-icon.png')));
check('vector favicon on disk', fs.existsSync(path.join(APPDIR, 'icons', 'icon.svg')));

const swPath = path.join(APPDIR, 'sw.js');
check('service worker exists', fs.existsSync(swPath));
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8');
  check('service worker handles fetches', /addEventListener\('fetch'/.test(sw));
  check('service worker uses the Cache API', /caches\s*\.\s*open\(/.test(sw));
  check('service worker ignores cross-origin requests', /origin !== self\.location\.origin/.test(sw));
  check('service worker names its cache from ?v=', /\?v=/.test(sw) || /searchParams/.test(sw));
}

check('index.html links the manifest', /rel="manifest"/.test(html));
check('index.html links the apple-touch-icon', /rel="apple-touch-icon"/.test(html));
check('index.html links a vector favicon', /rel="icon"[^>]*image\/svg\+xml/.test(html));
check('index.html declares a theme colour', /name="theme-color"/.test(html));
check('header has the install button', /id="installBtn"/.test(html));
check(
  'install button is labelled for assistive tech',
  /id="installBtn"[\s\S]{0,200}?aria-label="[^"]+"/.test(html)
);
check('install button starts hidden', /id="installBtn"[\s\S]{0,300}?hidden/.test(html));
check('app.js wires the install button', /getElementById\('installBtn'\)/.test(appjs));
check('app.js keeps the browser install prompt', /beforeinstallprompt/.test(appjs));
check('app.js handles appinstalled', /'appinstalled'/.test(appjs));
check('app.js hides the button once installed', /display-mode: standalone/.test(appjs));
check('app.js registers the service worker', /serviceWorker\.register\('sw\.js\?v=/.test(appjs));

/* ------------------------------------------------------------ cheat sheet --- */

section('Cheat sheet');

const cheatSrc = path.join(ROOT, 'Cheat_Sheet.md');
const cheatJson = path.join(APPDIR, 'data', 'cheatsheet.json');

check('the notes source is present', fs.existsSync(cheatSrc));
check('the build tool is present', fs.existsSync(path.join(ROOT, 'tools', 'build-cheatsheet.js')));
check('cheatsheet.json exists', fs.existsSync(cheatJson));
check('app.js loads the cheat sheet', appjs.includes('data/cheatsheet.json'));
check('index.html declares the cheat tab', /data-tab="cheat"/.test(html));
check('app.js renders the cheat sheet', /function renderCheatsheet\s*\(/.test(appjs));
check('app.js wires the cheat tab into the renderer', /ui\.tab === 'cheat'[\s\S]{0,40}renderCheatsheet\(\)/.test(appjs));
check('every category row offers its chapter', /data-action="cheat-open" data-ch=/.test(appjs));

if (fs.existsSync(cheatJson) && fs.existsSync(cheatSrc)) {
  const cheat = JSON.parse(fs.readFileSync(cheatJson, 'utf8'));
  const hash = require('crypto').createHash('sha256').update(fs.readFileSync(cheatSrc, 'utf8')).digest('hex').slice(0, 16);
  check('cheatsheet.json is up to date with the notes', cheat.sourceHash === hash, 'run: node tools/build-cheatsheet.js');
  check(
    'one chapter per pool category, in pool order',
    cheat.chapters.map((c) => c.id).join(',') === CATEGORIES.map((c) => c.id).join(','),
    cheat.chapters.map((c) => c.id).join(',')
  );
  check(
    'every chapter is named after its pool category',
    cheat.chapters.every((c) => manifest.categories.some((m) => m.id === c.id && m.name === c.name))
  );
  check('every chapter has a chip label', cheat.chapters.every((c) => !!c.chip));
  check('every chapter has sections', cheat.chapters.every((c) => c.sections.length > 0));
  check('every section has blocks', cheat.chapters.every((c) => c.sections.every((s) => s.blocks.length > 0)));
  check(
    'block types are known',
    cheat.chapters.every((c) =>
      c.sections.every((s) => s.blocks.every((b) => ['p', 'ul', 'table', 'quote'].indexOf(b.t) >= 0))
    )
  );
  const texts = [];
  for (const c of cheat.chapters) {
    for (const s of c.sections) {
      for (const b of s.blocks) {
        if (b.t === 'table') {
          b.head.forEach((x) => texts.push(x));
          b.rows.forEach((r) => r.forEach((x) => texts.push(x)));
        } else if (b.t === 'ul') {
          b.items.forEach((i) => {
            texts.push(i.html);
            (i.sub || []).forEach((x) => texts.push(x));
          });
        } else if (b.t === 'quote') {
          b.paras.forEach((p) => p.forEach((x) => texts.push(x)));
        } else if (b.html) texts.push(b.html);
      }
    }
  }
  check('no markdown emphasis survives the build', !texts.some((t) => /\*\*|_[_a-z]/.test(t)));
  check('no HTML is left unescaped', !texts.some((t) => /<(?!\/?(strong|em)>)/.test(t)));
  check('the notes have something in every chapter', cheat.chapters.length === CATEGORIES.length);
}

/* --------------------------------------------------------- verify sheets --- */

section('Verification sheets');

for (const c of CATEGORIES) {
  const p = path.join(ROOT, 'verify', `${c.id}.md`);
  check(`sheet exists: ${c.id}.md`, fs.existsSync(p));
  if (!fs.existsSync(p)) continue;
  const txt = fs.readFileSync(p, 'utf8');
  const m = /(\d+)\s+fact claims/.exec(txt);
  const claims = m ? Number(m[1]) : -1;
  const actual = (byCat[c.id] || []).length;
  check(`sheet claim count matches the pool: ${c.id}`, claims === actual, `sheet says ${claims}, pool has ${actual}`);
}

/* ------------------------------------------------------------- snapshot --- */

section('Snapshot');

function buildSnapshot() {
  const byType = {};
  const byDiff = {};
  for (const q of pool) {
    byType[q.type] = (byType[q.type] || 0) + 1;
    byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
  }
  return {
    total: pool.length,
    categories: Object.fromEntries(CATEGORIES.map((c) => [c.id, (byCat[c.id] || []).length])),
    types: byType,
    difficulties: byDiff,
    batchNew: pool.filter((q) => q.batch === 'new').length,
    ids: pool.map((q) => q.id).sort(),
  };
}

const snap = buildSnapshot();

if (UPDATE || !fs.existsSync(SNAPSHOT)) {
  fs.writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 2) + '\n');
  console.log(`  snapshot ${UPDATE ? 'updated' : 'created'}: ${snap.total} questions, ${snap.batchNew} in the new batch`);
} else {
  const prev = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  check('total question count unchanged', prev.total === snap.total, `${prev.total} -> ${snap.total}`);
  check('new-batch count unchanged', prev.batchNew === snap.batchNew, `${prev.batchNew} -> ${snap.batchNew}`);
  for (const c of CATEGORIES) {
    check(`count unchanged: ${c.id}`, prev.categories[c.id] === snap.categories[c.id], `${prev.categories[c.id]} -> ${snap.categories[c.id]}`);
  }
  for (const k of Object.keys(snap.types)) {
    check(`type count unchanged: ${k}`, prev.types[k] === snap.types[k], `${prev.types[k]} -> ${snap.types[k]}`);
  }
  const prevIds = new Set(prev.ids);
  const nowIds = new Set(snap.ids);
  const added = snap.ids.filter((i) => !prevIds.has(i));
  const removed = prev.ids.filter((i) => !nowIds.has(i));
  check('no ids added', added.length === 0, added.slice(0, 12).join(', '));
  check('no ids removed', removed.length === 0, removed.slice(0, 12).join(', '));
}

/* --------------------------------------------------------------- report --- */

console.log('');
if (failures.length === 0) {
  console.log(`  PASS — ${pass} checks passed.`);
  process.exit(0);
}
console.log(`  FAIL — ${failures.length} of ${pass + failures.length} checks failed:\n`);
for (const f of failures) console.log(`    ✗ ${f}`);
console.log('');
process.exit(1);
