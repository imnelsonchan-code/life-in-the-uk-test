#!/usr/bin/env node
/**
 * Near-duplicate finder for the question pool.
 *
 * Flags pairs of questions that test the same fact, even when the wording
 * differs. Similarity is TF-IDF cosine over the question text plus the
 * correct answer plus the explanation, so generic prompts like
 * "Which of these statements is correct?" are compared by their content.
 *
 * Usage:
 *   node tools/dupes.js              # list pairs above the default threshold
 *   node tools/dupes.js 0.45         # lower threshold = more (noisier) pairs
 *   node tools/dupes.js 0.55 --json  # machine-readable report
 */

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'app', 'data', 'questions');
const THRESHOLD = Number(process.argv[2]) || 0.55;
const AS_JSON = process.argv.includes('--json');

const STOP = new Set(
  (
    'the a an of in and or to is was were are be been being at on for by with from as it its this ' +
    'that these those which what who whom whose where when how why do does did done have has had ' +
    'can could will would shall should may might must not no any all some more most other another ' +
    'such same so than then there here their them they he she his her him you your we our us i my me ' +
    'uk britain british england english scotland scottish wales welsh northern ireland irish'
  ).split(/\s+/)
);

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

function load() {
  const out = [];
  for (const f of fs.readdirSync(DATA).sort()) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    const arr = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
    if (Array.isArray(arr)) out.push(...arr);
  }
  return out;
}

function content(q) {
  const ans = q.options.filter((o, i) => q.answer.includes(i)).join(' ');
  return norm(`${q.question} ${ans} ${q.explanation || ''}`);
}

function main() {
  const questions = load();
  const docs = questions.map(content);

  const df = new Map();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);
  const N = docs.length;

  const vecs = docs.map((d) => {
    const tf = new Map();
    for (const w of d) tf.set(w, (tf.get(w) || 0) + 1);
    const v = new Map();
    for (const [w, c] of tf) v.set(w, (1 + Math.log(c)) * Math.log(1 + N / (df.get(w) || 1)));
    return v;
  });

  function cos(a, b) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (const [w, x] of a) {
      na += x * x;
      const y = b.get(w);
      if (y) dot += x * y;
    }
    for (const [, y] of b) nb += y * y;
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }

  const pairs = [];
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const sameCat = questions[i].category === questions[j].category;
      const s = cos(vecs[i], vecs[j]);
      // cross-category pairs need to be a bit closer to be interesting
      const threshold = sameCat ? THRESHOLD : Math.min(0.95, THRESHOLD + 0.1);
      if (s >= threshold) pairs.push({ i, j, s, sameCat });
    }
  }
  pairs.sort((a, b) => b.s - a.s);

  if (process.argv.includes('--clusters')) {
    const parent = questions.map((_, i) => i);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    };
    for (const p of pairs) union(p.i, p.j);

    const groups = new Map();
    for (let i = 0; i < questions.length; i++) {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(i);
    }
    const clusters = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);

    const lone = questions.length - clusters.reduce((n, c) => n + c.length, 0);
    console.log(
      `Checked ${questions.length} questions. ${clusters.length} duplicate clusters covering ` +
        `${questions.length - lone} questions; ${lone} questions are unique. (threshold ${THRESHOLD})\n`
    );
    clusters.forEach((c, n) => {
      console.log(`--- cluster ${n + 1} (${c.length}) ---`);
      for (const i of c) {
        const q = questions[i];
        const a = q.options.filter((o, k) => q.answer.includes(k));
        console.log(`  ${q.id} [${q.category}/${q.subcategory}/${q.type}] ${q.question}`);
        console.log(`      ans: ${a.join(' | ')}`);
      }
      console.log('');
    });
    return;
  }

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        pairs.map((p) => ({
          score: Number(p.s.toFixed(3)),
          sameCategory: p.sameCat,
          a: { id: questions[p.i].id, q: questions[p.i].question, a: questions[p.i].options.filter((o, k) => questions[p.i].answer.includes(k)) },
          b: { id: questions[p.j].id, q: questions[p.j].question, a: questions[p.j].options.filter((o, k) => questions[p.j].answer.includes(k)) },
        })),
        null,
        2
      )
    );
    return;
  }

  console.log(`Checked ${questions.length} questions. ${pairs.length} pairs >= ${THRESHOLD}.\n`);
  pairs.forEach((p, n) => {
    const A = questions[p.i];
    const B = questions[p.j];
    const aA = A.options.filter((o, k) => A.answer.includes(k));
    const aB = B.options.filter((o, k) => B.answer.includes(k));
    console.log(`${String(n + 1).padStart(2)}. ${p.s.toFixed(2)}${p.sameCat ? '' : ' [cross]'}  ${A.id} / ${B.id}`);
    console.log(`    A ${A.id}: ${A.question}`);
    console.log(`       ans: ${aA.join(' | ')}`);
    console.log(`    B ${B.id}: ${B.question}`);
    console.log(`       ans: ${aB.join(' | ')}`);
    console.log('');
  });
}

main();
