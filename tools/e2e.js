#!/usr/bin/env node
'use strict';

/**
 * End-to-end test runner.
 *
 * Runs every file in tools/e2e/ against a live server. Each file is an
 * independent scenario that gets its own fresh browser profile, so tests never
 * share localStorage or cookies.
 *
 * Usage:
 *   node tools/e2e.js                       # everything, against the dev server
 *   node tools/e2e.js --base=http://localhost:8090
 *   node tools/e2e.js --only=mock           # only files matching "mock"
 *   node tools/e2e.js --list
 *
 * A test file exports:
 *   module.exports = {
 *     name: 'Practice & filters',
 *     async run(suite, ctx) { ... }
 *   };
 *
 * where ctx = { base, launch, sleep }.
 */

const fs = require('fs');
const path = require('path');
const { launch, Suite, sleep } = require('./harness');

const DIR = path.join(__dirname, 'e2e');

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = arg('base', process.env.LIUK_BASE || 'http://127.0.0.1:8899');
const ONLY = arg('only', '');

function files() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .filter((f) => !ONLY || f.includes(ONLY));
}

async function main() {
  const list = files();
  if (process.argv.includes('--list')) {
    console.log(`Base: ${BASE}\n`);
    for (const f of list) {
      const mod = require(path.join(DIR, f));
      console.log(`  ${f} — ${mod.name || '(unnamed)'}`);
    }
    return;
  }
  if (!list.length) {
    console.log('No test files found in tools/e2e/');
    process.exit(1);
  }

  console.log(`End-to-end tests\nBase: ${BASE}\nFiles: ${list.length}`);

  const results = [];
  for (const f of list) {
    const mod = require(path.join(DIR, f));
    const suite = new Suite(mod.name || f);
    console.log(`\n${'='.repeat(60)}\n${f} — ${suite.name}\n${'='.repeat(60)}`);
    const started = Date.now();
    try {
      await mod.run(suite, { base: BASE, launch, sleep });
    } catch (e) {
      suite.failures.push(`[file threw] ${e.message}`);
      console.log(`  ✗ file threw — ${e.message}`);
    }
    const ok = suite.summary();
    results.push({ file: f, name: suite.name, ok, passed: suite.passed, failed: suite.failures.length, ms: Date.now() - started });
  }

  const totalPass = results.reduce((n, r) => n + r.passed, 0);
  const totalFail = results.reduce((n, r) => n + r.failed, 0);
  console.log(`\n${'='.repeat(60)}\nSUMMARY\n${'='.repeat(60)}`);
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.file.padEnd(28)} ${r.passed} passed, ${r.failed} failed  (${(r.ms / 1000).toFixed(1)}s)`);
  }
  console.log(`\n  ${totalPass} passed, ${totalFail} failed across ${results.length} files.`);
  process.exit(totalFail ? 1 : 0);
}

main().catch((e) => {
  console.error('runner error:', e);
  process.exit(1);
});
