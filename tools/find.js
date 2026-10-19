#!/usr/bin/env node
/**
 * Locate one or more questions by id across the part files or the merged pool.
 *
 * Handy when applying corrections: find which part file owns an id before
 * editing it, then re-run the merge.
 *
 * Usage:
 *   node tools/find.js hist-0246
 *   node tools/find.js gov-0125 soc-0139 uk-0091
 *   node tools/find.js --merged hist-0246        # search app/data/questions instead
 *   node tools/find.js --ids                     # just list id -> file
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PARTS_DIR = path.join(ROOT, 'app', 'data', 'parts');
const MERGED_DIR = path.join(ROOT, 'app', 'data', 'questions');

const args = process.argv.slice(2);
const merged = args.includes('--merged');
const idsOnly = args.includes('--ids');
const ids = args.filter((a) => !a.startsWith('--'));

if (ids.length === 0) {
  console.error('Usage: node tools/find.js [--merged] [--ids] <id> [<id> ...]');
  process.exit(1);
}

const dir = merged ? MERGED_DIR : PARTS_DIR;
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .sort();

// Build id -> { file, question }.
const index = new Map();
for (const file of files) {
  let list;
  try {
    list = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  } catch (err) {
    console.error(`  skip ${file}: ${err.message}`);
    continue;
  }
  if (!Array.isArray(list)) continue;
  for (const q of list) {
    if (q && q.id) {
      if (!index.has(q.id)) index.set(q.id, { file, question: q });
      else index.set(q.id, { file: `${index.get(q.id).file} + ${file}`, question: q, dup: true });
    }
  }
}

let missing = 0;
for (const id of ids) {
  const hit = index.get(id);
  if (!hit) {
    missing++;
    console.log(`MISSING  ${id}`);
    continue;
  }
  const flag = hit.dup ? ' (DUPLICATE in multiple part files!)' : '';
  if (idsOnly) {
    console.log(`${id}  ->  ${hit.file}${flag}`);
  } else {
    console.log(`\n=== ${id}  [${hit.file}]${flag} ===`);
    console.log(JSON.stringify(hit.question, null, 2));
  }
}

if (!idsOnly) {
  console.log(`\n${ids.length - missing}/${ids.length} found in ${merged ? 'app/data/questions' : 'app/data/parts'}.`);
}
