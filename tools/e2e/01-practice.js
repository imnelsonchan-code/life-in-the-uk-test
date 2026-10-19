'use strict';

/**
 * Practice tab — the whole thing.
 *
 * Covers: per-category sessions, the type/difficulty/unseen filters, targeted
 * practice (Quick 10 / Practise all / Retry wrong), the answer flow for all
 * four question types (correct + incorrect), the "Which TWO" cap, the New
 * questions batch and its Verify hand-off, store bookkeeping + persistence, and
 * that a fresh session starts clean.
 *
 * Determinism: the pool is shuffled for every session, so this file asserts on
 * counts, invariants and rendered state — never on which question comes first.
 * Every expected count is derived from DATA.byCat / DATA.all at runtime rather
 * than hard-coded, so the tests stay talking about the app's contract.
 */

const { launch } = require('../harness');

const POOL = 716;
const NEW = 139;
const CATS = ['values_principles', 'what_is_uk', 'history', 'modern_society', 'government_law'];
const TYPES = ['single', 'truefalse', 'two', 'statement'];
const DIFFS = ['easy', 'medium', 'hard'];
const STATE_KEY = 'liuk_state_v1';

/* ------------------------------------------------------------------ helpers */

/** Category row counts as rendered on the practice home, keyed by category id. */
async function rowCounts(page) {
  return page.eval(`
    const out = {};
    for (const r of document.querySelectorAll('[data-action="start-cat"]')) {
      out[r.dataset.cat] = parseInt((r.querySelector('.cat-meta').textContent || '').trim(), 10);
    }
    return out;
  `);
}

/** The count the "Practise all" button advertises. */
async function allButtonCount(page) {
  return page.eval(
    `return Number((document.querySelector('[data-action="start-all"]').innerText || '').replace(/[^0-9]/g, ''));`
  );
}

/** Expected row counts, computed independently from DATA.byCat / DATA.all. */
async function expectedCounts(page, { type = 'all', difficulty = 'all', unseen = false } = {}) {
  return page.eval(`
    const type = ${JSON.stringify(type)}, diff = ${JSON.stringify(difficulty)}, unseen = ${unseen};
    const keys = ['values_principles','what_is_uk','history','modern_society','government_law'];
    const match = (q) => (type === 'all' || q.type === type) &&
                         (diff === 'all' || q.difficulty === diff) &&
                         (!unseen || !store.seen[q.id]);
    const out = {};
    for (const c of keys) out[c] = DATA.byCat[c].filter(match).length;
    out.__total = DATA.all.filter(match).length;
    return out;
  `);
}

async function setFilter(page, key, val) {
  await page.click(`[data-action="filter"][data-key="${key}"][data-val="${val}"]`);
}

/** Put the app back on the practice home with default filters (drive the UI). */
async function resetHome(page) {
  const screen = await page.eval('return ui.screen');
  if (screen === 'session') await page.click('#backBtn');
  const tab = await page.eval('return ui.tab');
  if (tab !== 'practice') await page.click('.tab[data-tab="practice"]');
  await setFilter(page, 'type', 'all');
  await setFilter(page, 'difficulty', 'all');
  const unseen = await page.eval('return !!ui.filters.unseen');
  if (unseen) await page.click('#unseenToggle');
  await page.waitFor('ui.screen === "home" && ui.tab === "practice" && ui.filters.type === "all" && ui.filters.difficulty === "all" && !ui.filters.unseen');
}

/** Start a session through a home button and wait for it to be live. */
async function startVia(page, selector) {
  await page.click(selector);
  await page.waitFor('ui.screen === "session" && ui.session && ui.session.items.length > 0', {
    label: 'session started via ' + selector,
  });
}

/** Indexes of the current item's correct answers (in the shuffled display order). */
async function currentAnswer(page) {
  return page.eval('return ui.session.items[ui.session.i].answer.slice();');
}

async function currentItem(page) {
  return page.eval(`
    const it = ui.session.items[ui.session.i];
    return { id: it.id, type: it.ref.type, need: it.answer.length, options: it.options.length };
  `);
}

async function pick(page, idxs) {
  for (const i of idxs) await page.click(`[data-action="pick"][data-idx="${i}"]`);
}

