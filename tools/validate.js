#!/usr/bin/env node
/**
 * Validator for the Life in the UK question pool.
 *
 * Usage:  node tools/validate.js
 *
 * Checks every file in app/data/questions/*.json against the schema in
 * app/data/schema.md. Exits with code 1 if any ERROR is found.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const QUESTIONS_DIR = path.join(__dirname, '..', 'app', 'data', 'questions');

const CATEGORY_PREFIX = {
  values_principles: 'val',
  what_is_uk: 'uk',
  history: 'hist',
  modern_society: 'soc',
  government_law: 'gov',
};

const TYPES = new Set(['single', 'truefalse', 'two', 'statement']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

const errors = [];
const warnings = [];
let total = 0;

function err(file, id, msg) {
  errors.push(`${file}${id ? ` [${id}]` : ''}: ${msg}`);
}
function warn(file, id, msg) {
  warnings.push(`${file}${id ? ` [${id}]` : ''}: ${msg}`);
}

/** Normalise question text for duplicate detection. */
function norm(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateQuestion(file, q, seenIds, seenText) {
  total++;
  const id = q && q.id;

  if (!isNonEmptyString(id)) {
    err(file, null, 'missing id');
    return;
  }
  if (!/^[a-z]+-\d{4}$/.test(id)) {
    err(file, id, 'id must match <prefix>-<4 digits> e.g. hist-0001');
  }
  if (seenIds.has(id)) {
    err(file, id, 'duplicate id (also in ' + seenIds.get(id) + ')');
  } else {
    seenIds.set(id, file);
  }

  const expectedPrefix = CATEGORY_PREFIX[q.category];
  if (!expectedPrefix) {
    err(file, id, `unknown category "${q.category}"`);
  } else if (isNonEmptyString(id) && !id.startsWith(expectedPrefix + '-')) {
    err(file, id, `id prefix does not match category ${q.category} (expected ${expectedPrefix}-)`);
  }

  if (file !== q.category + '.json') {
    warn(file, id, `category "${q.category}" does not match filename "${file}"`);
  }

  if (!isNonEmptyString(q.subcategory)) err(file, id, 'missing/empty subcategory');
  else if (/\s/.test(q.subcategory)) warn(file, id, `subcategory should be kebab-case: "${q.subcategory}"`);

  if (!TYPES.has(q.type)) err(file, id, `invalid type "${q.type}"`);
  if (!DIFFICULTIES.has(q.difficulty)) err(file, id, `invalid difficulty "${q.difficulty}"`);

  if (!isNonEmptyString(q.question)) {
    err(file, id, 'missing/empty question');
  } else {
    if (q.question !== q.question.trim()) warn(file, id, 'question has leading/trailing whitespace');
    // For "statement" questions the prompt is generic ("Which of these statements
    // is correct?") and the content lives in the options, so include them in the key.
    const dkey =
      norm(q.question) +
      (q.type === 'statement' && Array.isArray(q.options) ? ' :: ' + q.options.map(norm).join(' | ') : '');
    if (seenText.has(dkey)) err(file, id, `duplicate question text (also ${seenText.get(dkey)})`);
    else seenText.set(dkey, id);
    if (/^which two/i.test(q.question) && q.type !== 'two') {
      warn(file, id, '"Which TWO" question but type is not "two"');
    }
    if (q.type === 'two' && !/^which two/i.test(q.question)) {
      warn(file, id, 'type "two" but question does not start with "Which TWO"');
    }
    if (/^which two/i.test(q.question)) {
      const m = q.question.match(/which two/i);
      if (m && !/two of|two of these|which two/i.test(q.question)) {
        // no-op; kept for clarity
      }
    }
  }

  // options
  if (!Array.isArray(q.options)) {
    err(file, id, 'options must be an array');
    return;
  }
  const opts = q.options;
  if (opts.some((o) => !isNonEmptyString(o))) err(file, id, 'every option must be a non-empty string');
  const normOpts = opts.map(norm);
  if (new Set(normOpts).size !== normOpts.length) err(file, id, 'duplicate option values');

  const expected = {
    single: { len: [4], ans: 1 },
    truefalse: { len: [2], ans: 1 },
    two: { len: [4, 5], ans: 2 },
    statement: { len: [4], ans: 1 },
  }[q.type];

  if (expected) {
    if (!expected.len.includes(opts.length)) {
      err(file, id, `type "${q.type}" expects ${expected.len.join(' or ')} options, got ${opts.length}`);
    }
  }
  if (q.type === 'truefalse') {
    const [a, b] = opts.map(norm);
    if (!((a === 'true' && b === 'false') || (a === 'false' && b === 'true'))) {
      err(file, id, 'truefalse options must be ["True", "False"]');
    }
  }

  // answer
  if (!Array.isArray(q.answer)) {
    err(file, id, 'answer must be an array');
    return;
  }
  if (expected && q.answer.length !== expected.ans) {
    err(file, id, `type "${q.type}" expects ${expected.ans} answer index(es), got ${q.answer.length}`);
  }
  if (new Set(q.answer).size !== q.answer.length) err(file, id, 'answer indexes are not unique');
  for (const i of q.answer) {
    if (!Number.isInteger(i)) err(file, id, `answer index "${i}" is not an integer`);
    else if (i < 0 || i >= opts.length) err(file, id, `answer index ${i} out of range (0..${opts.length - 1})`);
  }

  if (!isNonEmptyString(q.explanation)) err(file, id, 'missing/empty explanation');
  else if (q.explanation.trim().length < 20) warn(file, id, 'explanation is very short');

  if (!isNonEmptyString(q.source)) err(file, id, 'missing/empty source');
}

function main() {
  if (!fs.existsSync(QUESTIONS_DIR)) {
    console.error(`No questions directory at ${QUESTIONS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(QUESTIONS_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .sort();

  if (files.length === 0) {
    console.error('No question files found.');
    process.exit(1);
  }

  const seenIds = new Map();
  const seenText = new Map();
  const perFile = {};

  for (const file of files) {
    const full = path.join(QUESTIONS_DIR, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      err(file, null, `JSON parse error: ${e.message}`);
      continue;
    }
    if (!Array.isArray(data)) {
      err(file, null, 'top level must be an array');
      continue;
    }
    perFile[file] = data.length;
    data.forEach((q, idx) => {
      try {
        validateQuestion(file, q, seenIds, seenText);
      } catch (e) {
        err(file, (q && q.id) || `index ${idx}`, `threw: ${e.message}`);
      }
    });
  }

  console.log('=== Question pool validation ===\n');
  for (const f of files) console.log(`  ${f.padEnd(28)} ${String(perFile[f] ?? 0).padStart(4)} questions`);
  console.log(`\n  TOTAL: ${total} questions in ${files.length} files`);

  // index.json sanity
  const indexPath = path.join(QUESTIONS_DIR, 'index.json');
  if (fs.existsSync(indexPath)) {
    try {
      const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      const listed = Array.isArray(idx) ? idx : idx.files || idx.categories || [];
      const names = listed.map((e) => (typeof e === 'string' ? e : e.file)).filter(Boolean);
      for (const f of files) if (!names.includes(f)) warn('index.json', null, `does not list ${f}`);
      for (const n of names) if (!files.includes(n)) warn('index.json', null, `lists missing file ${n}`);
    } catch (e) {
      warn('index.json', null, `could not parse: ${e.message}`);
    }
  } else {
    warn('index.json', null, 'missing manifest');
  }

  if (warnings.length) {
    console.log(`\n--- ${warnings.length} warning(s) ---`);
    warnings.forEach((w) => console.log('  WARN  ' + w));
  }
  if (errors.length) {
    console.log(`\n--- ${errors.length} error(s) ---`);
    errors.forEach((e) => console.log('  ERROR ' + e));
    console.log('\nValidation FAILED');
    process.exit(1);
  }
  console.log('\nValidation passed (no errors).');
}

main();
