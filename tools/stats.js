#!/usr/bin/env node
/**
 * Print counts per category, type and difficulty for the merged pool.
 *
 * Usage: node tools/stats.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const QUESTIONS_DIR = path.join(__dirname, '..', 'app', 'data', 'questions');

function tally(questions, keyFn) {
  const out = {};
  for (const q of questions) {
    const k = keyFn(q) || '(none)';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function table(title, obj, order) {
  console.log(`\n${title}`);
  const keys = order || Object.keys(obj).sort((a, b) => obj[b] - obj[a]);
  for (const k of keys) {
    if (obj[k] === undefined) continue;
    const bar = '#'.repeat(Math.max(1, Math.round((obj[k] / 5))));
    console.log(`  ${String(k).padEnd(22)} ${String(obj[k]).padStart(4)}  ${bar}`);
  }
}

function main() {
  if (!fs.existsSync(QUESTIONS_DIR)) {
    console.error('No questions directory. Run: node tools/merge.js');
    process.exit(1);
  }
  const files = fs.readdirSync(QUESTIONS_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');
  let all = [];
  const perCat = {};
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(QUESTIONS_DIR, f), 'utf8'));
    perCat[f.replace('.json', '')] = data.length;
    all = all.concat(data);
  }

  console.log(`=== Question pool stats ===\n  Total questions: ${all.length}`);

  table('By category', perCat, [
    'history',
    'modern_society',
    'government_law',
    'what_is_uk',
    'values_principles',
  ]);

  table('By type', tally(all, (q) => q.type), ['single', 'truefalse', 'two', 'statement']);
  table('By difficulty', tally(all, (q) => q.difficulty), ['easy', 'medium', 'hard']);

  const subs = tally(all, (q) => q.category + ' / ' + q.subcategory);
  console.log('\nTop 25 subcategories:');
  Object.entries(subs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));

  console.log('\nSubcategory count:', Object.keys(subs).length);
}

main();