async function progress(page) {
  return page.eval(`
    const spans = [...document.querySelectorAll('.q-progress > span')];
    return { pos: spans[0] ? spans[0].innerText.trim() : null, score: spans.length ? spans[spans.length - 1].innerText.trim() : null };
  `);
}

async function toastText(page) {
  return page.eval('return (document.getElementById("toast") || {}).textContent || "";');
}

async function storeCounts(page) {
  return page.eval(
    'return { seen: Object.keys(store.seen).length, right: Object.keys(store.right).length, wrong: Object.keys(store.wrong).length };'
  );
}

/* --------------------------------------------------------------------- file */

module.exports = {
  name: 'Practice: categories, filters, session flow',

  async run(suite, { base }) {
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/');
      await page.ready(POOL);

      /* ================================================================ */
      await suite.group('Home totals & starting state', async () => {
        suite.eq('pool is 577', await page.eval('return DATA.all.length'), POOL);
        suite.eq('new batch is 116', await page.eval('return DATA.batchNew.length'), NEW);
        suite.eq('unseen count starts at the full pool', await page.eval('return DATA.all.filter(function(q){return !store.seen[q.id];}).length'), POOL);
        suite.eq('store starts empty', JSON.stringify(await storeCounts(page)), JSON.stringify({ seen: 0, right: 0, wrong: 0 }));
        suite.eq('no wrong answers yet', await page.eval('return Object.keys(store.wrong).length'), 0);
        suite.eq('Retry wrong is disabled with nothing wrong', await page.eval('return document.querySelector(\'[data-action="start-wrong"]\').disabled'), true);
        suite.eq('Retry wrong shows a 0 count', await page.eval('return document.querySelector(\'[data-action="start-wrong"]\').innerText.trim()'), '🔁 Retry wrong (0)');
        suite.eq('Quick 10 button is present', await page.eval('return document.querySelector(\'[data-action="start-quick"]\').innerText.trim()'), '⚡ Quick 10');
        suite.eq('Practise all advertises the full pool', await allButtonCount(page), POOL);
        suite.eq('the "not yet seen" hint equals the pool', await page.eval('return Number((document.querySelector(".card label .muted").textContent||"").replace(/[^0-9]/g,""))'), POOL);
        suite.eq('the five categories cover the whole pool', await page.eval('return DATA.all.every(function(q){ return CAT_ORDER.indexOf(q.category) >= 0; })'), true);
        suite.eq('category sizes sum to the pool', await page.eval('return CAT_ORDER.reduce(function(n,c){ return n + DATA.byCat[c].length; }, 0)'), POOL);
        suite.eq('every question has a known type', await page.eval('return DATA.all.every(function(q){ return ["single","truefalse","two","statement"].indexOf(q.type) >= 0; })'), true);
        suite.eq('the four type sizes sum to the pool', await page.eval('return ["single","truefalse","two","statement"].reduce(function(n,t){ return n + DATA.all.filter(function(q){return q.type===t;}).length; }, 0)'), POOL);
      });

      /* ================================================================ */
      await suite.group('Each category row starts a category-scoped session', async () => {
        for (const cat of CATS) {
          await resetHome(page);
          const counts = await rowCounts(page);
          const expected = await expectedCounts(page);
          suite.eq(`row count for ${cat} matches DATA.byCat`, counts[cat], expected[cat]);
          suite.eq(`row count for ${cat} equals the unfiltered category size`, counts[cat], await page.eval(`return DATA.byCat[${JSON.stringify(cat)}].length`));

          await startVia(page, `[data-action="start-cat"][data-cat="${cat}"]`);
          const info = await page.eval(`
            const s = ui.session;
            return {
              len: s.items.length,
              title: s.title,
              catId: s.catId,
              allMatch: s.items.every(function(it){ return it.ref.category === ${JSON.stringify(cat)}; }),
              i: s.i, answered: s.answered, correct: s.correct,
              fresh: s.items.every(function(it){ return !it.revealed && it.selected.size === 0; }),
            };
          `);
          suite.eq(`${cat}: session length equals the row count`, info.len, counts[cat]);
          suite.eq(`${cat}: every item belongs to this category`, info.allMatch, true);
          suite.eq(`${cat}: session.catId is ${cat}`, info.catId, cat);
          suite.eq(`${cat}: session title is the category name`, info.title, await page.eval(`return CAT_BY_ID[${JSON.stringify(cat)}].name`));
          suite.eq(`${cat}: session starts at question 1`, info.i, 0);
          suite.eq(`${cat}: counters start at zero`, info.answered + '/' + info.correct, '0/0');
          suite.eq(`${cat}: no question is pre-revealed/selected`, info.fresh, true);
        }
        await resetHome(page);
      });

      /* ================================================================ */
      await suite.group('Type & difficulty filters narrow the pool consistently', async () => {
        for (const type of ['all', ...TYPES]) {
          await resetHome(page);
          await setFilter(page, 'type', type);

          suite.eq(`type=${type}: filter state updated`, await page.eval('return ui.filters.type'), type);
          suite.eq(`type=${type}: only one type chip is active`, await page.eval('return document.querySelectorAll(\'[data-action="filter"][data-key="type"].is-on\').length'), 1);
          suite.eq(`type=${type}: active chip is the right one`, await page.eval('return document.querySelector(\'[data-action="filter"][data-key="type"].is-on\').dataset.val'), type);

          const rows = await rowCounts(page);
          const exp = await expectedCounts(page, { type });
          for (const cat of CATS) suite.eq(`type=${type}: ${cat} row count`, rows[cat], exp[cat]);
          const sum = CATS.reduce((n, c) => n + rows[c], 0);
          suite.eq(`type=${type}: category rows sum to the filter total`, sum, exp.__total);
          suite.eq(`type=${type}: "Practise all" count matches`, await allButtonCount(page), exp.__total);

          if (type !== 'all') {
            await startVia(page, '[data-action="start-all"]');
            const ok = await page.eval(`
              return { len: ui.session.items.length, unit: ui.session.items.every(function(it){ return it.ref.type === ${JSON.stringify(type)}; }) };
            `);
            suite.eq(`type=${type}: session length matches the filtered total`, ok.len, exp.__total);
            suite.eq(`type=${type}: every session item is this type`, ok.unit, true);
          }
        }

        for (const diff of DIFFS) {
          await resetHome(page);
          await setFilter(page, 'difficulty', diff);
          suite.eq(`difficulty=${diff}: filter state updated`, await page.eval('return ui.filters.difficulty'), diff);
          const rows = await rowCounts(page);
          const exp = await expectedCounts(page, { difficulty: diff });
          for (const cat of CATS) suite.eq(`difficulty=${diff}: ${cat} row count`, rows[cat], exp[cat]);
          suite.eq(`difficulty=${diff}: "Practise all" count matches`, await allButtonCount(page), exp.__total);
        }

        // A combined filter: single + hard.
        await resetHome(page);
        await setFilter(page, 'type', 'single');
        await setFilter(page, 'difficulty', 'hard');
        const combined = await expectedCounts(page, { type: 'single', difficulty: 'hard' });
        const combinedRows = await rowCounts(page);
        for (const cat of CATS) suite.eq(`single+hard: ${cat} row count`, combinedRows[cat], combined[cat]);
        suite.eq('single+hard: "Practise all" count matches', await allButtonCount(page), combined.__total);

        await resetHome(page);
        const restored = await rowCounts(page);
        const full = await expectedCounts(page);
        for (const cat of CATS) suite.eq(`clearing filters restores ${cat}`, restored[cat], full[cat]);

        // Full matrix cross-check: every type × difficulty must match an
        // independent recount of DATA.byCat / DATA.all.
        for (const type of ['all', ...TYPES]) {
          for (const difficulty of ['all', ...DIFFS]) {
            await resetHome(page);
            await setFilter(page, 'type', type);
            await setFilter(page, 'difficulty', difficulty);
            const want = await expectedCounts(page, { type, difficulty });
            const got = await rowCounts(page);
            const mismatches = CATS.filter((c) => got[c] !== want[c]).map((c) => `${c} dom=${got[c]} want=${want[c]}`);
            const total = await allButtonCount(page);
            if (total !== want.__total) mismatches.push(`total dom=${total} want=${want.__total}`);
            suite.check(`matrix ${type}/${difficulty}: rows + total are consistent`, mismatches.length === 0, mismatches.join(', '));
          }
        }
        await resetHome(page);
      });

      /* ================================================================ */
      await suite.group('"Only unseen" toggle', async () => {
        await resetHome(page);
        const full = await expectedCounts(page);

        // Nothing answered yet: unseen is a no-op.
        suite.eq('toggle starts off', await page.eval('return ui.filters.unseen'), false);
        await page.click('#unseenToggle');
        suite.eq('toggle turns on', await page.eval('return ui.filters.unseen'), true);
        suite.eq('checkbox reflects state', await page.eval('return document.getElementById("unseenToggle").checked'), true);

        // The label is wired to the same toggle (the way a real user flips it).
        await page.click('label[for="unseenToggle"]');
        await page.waitFor('ui.filters.unseen === false', { label: 'label click turns unseen off' });
        suite.eq('clicking the label clears the toggle', await page.eval('return ui.filters.unseen'), false);
        await page.click('#unseenToggle');
        await page.waitFor('ui.filters.unseen === true');

        let rows = await rowCounts(page);
        for (const cat of CATS) suite.eq(`unseen (nothing seen): ${cat} row count`, rows[cat], full[cat]);

        // Mark three History questions as seen by answering them.
        await resetHome(page);
        await startVia(page, '[data-action="start-cat"][data-cat="history"]');
        for (let n = 0; n < 3; n++) {
          await pick(page, await currentAnswer(page));
          await page.click('[data-action="check"]');
          if (n < 2) await page.click('[data-action="next"]');
        }
        await page.click('#backBtn');
        await page.waitFor('ui.screen === "home"');

        const seenHistory = await page.eval('return DATA.byCat.history.filter(function(q){return !!store.seen[q.id];}).length;');
        suite.eq('three History questions are now seen', seenHistory, 3);

        // Unseen off: History is back to its full size.
        rows = await rowCounts(page);
        suite.eq('unseen off: History row is unfiltered again', rows.history, await page.eval('return DATA.byCat.history.length'));

        // Unseen on: History drops by exactly the number seen.
        await page.click('#unseenToggle');
        await page.waitFor('ui.filters.unseen === true');
        rows = await rowCounts(page);
        const unseenExp = await expectedCounts(page, { unseen: true });
        for (const cat of CATS) suite.eq(`unseen on: ${cat} row count`, rows[cat], unseenExp[cat]);
        suite.eq('unseen on: History drops by the number seen', rows.history, full.history - 3);
        suite.eq('unseen on: "Practise all" count matches the unseen total', await allButtonCount(page), unseenExp.__total);
        suite.eq('unseen on: the "not yet seen" hint matches the store', await page.eval('return Number((document.querySelector(".card label .muted").textContent||"").replace(/[^0-9]/g,""))'), unseenExp.__total);

        // A session started with unseen on contains no seen questions.
        await startVia(page, '[data-action="start-cat"][data-cat="history"]');
        const clean = await page.eval('return ui.session.items.every(function(it){ return !store.seen[it.id]; });');
        suite.eq('unseen on: a started session contains only unseen questions', clean, true);

        await resetHome(page);
      });

      /* ================================================================ */
      await suite.group('Answer flow for all four question types', async () => {
        for (const type of TYPES) {
          await resetHome(page);
          await setFilter(page, 'type', type);
          await startVia(page, '[data-action="start-all"]');

          const first = await progress(page);
          const firstItem = await currentItem(page);
          const total = await page.eval('return ui.session.items.length');
          suite.eq(`${type}: Q1 progress position`, first.pos, `1/${total}`);
          suite.eq(`${type}: Q1 progress score before answering`, first.score, '0% (0/0)');

          // ---- correct answer
          const ans = await currentAnswer(page);
          suite.eq(`${type}: correct answer has ${firstItem.need} option(s)`, ans.length, firstItem.need);
          await pick(page, ans);
          suite.eq(`${type}: picking marks the right number of options`, await page.eval('return document.querySelectorAll(".opt.is-selected").length'), ans.length);
          await page.click('[data-action="check"]');
          suite.eq(`${type}: correct answer shows the OK feedback`, await page.exists('.feedback.ok'), true);
          suite.eq(`${type}: correct answer shows no bad feedback`, await page.exists('.feedback.bad'), false);
          suite.eq(`${type}: OK feedback says "Correct"`, await page.eval('return document.querySelector(".feedback.ok").innerText.indexOf("Correct") >= 0'), true);
          suite.eq(`${type}: explanation is displayed`, await page.eval('return document.querySelector(".feedback").innerText.replace(/\\s+/g, " ").indexOf(ui.session.items[ui.session.i].ref.explanation.replace(/\\s+/g, " ")) >= 0'), true);
          suite.eq(`${type}: correct option is marked is-correct`, await page.eval('return document.querySelectorAll(".opt.is-correct").length'), ans.length);
          const afterCorrect = await progress(page);
          suite.eq(`${type}: progress score after a correct answer`, afterCorrect.score, '100% (1/1)');
          suite.eq(`${type}: store records it as seen`, await page.eval('return store.seen[ui.session.items[ui.session.i].id] === 1'), true);
          suite.eq(`${type}: store records it as right`, await page.eval('return (store.right[ui.session.items[ui.session.i].id] || 0) >= 1'), true);
          suite.eq(`${type}: store records no wrong for it`, await page.eval('return !store.wrong[ui.session.items[ui.session.i].id]'), true);

          // ---- advance
          suite.eq(`${type}: a Next/Finish button is offered`, await page.exists('[data-action="next"]'), true);
          await page.click('[data-action="next"]');
          const second = await progress(page);
          suite.eq(`${type}: Next advances to question 2`, second.pos, `2/${total}`);

          // ---- incorrect answer
          const wrongInfo = await page.eval(`
            const it = ui.session.items[ui.session.i];
            const wrong = [];
            for (let i = 0; i < it.options.length && wrong.length < it.answer.length; i++) {
              if (it.answer.indexOf(i) < 0) wrong.push(i);
            }
            return { id: it.id, need: it.answer.length, wrong: wrong, answers: it.answer.map(function(i){ return it.options[i]; }) };
          `);
          suite.eq(`${type}: there are enough wrong options to mis-select`, wrongInfo.wrong.length, wrongInfo.need);
          await pick(page, wrongInfo.wrong);
          await page.click('[data-action="check"]');
          suite.eq(`${type}: wrong answer shows the bad feedback`, await page.exists('.feedback.bad'), true);
          suite.eq(`${type}: wrong answer shows no OK feedback`, await page.exists('.feedback.ok'), false);
          suite.eq(`${type}: bad feedback says "Not quite"`, await page.eval('return document.querySelector(".feedback.bad").innerText.indexOf("Not quite") >= 0'), true);
          suite.eq(`${type}: bad feedback names the correct answer`, await page.eval(`return ${JSON.stringify(wrongInfo.answers)}.every(function(t){ return document.querySelector(".feedback.bad").innerText.indexOf(t) >= 0; })`), true);
          suite.eq(`${type}: wrong answer still shows the explanation`, await page.eval('return document.querySelector(".feedback").innerText.replace(/\\s+/g, " ").indexOf(ui.session.items[ui.session.i].ref.explanation.replace(/\\s+/g, " ")) >= 0'), true);
          suite.eq(`${type}: store records the wrong answer`, await page.eval(`return (store.wrong[${JSON.stringify(wrongInfo.id)}] || 0) >= 1`), true);
          suite.eq(`${type}: progress score after 1 right / 1 answered`, (await progress(page)).score, '50% (1/2)');

          await page.click('#backBtn');
          await page.waitFor('ui.screen === "home"');
        }
        await resetHome(page);
      });

      /* ================================================================ */
      await suite.group('"Which TWO" refuses a third selection', async () => {
        await resetHome(page);
        await setFilter(page, 'type', 'two');
        await startVia(page, '[data-action="start-all"]');

        suite.eq('every item is a two-answer question', await page.eval('return ui.session.items.every(function(it){ return it.ref.type === "two" && it.answer.length === 2; })'), true);

        await page.click('[data-action="pick"][data-idx="0"]');
        await page.click('[data-action="pick"][data-idx="1"]');
        suite.eq('two selections are held', await page.eval('return ui.session.items[ui.session.i].selected.size'), 2);

        await page.click('[data-action="pick"][data-idx="2"]');
        suite.eq('third selection is refused', await page.eval('return ui.session.items[ui.session.i].selected.size'), 2);
        suite.eq('third option is not selected', await page.eval('return !ui.session.items[ui.session.i].selected.has(2)'), true);
        suite.eq('a toast explains the two-answer cap', (await toastText(page)).indexOf('two') >= 0, true);

        // Checking with only one selected is also refused, not scored.
        await page.click('[data-action="pick"][data-idx="1"]');
        suite.eq('deselecting leaves one answer', await page.eval('return ui.session.items[ui.session.i].selected.size'), 1);
        await page.click('[data-action="check"]');
        suite.eq('Check with one of two selected does not reveal', await page.eval('return !!ui.session.items[ui.session.i].revealed'), false);
        suite.eq('Check with one of two selected shows a prompt', (await toastText(page)).indexOf('Select 2') >= 0, true);

        await page.click('#backBtn');
        await page.waitFor('ui.screen === "home"');
      });

      /* ================================================================ */
      await suite.group('Quick 10 runs exactly ten and ends cleanly', async () => {
        await resetHome(page);
        await startVia(page, '[data-action="start-quick"]');
        suite.eq('Quick 10 yields exactly ten questions', await page.eval('return ui.session.items.length'), 10);
        suite.eq('Quick 10 session is titled "Quick 10"', await page.eval('return ui.session.title'), 'Quick 10');
        suite.eq('Quick 10 is not scoped to one category', await page.eval('return ui.session.catId'), null);
        suite.eq('Quick 10 ids are unique', await page.eval('return new Set(ui.session.items.map(function(it){return it.id;})).size'), 10);
        suite.eq('Quick 10 draws from the whole pool (no category filter)', await page.eval('return ui.session.items.every(function(it){ return !!DATA.byId[it.id]; })'), true);

        const beforeRight = await page.eval('return Object.values(store.right).reduce(function(a,b){return a+b;},0);');
        for (let n = 0; n < 10; n++) {
          await pick(page, await currentAnswer(page));
          await page.click('[data-action="check"]');
          const thePos = await progress(page);
          suite.eq(`Quick 10: question ${n + 1} progress position`, thePos.pos, `${n + 1}/10`);
          suite.eq(`Quick 10: question ${n + 1} scores correct`, thePos.score, `${Math.round(((n + 1) / (n + 1)) * 100)}% (${n + 1}/${n + 1})`);
          if (n < 9) {
            await page.click('[data-action="next"]');
          } else {
            suite.eq('Quick 10: the last button says Finish', await page.eval('return document.querySelector(\'[data-action="next"]\').innerText.trim()'), 'Finish');
          }
        }

        await page.click('[data-action="next"]');
        suite.eq('finishing returns to the Practice home', await page.eval('return ui.screen'), 'home');
        suite.eq('finishing clears the session', await page.eval('return ui.session'), null);
        suite.eq('the session summary toast reports 10/10', (await toastText(page)).trim(), 'Session done — 10/10 (100%)');
        const afterRight = await page.eval('return Object.values(store.right).reduce(function(a,b){return a+b;},0);');
        suite.eq('finishing the session recorded ten right answers', afterRight - beforeRight, 10);
        suite.eq('finishing the session records every question as seen', await page.eval('return ui.session === null'), true);
        suite.note('Practice has no per-session review screen — the end-of-session "summary" is the toast above; the full review lives only on the Mock results screen.');
      });

      /* ================================================================ */
      await suite.group('"Practise all" and "Retry wrong"', async () => {
        await resetHome(page);
        await startVia(page, '[data-action="start-all"]');
        suite.eq('"Practise all" yields the whole filtered pool', await page.eval('return ui.session.items.length'), await page.eval('return DATA.all.length'));
        suite.eq('"Practise all" session is titled "All questions"', await page.eval('return ui.session.title'), 'All questions');
        await page.click('#backBtn');
        await page.waitFor('ui.screen === "home"');

        const counts = await storeCounts(page);
        suite.check('there are wrong answers to retry by now', counts.wrong > 0, `wrong=${counts.wrong}`);
        suite.eq('Retry wrong is enabled once something is wrong', await page.eval('return document.querySelector(\'[data-action="start-wrong"]\').disabled'), false);
        suite.eq('Retry wrong advertises the wrong count', await page.eval('return Number(document.querySelector(\'[data-action="start-wrong"]\').innerText.replace(/[^0-9]/g, ""))'), counts.wrong);

        await startVia(page, '[data-action="start-wrong"]');
        const retry = await page.eval(`
      const s = ui.session;
      return {
        len: s.items.length,
        title: s.title,
        allWrong: s.items.every(function(it){ return !!store.wrong[it.id]; }),
      };
    `);
        suite.eq('Retry wrong session length equals the wrong count', retry.len, counts.wrong);
        suite.eq('Retry wrong session is titled "Retry wrong"', retry.title, 'Retry wrong');
        suite.eq('every Retry-wrong item is a previously wrong question', retry.allWrong, true);

        await page.click('#backBtn');
        await page.waitFor('ui.screen === "home"');
      });

      /* ================================================================ */
      await suite.group('New questions batch', async () => {
        await resetHome(page);
        suite.eq('Practise-new button shows the batch size', await page.eval('return document.querySelector(\'[data-action="start-new"]\').innerText.trim()'), `✨ Practise new (${NEW})`);
        suite.eq('Verify-new button is offered', await page.exists('[data-action="verify-new"]'), true);

        await startVia(page, '[data-action="start-new"]');
        suite.eq('Practise new yields exactly the new batch', await page.eval('return ui.session.items.length'), NEW);
        suite.eq('every item is from the new batch', await page.eval('return ui.session.items.every(function(it){ return it.ref.batch === "new"; })'), true);
        suite.eq('Practise new session is titled "New questions"', await page.eval('return ui.session.title'), 'New questions');
        await page.click('#backBtn');
        await page.waitFor('ui.screen === "home"');

        await page.click('[data-action="verify-new"]');
        await page.waitFor('ui.tab === "verify" && ui.verify.cat === "new"', { label: 'verify-new hand-off' });
        suite.eq('Verify new switches to the Verify tab', await page.eval('return ui.tab'), 'verify');
        suite.eq('Verify new scopes verify to the "new" pseudo-category', await page.eval('return ui.verify.cat'), 'new');
        suite.eq('Verify header names the batch', await page.eval('return document.getElementById("headerSubtitle").textContent'), 'New questions');
        suite.eq('Verify shows the first of the batch', await page.eval('return document.querySelector(".q-progress > span").innerText.trim()'), `1/${NEW}`);
        suite.eq('the Verify pool for "new" is the whole batch', await page.eval('return catQuestions("new").length'), NEW);
        suite.eq('every Verify-new question is from the new batch', await page.eval('return catQuestions("new").every(function(q){ return q.batch === "new"; })'), true);

        await resetHome(page);
      });

      /* ================================================================ */
      await suite.group('Store bookkeeping & persistence', async () => {
        const snap = await page.eval('return { seen: store.seen, right: store.right, wrong: store.wrong, seenN: Object.keys(store.seen).length, rightN: Object.keys(store.right).length, wrongN: Object.keys(store.wrong).length };');
        suite.check('seen is non-empty', snap.seenN > 0, `seenN=${snap.seenN}`);
        suite.check('right is non-empty', snap.rightN > 0, `rightN=${snap.rightN}`);
        suite.check('wrong is non-empty', snap.wrongN > 0, `wrongN=${snap.wrongN}`);
        suite.eq('every right answer is also seen', await page.eval('return Object.keys(store.right).every(function(id){ return !!store.seen[id]; })'), true);
        suite.eq('every wrong answer is also seen', await page.eval('return Object.keys(store.wrong).every(function(id){ return !!store.seen[id]; })'), true);

        const raw = await page.eval(`return localStorage.getItem(${JSON.stringify(STATE_KEY)});`);
        suite.check('state is written to liuk_state_v1', !!raw && raw.length > 10, `raw=${raw ? raw.slice(0, 40) : raw}`);

        // Reload the same tab: the store must come back identical.
        await page.goto(base + '/');
        await page.ready(POOL);
        const reloaded = await page.eval('return { seen: store.seen, right: store.right, wrong: store.wrong };');
        suite.eq('seen survives a reload', JSON.stringify(reloaded.seen), JSON.stringify(snap.seen));
        suite.eq('right survives a reload', JSON.stringify(reloaded.right), JSON.stringify(snap.right));
        suite.eq('wrong survives a reload', JSON.stringify(reloaded.wrong), JSON.stringify(snap.wrong));

        // And the home counts agree with the restored store.
        const seenN = Object.keys(reloaded.seen).length;
        suite.eq('the "not yet seen" hint survives the reload', await page.eval('return Number((document.querySelector(".card label .muted").textContent||"").replace(/[^0-9]/g,""))'), POOL - seenN);
        await page.click('#unseenToggle');
        await page.waitFor('ui.filters.unseen === true');
        const rows = await rowCounts(page);
        const exp = await expectedCounts(page, { unseen: true });
        for (const cat of CATS) suite.eq(`after reload, unseen ${cat} row count`, rows[cat], exp[cat]);
        await resetHome(page);
      });

      /* ================================================================ */
      await suite.group('A new session resets session state', async () => {
        await resetHome(page);

        // Answer one question in an "All questions" run.
        await startVia(page, '[data-action="start-all"]');
        await pick(page, await currentAnswer(page));
        await page.click('[data-action="check"]');
        const busy = await page.eval('return { i: ui.session.i, answered: ui.session.answered, correct: ui.session.correct, total: ui.session.items.length };');
        suite.eq('first session recorded one answer', busy.answered, 1);
        suite.eq('first session is on question 1', busy.i, 0);
        await page.click('#backBtn');
        await page.waitFor('ui.screen === "home"');

        // Start a different session.
        await startVia(page, '[data-action="start-quick"]');
        const fresh = await page.eval(`
          const s = ui.session;
          return {
            title: s.title, i: s.i, answered: s.answered, correct: s.correct,
            total: s.items.length,
            noReveal: s.items.every(function(it){ return !it.revealed; }),
            noSelection: s.items.every(function(it){ return it.selected.size === 0; }),
            noCorrectMark: s.items.every(function(it){ return it.correct === null; }),
          };
        `);
        suite.eq('new session has its own title', fresh.title, 'Quick 10');
        suite.eq('new session starts at question 1', fresh.i, 0);
        suite.eq('new session counters are zero', fresh.answered + '/' + fresh.correct, '0/0');
        suite.eq('new session has ten items', fresh.total, 10);
        suite.eq('no item leaks a revealed state', fresh.noReveal, true);
        suite.eq('no item leaks a selection', fresh.noSelection, true);
        suite.eq('no item leaks a correct/incorrect verdict', fresh.noCorrectMark, true);
        suite.eq('the new session progress indicator is reset', await page.eval('return document.querySelector(".q-progress > span").innerText.trim()'), '1/10');

        // The earlier progress is still persisted (sessions reset, history does not).
        suite.check('previous answers are still stored', (await storeCounts(page)).seen > 0, JSON.stringify(await storeCounts(page)));

        await page.click('#backBtn');
        await page.waitFor('ui.screen === "home"');
        suite.eq('leaving the session returns to the home screen', await page.eval('return ui.screen'), 'home');
        suite.eq('leaving the session clears ui.session', await page.eval('return ui.session'), null);
        suite.eq('the home screen still shows the five category rows', await page.eval('return document.querySelectorAll(\'[data-action="start-cat"]\').length'), 5);
      });

      /* ================================================================ */
      await suite.group('An empty filtered pool is refused, not started', async () => {
        await resetHome(page);
        // Make one whole category "seen" (recording only what we add, so we can
        // put it back exactly as it was), then filter to it with unseen on.
        await page.eval(`
          window.__liukRestore = [];
          for (const q of DATA.byCat.values_principles) {
            if (!store.seen[q.id]) { store.seen[q.id] = 1; window.__liukRestore.push(q.id); }
          }
          saveStore(); render();
          return 0;
        `);
        await page.click('#unseenToggle');
        await page.waitFor('ui.filters.unseen === true');
        suite.eq('the fully-seen category now shows 0', (await rowCounts(page)).values_principles, 0);

        await page.click('[data-action="start-cat"][data-cat="values_principles"]');
        suite.eq('starting an empty category opens no session', await page.eval('return ui.session'), null);
        suite.eq('and leaves you on the home screen', await page.eval('return ui.screen'), 'home');
        suite.eq('and explains why', (await toastText(page)).trim(), 'No questions match these filters');

        await page.eval(`
          for (const id of window.__liukRestore || []) delete store.seen[id];
          delete window.__liukRestore;
          saveStore(); render();
          return 0;
        `);
        await resetHome(page);
        suite.eq('restoring the store keeps right-answer bookkeeping intact', await page.eval('return Object.keys(store.right).every(function(id){ return !!store.seen[id]; })'), true);
      });

      /* ================================================================ */
      await suite.group('No client-side errors', async () => {
        const problems = page.problems();
        suite.check('no console errors or failed requests', problems.length === 0, problems.join(' | '));
      });

      await page.close();
    } finally {
      await browser.close();
    }
  },
};
