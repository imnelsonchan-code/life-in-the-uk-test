#!/usr/bin/env node
/**
 * Tag batches of questions with a `batch` field.
 *
 * The app uses this to show the most recently written questions as a separate
 * "New questions" section, so they can be practised and verified on their own.
 * A question with no batch is part of the original pool.
 *
 * Ranges are inclusive, given as [prefix, from, to].
 *
 * Usage:
 *   node tools/tag-batch.js
 *   node tools/merge.js && node tools/validate.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PARTS = path.join(ROOT, 'app', 'data', 'parts');

const BATCHES = [
  {
    batch: 'new',
    ranges: [
      ['val', 61, 80],
      ['uk', 81, 95],
      ['hist', 216, 270],
      ['soc', 136, 190],
      ['gov', 131, 180],
    ],
  },
];

function batchFor(id) {
  const m = /^([a-z]+)-(\d+)$/.exec(String(id || ''));
  if (!m) return null;
  const prefix = m[1];
  const n = Number(m[2]);
  for (const b of BATCHES) {
    for (const [p, lo, hi] of b.ranges) {
      if (p === prefix && n >= lo && n <= hi) return b.batch;
    }
  }
  return null;
}

let tagged = 0;
let cleared = 0;
let touched = 0;

for (const file of fs
  .readdirSync(PARTS)
  .filter((f) => f.endsWith('.json'))
  .sort()) {
  const full = path.join(PARTS, file);
  const arr = JSON.parse(fs.readFileSync(full, 'utf8'));
  let changed = false;
  for (const q of arr) {
    if (!q || !q.id) continue;
    const b = batchFor(q.id);
    if (b && q.batch !== b) {
      q.batch = b;
      changed = true;
      tagged++;
    } else if (!b && q.batch !== undefined) {
      delete q.batch;
      changed = true;
      cleared++;
    }
  }
  if (changed) {
    fs.writeFileSync(full, '[\n' + arr.map((q) => JSON.stringify(q)).join(',\n') + '\n]\n');
    touched++;
  }
}

console.log(`  Tagged ${tagged} questions, cleared ${cleared}, in ${touched} file(s).`);
console.log('  Next: node tools/merge.js && node tools/validate.js');
