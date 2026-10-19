#!/usr/bin/env node
/**
 * Merge question "part" files into the final per-category files.
 *
 * Reads every *.json in app/data/parts/, groups by each question's `category`,
 * sorts by id, and writes app/data/questions/<category>.json plus the
 * app/data/questions/index.json manifest.
 *
 * Usage: node tools/merge.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PARTS_DIR = path.join(ROOT, 'app', 'data', 'parts');
const OUT_DIR = path.join(ROOT, 'app', 'data', 'questions');

const CATEGORIES = [
  { id: 'values_principles', name: 'The Values and Principles of the UK', file: 'values_principles.json' },
  { id: 'what_is_uk', name: 'What is the UK?', file: 'what_is_uk.json' },
  { id: 'history', name: 'A Long and Illustrious History', file: 'history.json' },
  { id: 'modern_society', name: 'A Modern, Thriving Society', file: 'modern_society.json' },
  { id: 'government_law', name: 'The UK Government, the Law and Your Role', file: 'government_law.json' },
];
const CAT_IDS = new Set(CATEGORIES.map((c) => c.id));

function byId(a, b) {
  return a.id.localeCompare(b.id);
}

function main() {
  if (!fs.existsSync(PARTS_DIR)) {
    console.error(`No parts directory at ${PARTS_DIR}. Run the generators first.`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const partFiles = fs
    .readdirSync(PARTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (partFiles.length === 0) {
    console.error('No part files found.');
    process.exit(1);
  }

  const grouped = new Map();
  const seen = new Set();
  let total = 0;
  let dropped = 0;

  for (const file of partFiles) {
    const full = path.join(PARTS_DIR, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      console.error(`! ${file}: JSON parse error: ${e.message}`);
      process.exit(1);
    }
    if (!Array.isArray(data)) {
      console.error(`! ${file}: top level is not an array`);
      process.exit(1);
    }
    for (const q of data) {
      if (!q || typeof q !== 'object' || !q.id) {
        dropped++;
        continue;
      }
      if (!CAT_IDS.has(q.category)) {
        console.error(`! ${file}: unknown category "${q.category}" (id ${q.id})`);
        process.exit(1);
      }
      if (seen.has(q.id)) {
        dropped++;
        continue;
      }
      seen.add(q.id);
      if (!grouped.has(q.category)) grouped.set(q.category, []);
      grouped.get(q.category).push(q);
      total++;
    }
  }

  const manifest = { generatedAt: new Date().toISOString(), total, categories: [] };

  for (const cat of CATEGORIES) {
    const list = (grouped.get(cat.id) || []).sort(byId);
    fs.writeFileSync(path.join(OUT_DIR, cat.file), JSON.stringify(list, null, 2) + '\n');
    manifest.categories.push({ id: cat.id, name: cat.name, file: cat.file, count: list.length });
    console.log(`  ${cat.file.padEnd(26)} ${String(list.length).padStart(4)} questions`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\n  Merged ${total} unique questions from ${partFiles.length} part files.`);
  if (dropped) console.log(`  Dropped ${dropped} malformed/duplicate entries.`);
  console.log(`  Wrote manifest with ${manifest.categories.length} categories.`);
}

main();
