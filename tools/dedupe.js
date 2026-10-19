#!/usr/bin/env node
/**
 * Remove duplicate questions from the pool, archiving them for safety.
 *
 * Reads a list of { id, keep, reason } entries, takes those questions out of
 * app/data/parts/*.json, and appends them to app/data/removed/duplicates.json
 * so nothing is ever really lost.
 *
 * Usage:
 *   node tools/dedupe.js tools/dedupe-list.json
 *   node tools/merge.js && node tools/validate.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PARTS = path.join(ROOT, 'app', 'data', 'parts');
const ARCHIVE_DIR = path.join(ROOT, 'app', 'data', 'removed');
const ARCHIVE = path.join(ARCHIVE_DIR, 'duplicates.json');

const listFile = process.argv[2];
if (!listFile) {
  console.error('Usage: node tools/dedupe.js <list.json>');
  process.exit(1);
}

const list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
const meta = new Map(list.map((x) => [x.id, x]));
const removeIds = new Set(meta.keys());

const removed = [];
for (const file of fs.readdirSync(PARTS).filter((f) => f.endsWith('.json')).sort()) {
  const full = path.join(PARTS, file);
  const arr = JSON.parse(fs.readFileSync(full, 'utf8'));
  const keep = [];
  for (const q of arr) {
    if (q && removeIds.has(q.id)) {
      const m = meta.get(q.id);
      removed.push({ ...q, removedFor: m.keep ? `kept ${m.keep}: ${m.reason || ''}` : m.reason || '' });
    } else {
      keep.push(q);
    }
  }
  if (keep.length !== arr.length) {
    fs.writeFileSync(full, '[\n' + keep.map((q) => JSON.stringify(q)).join(',\n') + '\n]\n');
    console.log(`  ${file.padEnd(26)} ${arr.length} -> ${keep.length}`);
  }
}

fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
const existing = fs.existsSync(ARCHIVE) ? JSON.parse(fs.readFileSync(ARCHIVE, 'utf8')) : [];
fs.writeFileSync(ARCHIVE, JSON.stringify(existing.concat(removed), null, 2) + '\n');

console.log(`\n  Archived ${removed.length} questions in app/data/removed/duplicates.json`);
const missing = [...removeIds].filter((id) => !removed.some((r) => r.id === id));
if (missing.length) console.log(`  ! Not found (already gone?): ${missing.join(', ')}`);
console.log('  Next: node tools/merge.js && node tools/validate.js');
