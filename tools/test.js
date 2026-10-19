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

const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
check('six tabs are declared', tabs.length === 6, `got ${tabs.length}: ${tabs.join(', ')}`);
for (const t of ['practice', 'plan', 'mock', 'stats', 'verify', 'user']) {
  check(`tab present: ${t}`, tabs.includes(t));
}

const actions = new Set([...appjs.matchAll(/data-action="([^"$]+)"/g)].map((m) => m[1]));
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

for (const fn of ['loadData', 'buildData', 'startPractice', 'renderPracticeHome', 'renderMock', 'renderResults', 'renderStats', 'renderPlan', 'renderVerify', 'catQuestions']) {
  check(`function defined: ${fn}`, new RegExp(`function ${fn}\\s*\\(`).test(appjs));
}

check('references the manifest', appjs.includes("data/questions/index.json"));
check('new-batch wiring present', appjs.includes('DATA.batchNew') && appjs.includes("'start-new'") && appjs.includes("'verify-new'"));

const css = fs.readFileSync(path.join(APPDIR, 'css', 'styles.css'), 'utf8');
check('stylesheet is non-trivial', css.length > 2000, `${css.length} bytes`);

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
