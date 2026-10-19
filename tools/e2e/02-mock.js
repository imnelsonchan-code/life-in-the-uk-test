'use strict';

/**
 * Mock tab: a full 24-question, 45-minute, 18-to-pass simulation.
 *
 * Covers composition against MOCK.weights, uniqueness, the countdown, answering
 * and the question map, both sides of the pass threshold, the results/review
 * screen, abandon-and-resume from `liuk_active_mock_v1`, persistence into
 * `store.mocks`, the Stats tab, and pool re-shuffling between attempts.
 *
 * Everything is driven through the real UI; the app globals are only read to
 * assert (or to work out which option is the correct one to click).
 */

const { launch } = require('../harness');

const EXPECTED_POOL = 716;
const MOCK = { total: 24, minutes: 45, pass: 18 };
const SECONDS = MOCK.minutes * 60;
const WEIGHTS = {
  history: 11,
  modern_society: 5,
  government_law: 4,
  what_is_uk: 3,
  values_principles: 1,
};
const CAT_ORDER = ['values_principles', 'what_is_uk', 'history', 'modern_society', 'government_law'];

/* ---------------------------------------------------------------- helpers -- */

function clockSeconds(text) {
  const m = /(\d+):(\d{2})/.exec(String(text == null ? '' : text));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function sortedIds(ids) {
  return ids.slice().sort();
}

function overlap(a, b) {
  return a.filter((x) => b.indexOf(x) >= 0).length;
}

/** Open the Mock tab and start a mock with no unfinished attempt hanging over. */
async function startFreshMock(page) {
  await page.click('.tab[data-tab="mock"]');
  await page.waitFor('ui.tab === "mock" && ui.screen === "mock-home"');
  if (await page.exists('[data-action="resume-mock"]')) {
    await page.click('[data-action="discard-mock"]');
    await page.waitFor('!localStorage.getItem("liuk_active_mock_v1")');
  }
  await page.click('[data-action="start-mock"]');
  await page.waitFor('ui.screen === "mock" && ui.mock && ui.mock.items.length === 24');
}

/** Number of mock questions per chapter. */
function catCounts(page) {
  return page.eval(`
    var out = {};
    ui.mock.items.forEach(function (it) { var k = it.ref.category; out[k] = (out[k] || 0) + 1; });
    return out;
  `);
}

/** The option TEXT (sorted) the user selected for every question. */
function selectedTexts(page) {
  return page.eval(`
    return ui.mock.items.map(function (it) {
      return [...it.selected].map(function (i) { return it.options[i]; }).sort();
    });
  `);
}

/** The option TEXT (sorted) of the correct answer for every question. */
function correctTexts(page) {
  return page.eval(`
    return ui.mock.items.map(function (it) {
      return it.answer.map(function (i) { return it.options[i]; }).sort();
    });
  `);
}

function itemIds(page) {
  return page.eval('return ui.mock.items.map(function (it) { return it.id; });');
}

/**
 * Jump to question k and deliberately answer it right or wrong.
 * A "wrong" answer is a single option that is never in the answer set, which is
 * wrong for both single-answer and "choose TWO" questions.
 */
async function answerAt(page, k, correct) {
  await page.click(`[data-action="mock-goto"][data-idx="${k}"]`);
  const info = await page.eval(`
    var it = ui.mock.items[${k}];
    return { ans: it.answer.slice(), n: it.options.length, type: it.ref.type };
  `);
  let picks;
  if (correct) {
    picks = info.ans.slice();
  } else {
    picks = [];
    for (let i = 0; i < info.n; i++) {
      if (info.ans.indexOf(i) < 0) {
        picks.push(i);
        break;
      }
    }
  }
  if (!picks.length) throw new Error('no option available to answer Q' + (k + 1));
  for (const p of picks) await page.click(`[data-action="pick"][data-idx="${p}"]`);
  return info;
}

/** Click Submit and wait for the results screen (the confirm dialog is auto-accepted). */
async function submitMock(page) {
  await page.click('[data-action="submit-mock"]');
  await page.waitFor('ui.screen === "results" && ui.mock && ui.mock.result', { timeout: 8000 });
  return page.eval('return ui.mock.result;');
}

/* ------------------------------------------------------------------- test -- */

module.exports = {
  name: 'Mock test: composition, timer, scoring, resume',

  async run(suite, ctx) {
    const { base, sleep } = ctx;
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/');
      await page.ready(EXPECTED_POOL);

      let mockAIds = [];
      let resultA = null;

      /* ---------------------------------------------------------- group 1 -- */
      await suite.group('Starting a mock: size and chapter composition', async () => {
        await startFreshMock(page);
        suite.eq('mock screen is showing', await page.eval('return ui.screen'), 'mock');
        suite.eq('mock tab is active', await page.eval('return ui.tab'), 'mock');
        suite.eq('exactly 24 questions', await page.eval('return ui.mock.items.length'), MOCK.total);

        const counts = await catCounts(page);
        for (const cat of CAT_ORDER) {
          suite.eq(`chapter count: ${cat}`, counts[cat] || 0, WEIGHTS[cat]);
        }
        suite.eq(
          'chapter counts sum to 24',
          CAT_ORDER.reduce((n, c) => n + (counts[c] || 0), 0),
          MOCK.total
        );
        suite.eq(
          'composition matches MOCK.weights exactly',
          JSON.stringify(CAT_ORDER.map((c) => counts[c] || 0)),
          JSON.stringify(CAT_ORDER.map((c) => WEIGHTS[c]))
        );

        const items = await page.eval(`
          return ui.mock.items.map(function (it) {
            return { id: it.id, nOpts: it.options.length, nAns: it.answer.length, cat: it.ref.category, inPool: !!DATA.byId[it.id] };
          });
        `);
        mockAIds = items.map((x) => x.id);
        suite.eq('24 unique question ids', new Set(mockAIds).size, MOCK.total);
        suite.check('no duplicate ids inside the mock', new Set(mockAIds).size === mockAIds.length);
        suite.check('every question id exists in the pool', items.every((x) => x.inPool));
        suite.check(
          'every question has 1..n correct options',
          items.every((x) => x.nAns >= 1 && x.nAns <= x.nOpts)
        );
        suite.eq(
          'the per-item categories agree with the chapter counts',
          JSON.stringify(items.reduce((acc, x) => ((acc[x.cat] = (acc[x.cat] || 0) + 1), acc), {})),
          JSON.stringify(counts)
        );
      });

      /* ---------------------------------------------------------- group 2 -- */
      await suite.group('Countdown timer', async () => {
        await page.waitFor('!!document.getElementById("mockTimer")', { timeout: 4000 });
        const t0 = clockSeconds(await page.text('#mockTimer'));
        suite.check('the timer is rendered', t0 !== null, String(t0));
        suite.near('timer starts near 45:00', t0, SECONDS, 5);
        suite.eq(
          'timer is not in the low warning style yet',
          await page.eval('return document.getElementById("mockTimer").classList.contains("low")'),
          false
        );

        await sleep(1700);
        const t1 = clockSeconds(await page.text('#mockTimer'));
        suite.check('the timer counts down', t1 < t0, `${t0}s -> ${t1}s`);
        suite.check('remaining time is still positive', t1 > 0, String(t1));

        const left = await page.eval('return Math.round((ui.mock.deadline - Date.now()) / 1000)');
        suite.near('deadline agrees with the displayed clock', left, t1, 2);
        suite.near(
          'deadline is a 45-minute window from the start',
          await page.eval('return ui.mock.deadline - ui.mock.startedAt'),
          SECONDS * 1000,
          2
        );

        // A deadline under five minutes should turn the clock into its warning style.
        const realDeadline = await page.eval('return ui.mock.deadline');
        await page.eval('ui.mock.deadline = Date.now() + 200000; return ui.mock.deadline;');
        await page.waitFor('document.getElementById("mockTimer").classList.contains("low")', {
          timeout: 4000,
          label: 'low-time timer style',
        });
        suite.eq(
          'under 5 minutes the timer switches to the warning style',
          await page.eval('return document.getElementById("mockTimer").classList.contains("low")'),
          true
        );
        suite.check('the warning clock reads under 5 minutes', clockSeconds(await page.text('#mockTimer')) <= 300, await page.text('#mockTimer'));
        await page.eval(`ui.mock.deadline = ${realDeadline}; return ui.mock.deadline;`);
        await page.waitFor('!document.getElementById("mockTimer").classList.contains("low")', {
          timeout: 4000,
          label: 'timer back to normal style',
        });
      });

      /* ---------------------------------------------------------- group 3 -- */
      await suite.group('Answering, navigation and the question map', async () => {
        const ans0 = await page.eval('return ui.mock.items[0].answer.slice()');
        for (const i of ans0) await page.click(`[data-action="pick"][data-idx="${i}"]`);
        suite.eq('the selection is recorded', await page.eval('return ui.mock.items[0].selected.size'), ans0.length);
        suite.check('progress reports 1 answered', (await page.text('.q-progress')).indexOf('1 answered') >= 0);
        suite.eq(
          'the map marks Q1 as answered',
          await page.eval(`return document.querySelectorAll('.grid button')[0].classList.contains('answered')`),
          true
        );
        suite.eq(
          'the map marks Q1 as current',
          await page.eval(`return document.querySelectorAll('.grid button')[0].classList.contains('current')`),
          true
        );
        suite.eq(
          'prev is disabled on the first question',
          await page.eval(`return document.querySelector('[data-action="mock-prev"]').disabled`),
          true
        );

        await page.click('[data-action="mock-next"]');
        suite.eq('next advances to question 2', await page.eval('return ui.mock.i'), 1);
        suite.check('the header shows question 2 of 24', (await page.text('.q-progress')).indexOf('Question 2 of 24') >= 0);
        suite.eq(
          'the map current marker moves with it',
          await page.eval(`return document.querySelectorAll('.grid button')[1].classList.contains('current')`),
          true
        );

        await page.click('[data-action="mock-prev"]');
        suite.eq('prev returns to question 1', await page.eval('return ui.mock.i'), 0);

        await page.click('[data-action="mock-goto"][data-idx="12"]');
        suite.eq('the jump control moves to question 13', await page.eval('return ui.mock.i'), 12);
        suite.check('the header shows question 13 of 24', (await page.text('.q-progress')).indexOf('Question 13 of 24') >= 0);

        suite.eq('an untouched question has no selection', await page.eval('return ui.mock.items[12].selected.size'), 0);
        suite.eq(
          'the map leaves an untouched question unmarked',
          await page.eval(`return document.querySelectorAll('.grid button')[12].classList.contains('answered')`),
          false
        );
        suite.check('progress still reports only 1 answered', (await page.text('.q-progress')).indexOf('1 answered') >= 0);
        suite.eq('the earlier answer is still there', await page.eval('return ui.mock.items[0].selected.size'), ans0.length);

        await page.click('[data-action="mock-flag"]');
        suite.eq('flag toggles on', await page.eval('return ui.mock.items[12].flagged'), true);
        suite.check('the flag button reads Flagged', (await page.text('[data-action="mock-flag"]')).indexOf('Flagged') >= 0);
        suite.eq(
          'the map shows the flag',
          await page.eval(`return document.querySelectorAll('.grid button')[12].classList.contains('flagged')`),
          true
        );
        await page.click('[data-action="mock-flag"]');
        suite.eq('flag toggles back off', await page.eval('return ui.mock.items[12].flagged'), false);

        await page.click('[data-action="mock-goto"][data-idx="23"]');
        suite.eq(
          'next is disabled on the last question',
          await page.eval(`return document.querySelector('[data-action="mock-next"]').disabled`),
          true
        );
      });

      /* ---------------------------------------------------------- group 4 -- */
      await suite.group('Abandon and resume a half-finished mock', async () => {
        // Start from a completely unanswered mock. The previous group already
        // answered Q1, and for a "choose TWO" question re-picking its options
        // would TOGGLE the existing selection back off, leaving Q1 empty and
        // making this group's "8 answers" assertions depend on the random draw.
        await startFreshMock(page);
        for (let k = 0; k < 8; k++) await answerAt(page, k, k < 5);
        await page.click('[data-action="mock-goto"][data-idx="1"]');
        await page.click('[data-action="mock-flag"]');
        await page.click('[data-action="mock-goto"][data-idx="7"]');

        const beforeIds = await itemIds(page);
        const beforeTexts = await selectedTexts(page);
        const beforeCorrect = await correctTexts(page);
        const beforeFlags = await page.eval('return ui.mock.items.map(function (it) { return !!it.flagged; });');

        await sleep(1400);
        const t1 = clockSeconds(await page.text('#mockTimer'));

        const stored = await page.eval('return JSON.parse(localStorage.getItem("liuk_active_mock_v1") || "null");');
        suite.check('the active mock is written to liuk_active_mock_v1', !!stored && stored.ids.length === 24, stored ? stored.ids.length : stored);
        suite.eq('stored ids match the questions on screen', JSON.stringify(stored.ids), JSON.stringify(beforeIds));
        suite.eq('stored cursor is the current question', stored.i, 7);
        suite.eq('stored selections hold 8 answers', stored.selections.filter((s) => s.length).length, 8);

        await page.goto(base + '/');
        await page.ready(EXPECTED_POOL);
        suite.eq('a reload returns to the practice home', await page.eval('return ui.screen'), 'home');
        suite.check(
          'the unfinished mock survives the reload',
          await page.eval('return !!localStorage.getItem("liuk_active_mock_v1")')
        );

        await page.click('.tab[data-tab="mock"]');
        await page.waitFor('ui.screen === "mock-home"');
        suite.check('the mock home offers to resume', await page.exists('[data-action="resume-mock"]'));
        suite.check('the resume card states the remaining time', /left on the clock/.test(await page.text('.card')));

        await page.click('[data-action="resume-mock"]');
        await page.waitFor('ui.screen === "mock" && ui.mock');
        suite.eq('the resumed mock has 24 questions', await page.eval('return ui.mock.items.length'), MOCK.total);
        suite.eq('the same questions come back in the same order', JSON.stringify(await itemIds(page)), JSON.stringify(beforeIds));
        suite.eq('the current question is restored', await page.eval('return ui.mock.i'), 7);
        suite.eq(
          'the deadline is restored (timer is not restarted)',
          await page.eval('return ui.mock.deadline'),
          stored.deadline
        );
        const t2 = clockSeconds(await page.text('#mockTimer'));
        suite.check('remaining time is not reset to 45:00', t2 < SECONDS, `before=${t1}s after=${t2}s`);
        suite.check('remaining time did not grow across the reload', t2 <= t1, `before=${t1}s after=${t2}s`);
        suite.eq(
          'the number of answers is preserved',
          (await selectedTexts(page)).filter((t) => t.length).length,
          8
        );
        suite.eq(
          'the stored selection indexes are unchanged',
          JSON.stringify(await page.eval('return ui.mock.items.map(function (it) { return [...it.selected]; });')),
          JSON.stringify(stored.selections)
        );
        suite.eq(
          'the flagged question is preserved',
          JSON.stringify(await page.eval('return ui.mock.items.map(function (it) { return !!it.flagged; });')),
          JSON.stringify(beforeFlags)
        );

        // The real check: an answer is a choice of option TEXT. Resuming must
        // bring back the same text, not merely the same numeric index.
        const afterTexts = await selectedTexts(page);
        const changed = [];
        for (let k = 0; k < 24; k++) {
          if (JSON.stringify(beforeTexts[k]) !== JSON.stringify(afterTexts[k])) {
            changed.push(`Q${k + 1} "${beforeTexts[k].join(' + ')}" -> "${afterTexts[k].join(' + ')}"`);
          }
        }
        suite.check(
          'resume restores the same ANSWER (option text) the user picked',
          changed.length === 0,
          changed.length ? changed.join('; ') : ''
        );
        suite.eq(
          "resume keeps every question's correct answer text",
          JSON.stringify(await correctTexts(page)),
          JSON.stringify(beforeCorrect)
        );
      });

      /* ---------------------------------------------------------- group 5 -- */
      await suite.group('Submitting: results screen, review, store and Stats', async () => {
        resultA = await submitMock(page);
        suite.check('submit asks for confirmation first', page.dialogs.some((m) => /Submit your test/i.test(m)), page.dialogs.join(' | '));

        suite.eq('the result totals 24 questions', resultA.total, MOCK.total);
        suite.check('the score is 0..24', resultA.correct >= 0 && resultA.correct <= 24, String(resultA.correct));
        suite.eq('pass/fail is decided at 18', resultA.pass, resultA.correct >= MOCK.pass);
        suite.eq(
          'per-chapter totals sum to 24',
          Object.keys(resultA.perCat).reduce((n, k) => n + resultA.perCat[k].total, 0),
          MOCK.total
        );
        for (const cat of CAT_ORDER) {
          suite.eq(`results chapter total: ${cat}`, (resultA.perCat[cat] || {}).total, WEIGHTS[cat]);
        }
        suite.check('time used is recorded', typeof resultA.timeUsed === 'number' && resultA.timeUsed >= 0 && resultA.timeUsed <= SECONDS, String(resultA.timeUsed));
        suite.eq('the results screen is showing', await page.eval('return ui.screen'), 'results');

        suite.eq(
          'the score is shown as X/24',
          (await page.text('.big-score .val')) + (await page.text('.big-score .of')),
          resultA.correct + '/24'
        );
        suite.eq('the pass badge matches', await page.text('.big-score .badge'), resultA.pass ? 'PASS' : 'FAIL');
        suite.check('the time used is shown', (await page.text('.big-score')).indexOf('Time used') >= 0);
        suite.check('the pass mark is stated', (await page.text('.big-score')).indexOf('Pass mark 18/24') >= 0);

        suite.eq('the review lists all 24 questions', await page.count('.review-item'), MOCK.total);
        suite.eq(
          "every review item shows the user's answer",
          await page.eval(`
            return [...document.querySelectorAll('.review-item')].filter(function (n) {
              return n.innerText.indexOf('Your answer:') >= 0;
            }).length;
          `),
          MOCK.total
        );
        suite.eq(
          'unanswered questions are shown as "No answer"',
          await page.eval(`
            return [...document.querySelectorAll('.review-item')].filter(function (n) {
              return n.innerText.indexOf('Your answer: No answer') >= 0;
            }).length;
          `),
          (await selectedTexts(page)).filter((t) => !t.length).length
        );
        suite.eq(
          'every review item carries an explanation',
          await page.eval(`
            return [...document.querySelectorAll('.review-item .rexp')].filter(function (n) {
              return n.textContent.trim().length > 0;
            }).length;
          `),
          MOCK.total
        );
        suite.eq(
          'the first review explanation matches the question data',
          await page.eval(`return document.querySelectorAll('.review-item')[0].querySelector('.rexp').textContent.trim();`),
          (await page.eval('return ui.mock.items[0].ref.explanation;')).trim()
        );

        const marks = await page.eval(`
          var wantCorrect = 0, wantWrong = 0;
          ui.mock.items.forEach(function (it) {
            wantCorrect += it.answer.length;
            it.selected.forEach(function (i) { if (it.answer.indexOf(i) < 0) wantWrong++; });
          });
          return {
            wantCorrect: wantCorrect,
            wantWrong: wantWrong,
            gotCorrect: document.querySelectorAll('.review-item .ropt.correct').length,
            gotWrong: document.querySelectorAll('.review-item .ropt.wrong').length,
          };
        `);
        suite.eq('the review marks every correct option', marks.gotCorrect, marks.wantCorrect);
        suite.eq('the review marks every wrong choice', marks.gotWrong, marks.wantWrong);

        suite.eq('completing a mock appends one record to store.mocks', await page.eval('return store.mocks.length'), 1);
        suite.eq('store.mocks[0].correct matches the screen', await page.eval('return store.mocks[0].correct'), resultA.correct);
        suite.eq('store.mocks[0].total is 24', await page.eval('return store.mocks[0].total'), MOCK.total);
        suite.eq('store.mocks[0].pass matches', await page.eval('return store.mocks[0].pass'), resultA.pass);
        suite.eq('store.mocks[0].timeUsed matches', await page.eval('return store.mocks[0].timeUsed'), resultA.timeUsed);
        suite.check(
          'store.mocks[0] has a per-chapter breakdown summing to 24',
          await page.eval('return Object.keys(store.mocks[0].perCat).reduce(function (n, k) { return n + store.mocks[0].perCat[k].total; }, 0) === 24;')
        );
        suite.eq('the active mock is cleared on submit', await page.eval('return localStorage.getItem("liuk_active_mock_v1")'), null);
        suite.eq(
          'all 24 questions are marked seen',
          await page.eval('return ui.mock.items.every(function (it) { return !!store.seen[it.id]; })'),
          true
        );

        await page.click('.tab[data-tab="stats"]');
        await page.waitFor('ui.tab === "stats" && ui.screen === "home"');
        const statBox = (label) => `
          var b = [...document.querySelectorAll('.stat-box')].find(function (x) {
            return x.querySelector('.l').textContent.trim() === ${JSON.stringify(label)};
          });
          return b ? b.querySelector('.n').textContent.trim() : null;
        `;
        suite.eq('Stats: mocks taken is 1', await page.eval(statBox('Mocks taken')), '1');
        suite.eq('Stats: best mock matches the result', await page.eval(statBox('Best mock')), resultA.correct + '/24');
        suite.eq('Stats: seen count is at least the 24 mock questions', await page.eval(statBox('Seen')), '24');
      });

      /* ---------------------------------------------------------- group 6 -- */
      let resultB = null;
      let mockBIds = [];
      await suite.group('Passing boundary: exactly 18/24', async () => {
        await startFreshMock(page);
        mockBIds = await itemIds(page);
        suite.eq(
          'a second mock is a fresh draw from the pool',
          sortedIds(mockBIds).join() === sortedIds(mockAIds).join(),
          false
        );
        suite.note(`second mock shares ${overlap(mockBIds, mockAIds)} of 24 ids with the first`);

        for (let k = 0; k < 18; k++) await answerAt(page, k, true);
        for (let k = 18; k < 24; k++) await answerAt(page, k, false);

        await sleep(1100);
        resultB = await submitMock(page);
        suite.eq('18 correct answers are seen', resultB.correct, MOCK.pass);
        suite.eq('18/24 is a PASS', resultB.pass, true);
        suite.eq('the badge says PASS', await page.text('.big-score .badge'), 'PASS');
        suite.eq('the score reads 18/24', (await page.text('.big-score .val')) + (await page.text('.big-score .of')), '18/24');
        suite.eq(
          'the per-chapter breakdown sums to 24',
          Object.keys(resultB.perCat).reduce((n, k) => n + resultB.perCat[k].total, 0),
          MOCK.total
        );
        suite.eq(
          'the per-chapter correct counts sum to 18',
          Object.keys(resultB.perCat).reduce((n, k) => n + resultB.perCat[k].correct, 0),
          18
        );
        suite.eq(
          'the chapter totals still match MOCK.weights',
          JSON.stringify(CAT_ORDER.map((c) => (resultB.perCat[c] || {}).total || 0)),
          JSON.stringify(CAT_ORDER.map((c) => WEIGHTS[c]))
        );
        suite.check('a non-zero time used is recorded', resultB.timeUsed >= 1, String(resultB.timeUsed));
        suite.eq('store.mocks now has two records', await page.eval('return store.mocks.length'), 2);
        suite.eq('the newest record is the 18/24 pass', await page.eval('return store.mocks[0].correct'), 18);
        suite.eq('the newest record passes', await page.eval('return store.mocks[0].pass'), true);
      });

      /* ---------------------------------------------------------- group 7 -- */
      let resultC = null;
      let mockCIds = [];
      await suite.group('Failing boundary: exactly 17/24', async () => {
        await startFreshMock(page);
        mockCIds = await itemIds(page);
        suite.eq(
          'a third mock is a different draw again',
          sortedIds(mockCIds).join() === sortedIds(mockBIds).join(),
          false
        );

        for (let k = 0; k < 17; k++) await answerAt(page, k, true);
        for (let k = 17; k < 23; k++) await answerAt(page, k, false);
        // leave question 24 unanswered on purpose

        resultC = await submitMock(page);
        suite.eq('17 correct answers are seen', resultC.correct, MOCK.pass - 1);
        suite.eq('17/24 is a FAIL', resultC.pass, false);
        suite.eq('the badge says FAIL', await page.text('.big-score .badge'), 'FAIL');
        suite.eq('the score reads 17/24', (await page.text('.big-score .val')) + (await page.text('.big-score .of')), '17/24');
        suite.eq(
          'the unanswered question is counted as wrong',
          await page.eval('return ui.mock.items[23].correct'),
          false
        );
        suite.eq(
          'exactly one review item says "No answer"',
          await page.eval(`
            return [...document.querySelectorAll('.review-item')].filter(function (n) {
              return n.innerText.indexOf('Your answer: No answer') >= 0;
            }).length;
          `),
          1
        );
        suite.eq(
          'the per-chapter breakdown still sums to 24 with an omission',
          Object.keys(resultC.perCat).reduce((n, k) => n + resultC.perCat[k].total, 0),
          MOCK.total
        );
        suite.eq(
          'the per-chapter correct counts sum to 17',
          Object.keys(resultC.perCat).reduce((n, k) => n + resultC.perCat[k].correct, 0),
          17
        );
        suite.eq('store.mocks now has three records', await page.eval('return store.mocks.length'), 3);
        suite.eq('the newest record is the 17/24 fail', await page.eval('return store.mocks[0].correct'), 17);
        suite.eq('the newest record fails', await page.eval('return store.mocks[0].pass'), false);
      });

      /* ---------------------------------------------------------- group 8 -- */
      await suite.group('Mock history is summarised in the tabs', async () => {
        suite.eq('no mock attempt is left active', await page.eval('return localStorage.getItem("liuk_active_mock_v1")'), null);

        await page.click('.tab[data-tab="mock"]');
        await page.waitFor('ui.tab === "mock" && ui.screen === "mock-home"');
        suite.eq('the mock home lists three recent attempts', await page.count('.breakdown .bd-row'), 3);
        suite.check('the best attempt is shown', /Best:\s*18\/24/.test(await page.eval("return document.getElementById('main').innerText")));

        await page.click('.tab[data-tab="stats"]');
        await page.waitFor('ui.tab === "stats" && ui.screen === "home"');
        const box = (label) => `
          var b = [...document.querySelectorAll('.stat-box')].find(function (x) {
            return x.querySelector('.l').textContent.trim() === ${JSON.stringify(label)};
          });
          return b ? b.querySelector('.n').textContent.trim() : null;
        `;
        suite.eq('Stats: three mocks taken', await page.eval(box('Mocks taken')), '3');
        suite.eq('Stats: best mock is 18/24', await page.eval(box('Best mock')), '18/24');
        suite.eq('Stats: accuracy is a percentage', await page.eval(`return /^\\d+%$/.test(document.querySelectorAll('.stat-box')[1].querySelector('.n').textContent.trim());`), true);
      });

      /* ---------------------------------------------------------- group 9 -- */
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
