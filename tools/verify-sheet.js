#!/usr/bin/env node
/**
 * Generate a fact-verification checklist for one category.
 *
 * Each question becomes a one-line fact claim (its explanation) plus the
 * question/answer for context, grouped by sub-topic, with a checkbox and a
 * "Correction" line. Read the matching chapter of the official handbook and
 * tick the ones that are right, then write the fix on the ones that are wrong.
 *
 * Usage:
 *   node tools/verify-sheet.js                # history (default)
 *   node tools/verify-sheet.js government_law
 *
 * Writes: verify/<category>.md
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QUESTIONS_DIR = path.join(ROOT, 'app', 'data', 'questions');
const OUT_DIR = path.join(ROOT, 'verify');

const CAT_NAMES = {
  values_principles: 'The Values and Principles of the UK',
  what_is_uk: 'What is the UK?',
  history: 'A Long and Illustrious History',
  modern_society: 'A Modern, Thriving Society',
  government_law: 'The UK Government, the Law and Your Role',
};

function titleCase(s) {
  return String(s || '')
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function main() {
  const cat = process.argv[2] || 'history';
  const file = path.join(QUESTIONS_DIR, cat + '.json');
  if (!fs.existsSync(file)) {
    console.error(`No such category file: ${file}`);
    console.error(`Available: ${Object.keys(CAT_NAMES).join(', ')}`);
    process.exit(1);
  }

  const questions = JSON.parse(fs.readFileSync(file, 'utf8'));
  const groups = new Map();
  for (const q of questions) {
    const key = q.subcategory || 'misc';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }

  const name = CAT_NAMES[cat] || cat;
  let out = '';
  out += `# Fact-verification checklist — ${name}\n\n`;
  out += `**${questions.length} fact claims to check.** How to use this:\n\n`;
  out += `1. Read the matching chapter of your official handbook.\n`;
  out += `2. Work down the list. Tick the box if the claim matches the book.\n`;
  out += `3. Where it does **not** match, write the correct fact on the \`Correction:\` line.\n`;
  out += `4. Send me back only the IDs you corrected (e.g. "hist-0043: Battle of Agincourt was 1415, not 1416") and I'll fix the pool.\n\n`;
  out += `> The claim on each line is the fact the question tests. The line below it shows the\n`;
  out += `> actual question and its marked answer, so you can see it in context.\n\n`;
  out += `Working from: **app/data/questions/${cat}.json** (${questions.length} questions)\n\n---\n`;

  // Order sub-topics by the lowest question ID in each group. The pool was
  // generated in book order, so this roughly follows the chapter's own sequence.
  const numId = (id) => {
    const m = /-(\d+)/.exec(String(id || ''));
    return m ? Number(m[1]) : 0;
  };
  const keys = [...groups.keys()].sort((a, b) => {
    const amin = Math.min(...groups.get(a).map((q) => numId(q.id)));
    const bmin = Math.min(...groups.get(b).map((q) => numId(q.id)));
    return amin - bmin || a.localeCompare(b);
  });
  for (const key of keys) {
    const list = groups.get(key);
    out += `\n## ${titleCase(key)} (${list.length})\n\n`;
    for (const q of list) {
      const answer = q.answer.map((i) => q.options[i]).join(' + ');
      const qtext = String(q.question).replace(/\s+/g, ' ').trim();
      out += `- [ ] \`${q.id}\` ${String(q.explanation).trim()}\n`;
      out += `  - Q: ${qtext} → **${answer}**\n`;
      out += `  - Correction:\n`;
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, cat + '.md');
  fs.writeFileSync(outFile, out);

  const subcount = keys.length;
  console.log(`Wrote ${outFile}`);
  console.log(`  ${questions.length} fact claims across ${subcount} sub-topics:`);
  for (const key of keys) console.log(`    ${String(groups.get(key).length).padStart(4)}  ${titleCase(key)}`);
}

main();
