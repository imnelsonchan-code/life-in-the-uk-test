'use strict';

/**
 * Study plan (Plan tab): week/day structure, the test-date countdown,
 * ticking days off, milestone rows, the per-day action buttons, and that
 * all of it persists in localStorage across a reload.
 *
 * Date expectations are computed from the browser's own "today" plus a
 * calendar offset, never hard-coded.
 */

const { launch } = require('../harness');

const POOL = 716;
const PLAN_DAYS = 28;

/** Calendar-correct YYYY-MM-DD for today + offset, immune to DST. */
function ymd(y, m0, d, offset) {
  const t = Date.UTC(y, m0, d) + offset * 86400000;
  const x = new Date(t);
  return (
    x.getUTCFullYear() +
    '-' +
    String(x.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(x.getUTCDate()).padStart(2, '0')
  );
}

module.exports = {
  name: 'Study plan & persistence',

  async run(suite, { base, sleep }) {
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/');
      await page.ready(POOL);

      const reload = async () => {
        await page.goto(base + '/');
        await page.ready(POOL);
      };
      const openPlan = async () => {
        await page.click('.tab[data-tab="plan"]');
        await page.waitFor('ui.tab === "plan"');
      };

      /* --- page probes -------------------------------------------------- */

      const planProgress = () =>
        page.eval(`
          var qp = document.querySelector('.q-progress');
          if (!qp) return null;
          var c = qp.children;
          var bar = qp.querySelector('.progress-bar > span');
          return {
            count: c[0].textContent.trim(),
            pct: c[c.length - 1].textContent.trim(),
            width: bar ? bar.style.width : null
          };
        `);

      const planCountdown = () =>
        page.eval(`
          var input = document.querySelector('#testDate');
          if (!input) return null;
          var p = input.closest('.card').querySelector('p.small.muted');
          return p ? p.innerText : null;
        `);

      const milestoneRows = () =>
        page.eval(`
          var rows = document.querySelectorAll('.breakdown .bd-row');
          return [].map.call(rows, function (r) {
            var bar = r.querySelector('.bd-bar > span');
            var first = r.querySelector('span');
            return { day: first ? first.textContent.trim() : null, width: bar ? bar.style.width : null };
          });
        `);

      const dayDone = (day) =>
        page.eval(`
          var b = document.querySelector('[data-action="plan-toggle"][data-day="${day}"]');
          return b ? b.closest('.plan-day').classList.contains('is-done') : null;
        `);

      const goIndexForDay = (day) =>
        page.eval(`
          var days = document.querySelectorAll('.plan-day');
          var target = null;
          for (var i = 0; i < days.length; i++) {
            var s = days[i].querySelector('.plan-head strong');
            if (s && s.textContent.trim() === 'Day ${day}') { target = days[i]; break; }
          }
          if (!target) return -1;
          var gos = document.querySelectorAll('.plan-go');
          for (var j = 0; j < gos.length; j++) if (gos[j].closest('.plan-day') === target) return j;
          return -1;
        `);

      /* --- the browser's "today" ---------------------------------------- */

      const today = await page.eval(
        'var d = new Date(); return [d.getFullYear(), d.getMonth(), d.getDate()];'
      );
      const [ty, tm, td] = today;

      /* --- structure ---------------------------------------------------- */

      await suite.group('Plan tab structure', async () => {
        await openPlan();
        suite.eq('exactly four week cards', await page.count('.plan-card'), 4);
        suite.eq(
          'day entries equal the plan length',
          await page.count('.plan-day'),
          await page.eval('return currentPlan().days.length')
        );
        suite.eq('the default plan has 28 days', await page.eval('return currentPlan().days.length'), PLAN_DAYS);

        const headings = await page.eval(
          'return [].map.call(document.querySelectorAll("h2.section"), function (h) { return h.textContent.trim(); });'
        );
        suite.eq('one Milestones heading', headings.filter((h) => h === 'Milestones').length, 1);
        suite.eq('four week headings', headings.filter((h) => /^Week [1-4]\b/.test(h)).length, 4);

        const nums = await page.eval(
          'return [].map.call(document.querySelectorAll(".plan-head strong"), function (s) { return Number(s.textContent.replace(/[^0-9]/g, "")); });'
        );
        suite.check(
          'days are numbered 1..28 in order',
          JSON.stringify(nums) === JSON.stringify(Array.from({ length: PLAN_DAYS }, (_, i) => i + 1)),
          JSON.stringify(nums)
        );
        suite.eq(
          'go buttons match the days that have one',
          await page.count('.plan-go'),
          await page.eval('return currentPlan().days.filter(function (d) { return !!d.go; }).length')
        );

        const p = await planProgress();
        suite.eq('progress counter starts at 0/28', p && p.count, `0/${PLAN_DAYS} days`);
        suite.eq('progress starts at 0%', p && p.pct, '0%');
        suite.eq('progress bar starts empty', p && p.width, '0%');
      });

      /* --- choosing a timeline ------------------------------------------ */

      await suite.group('Switching plans swaps the schedule and keeps ticks separate', async () => {
        await openPlan();

        // Put a tick on the 4-week plan so we can prove it is not shared.
        await page.click('[data-action="plan-toggle"][data-day="3"]');
        suite.eq('4-week tick recorded', await page.eval('return store.plan["4w"]["3"]'), 1);

        await page.click('[data-action="set-plan"][data-plan="2w"]');
        suite.eq('the chosen plan is stored', await page.eval('return store.planId'), '2w');
        suite.eq('two week cards', await page.count('.plan-card'), 2);
        suite.eq('fourteen day entries', await page.count('.plan-day'), 14);
        suite.eq('progress is per-plan', (await planProgress()).count, '0/14 days');
        const nums = await page.eval(
          'return [].map.call(document.querySelectorAll(".plan-head strong"), function (s) { return Number(s.textContent.replace(/[^0-9]/g, "")); });'
        );
        suite.check(
          'days renumbered 1..14',
          JSON.stringify(nums) === JSON.stringify(Array.from({ length: 14 }, (_, i) => i + 1)),
          JSON.stringify(nums)
        );
        const m2 = await milestoneRows();
        suite.check(
          'the 2-week milestones are used',
          m2.length === 4 && m2[0].day === 'Day 5' && m2[3].day === 'Day 13',
          JSON.stringify(m2.map((r) => r.day))
        );

        await page.click('[data-action="set-plan"][data-plan="1w"]');
        suite.eq('one week card', await page.count('.plan-card'), 1);
        suite.eq('seven day entries', await page.count('.plan-day'), 7);
        suite.eq('progress 0/7 on the new plan', (await planProgress()).count, '0/7 days');
        const m1 = await milestoneRows();
        suite.check('the 1-week milestones are used', m1.length === 4 && m1[0].day === 'Day 3', JSON.stringify(m1.map((r) => r.day)));

        await page.click('[data-action="set-plan"][data-plan="4w"]');
        suite.eq('back to four week cards', await page.count('.plan-card'), 4);
        suite.eq('the 4-week tick is still there', await page.eval('return store.plan["4w"]["3"]'), 1);
        suite.eq('progress 1/28 again', (await planProgress()).count, '1/28 days');

        await page.click('[data-action="plan-toggle"][data-day="3"]'); // clean up
        suite.eq('cleanup leaves the 4-week plan empty', await page.eval('return Object.keys(store.plan["4w"]).length'), 0);

        await reload();
        await openPlan();
        suite.eq('the chosen plan survives a reload', await page.eval('return store.planId'), '4w');
      });

      await suite.group('A near test date suggests the plan that fits', async () => {
        await openPlan();
        const soon = ymd(ty, tm, td, 5);
        await page.setValue('[data-action="set-test-date"]', soon);

        suite.check('the 1-week plan is suggested', /1-week plan fits/.test(await page.text('#main')));
        suite.check('the suggestion is a working button', await page.exists('.plan-suggest'));
        await page.click('.plan-suggest');
        suite.eq('clicking it switches plan', await page.eval('return store.planId'), '1w');
        suite.eq('and shortens the schedule', await page.count('.plan-day'), 7);

        // restore the default plan and no date for the date tests below
        await page.click('[data-action="set-plan"][data-plan="4w"]');
        await page.setValue('[data-action="set-test-date"]', '');
        suite.eq('restored to the 4-week plan', await page.eval('return store.planId'), '4w');
      });

      /* --- test date ---------------------------------------------------- */

      const aheadOffset = 40;
      const aheadDate = ymd(ty, tm, td, aheadOffset);

      await suite.group('Test date several weeks ahead, and persistence', async () => {
        await openPlan();
        await page.setValue('[data-action="set-test-date"]', aheadDate);
        suite.eq('stores the date in store.testDate', await page.eval('return store.testDate'), aheadDate);
        suite.eq('input reflects the date', await page.attr('[data-action="set-test-date"]', 'value'), aheadDate);
        suite.eq(
          'date is written to localStorage',
          await page.eval('return JSON.parse(localStorage.getItem("liuk_state_v1")).testDate'),
          aheadDate
        );
        const label = await planCountdown();
        suite.check(
          'countdown shows 40 days to go',
          new RegExp(aheadOffset + '\\s*days to go').test(label || ''),
          label
        );
        suite.check('no day-of-plan label beyond the plan window', !/you are on/.test(label || ''), label);
        suite.eq('no Today marker beyond the plan window', await page.count('.plan-day.is-today'), 0);
        suite.eq(
          'daysToTest is computed from the chosen date',
          (await page.eval('return planToday()')).daysToTest,
          aheadOffset
        );

        await reload();
        await openPlan();
        suite.eq('date survives a reload', await page.eval('return store.testDate'), aheadDate);
        suite.eq('input survives a reload', await page.attr('[data-action="set-test-date"]', 'value'), aheadDate);
        suite.check(
          'countdown survives a reload',
          new RegExp(aheadOffset + '\\s*days to go').test((await planCountdown()) || '')
        );
      });

      const inPlanOffset = 10;
      const inPlanDate = ymd(ty, tm, td, inPlanOffset);
      // Day 1 is testDate - 27 days, day 28 is testDate, so today is day (28 - offset).
      const expectedDay = PLAN_DAYS - inPlanOffset;

      await suite.group('Test date inside the plan window', async () => {
        await openPlan();
        await page.setValue('[data-action="set-test-date"]', inPlanDate);
        const pt = await page.eval('return planToday()');
        suite.eq('daysToTest equals the offset', pt.daysToTest, inPlanOffset);
        const label = await planCountdown();
        suite.check('countdown shows 10 days to go', /10\s*days to go/.test(label || ''), label);
        suite.check(
          'label names the plan day the app computed',
          new RegExp('you are on day ' + pt.day + ' of the plan').test(label || ''),
          label
        );
        suite.eq('exactly one Today marker', await page.count('.plan-day.is-today'), 1);
        const todayDay = await page.eval(
          'var e = document.querySelector(".plan-day.is-today .plan-head strong"); return e ? Number(e.textContent.replace(/[^0-9]/g, "")) : null;'
        );
        suite.eq('Today marker sits on the day the label claims', todayDay, pt.day);
        suite.eq(
          'plan day number is calendar-correct (a test 10 days out is day 18)',
          pt.day,
          expectedDay
        );
      });

      const pastOffset = -5;
      const pastDate = ymd(ty, tm, td, pastOffset);

      await suite.group('Past test date', async () => {
        await openPlan();
        await page.setValue('[data-action="set-test-date"]', pastDate);
        suite.eq('stores a past date', await page.eval('return store.testDate'), pastDate);
        const label = await planCountdown();
        suite.check('countdown says the date has passed', /Test date has passed/.test(label || ''), label);
        suite.eq('daysToTest is negative', (await page.eval('return planToday()')).daysToTest, pastOffset);
        suite.eq('no Today marker for a past test date', await page.count('.plan-day.is-today'), 0);
      });

      await suite.group('Clearing the test date', async () => {
        await openPlan();
        await page.setValue('[data-action="set-test-date"]', '');
        suite.eq('stores null', await page.eval('return store.testDate'), null);
        const label = await planCountdown();
        suite.check('prompts to set a date', /Set your test date/.test(label || ''), label);
        suite.eq('planToday returns null without a date', await page.eval('return planToday()'), null);
      });

      /* --- ticking ------------------------------------------------------ */

      await suite.group('Ticking a day and persistence', async () => {
        await openPlan();
        await page.click('[data-action="plan-toggle"][data-day="3"]');
        suite.eq('store.plan records day 3', await page.eval('return store.plan[store.planId]["3"]'), 1);
        suite.eq('day 3 marked done', await dayDone(3), true);
        suite.eq('day 3 checkbox shows a tick', await page.text('[data-action="plan-toggle"][data-day="3"]'), '✓');
        let p = await planProgress();
        suite.eq('counter says 1/28', p.count, `1/${PLAN_DAYS} days`);
        suite.eq('percentage is 4%', p.pct, '4%');
        suite.eq('progress bar width is 4%', p.width, '4%');
        suite.eq(
          'tick written to localStorage',
          await page.eval('var s = JSON.parse(localStorage.getItem("liuk_state_v1")); return s.plan[s.planId]["3"];'),
          1
        );

        await reload();
        await openPlan();
        suite.eq('tick survives a reload', await page.eval('return store.plan[store.planId]["3"]'), 1);
        suite.eq('day 3 still marked done after reload', await dayDone(3), true);
        p = await planProgress();
        suite.eq('counter survives a reload', p.count, `1/${PLAN_DAYS} days`);
        suite.eq('percentage survives a reload', p.pct, '4%');
      });

      await suite.group('Unticking a day', async () => {
        await openPlan();
        await page.click('[data-action="plan-toggle"][data-day="3"]');
        suite.eq('store.plan no longer has day 3', await page.eval('return !("3" in store.plan[store.planId])'), true);
        suite.eq('day 3 not marked done', await dayDone(3), false);
        suite.eq('day 3 checkbox is empty', await page.text('[data-action="plan-toggle"][data-day="3"]'), '');
        const p = await planProgress();
        suite.eq('counter back to 0/28', p.count, `0/${PLAN_DAYS} days`);
        suite.eq('percentage back to 0%', p.pct, '0%');

        await reload();
        await openPlan();
        suite.eq('untick survives a reload', await page.eval('return !("3" in store.plan[store.planId])'), true);
        suite.eq('day 3 still not done after reload', await dayDone(3), false);
      });

      /* --- milestones --------------------------------------------------- */

      await suite.group('Milestones reflect completion', async () => {
        await openPlan();
        let rows = await milestoneRows();
        const wantedDays = await page.eval(
          'return currentPlan().milestones.map(function (m) { return "Day " + m.day; });'
        );
        suite.eq('one milestone row per checkpoint', rows.length, wantedDays.length);
        suite.check(
          'milestone rows name the checkpoints',
          JSON.stringify(rows.map((r) => r.day)) === JSON.stringify(wantedDays),
          JSON.stringify(rows.map((r) => r.day))
        );
        suite.check(
          'milestone bars are empty with no ticks',
          rows.every((r) => r.width === '0%'),
          JSON.stringify(rows)
        );

        await page.click('[data-action="plan-toggle"][data-day="7"]');
        rows = await milestoneRows();
        const d7 = rows.find((r) => r.day === 'Day 7');
        suite.eq('day 7 milestone bar fills when day 7 is ticked', d7 && d7.width, '100%');
        suite.check(
          'other milestone bars stay empty',
          rows.filter((r) => r.day !== 'Day 7').every((r) => r.width === '0%'),
          JSON.stringify(rows)
        );

        await page.click('[data-action="plan-toggle"][data-day="7"]');
        rows = await milestoneRows();
        suite.check(
          'milestone bar empties again when unticked',
          rows.every((r) => r.width === '0%'),
          JSON.stringify(rows)
        );
      });

      /* --- reset -------------------------------------------------------- */

      await suite.group('Reset plan clears ticks and date, and persists', async () => {
        await openPlan();
        await page.click('[data-action="plan-toggle"][data-day="12"]');
        await page.setValue('[data-action="set-test-date"]', inPlanDate);
        suite.eq('setup: a day is ticked', await page.eval('return store.plan[store.planId]["12"]'), 1);
        suite.eq('setup: a test date is set', await page.eval('return store.testDate'), inPlanDate);

        const before = page.dialogs.length;
        await page.click('[data-action="reset-plan"]');
        await sleep(150);
        suite.check(
          'reset asked for confirmation',
          page.dialogs.slice(before).some((m) => /ticks/i.test(m)),
          JSON.stringify(page.dialogs.slice(before))
        );

        suite.eq('ticks cleared', await page.eval('return Object.keys(store.plan[store.planId]).length'), 0);
        suite.eq('test date cleared too', await page.eval('return store.testDate'), null);
        suite.eq('no days are marked done', await page.count('.plan-day.is-done'), 0);
        const p = await planProgress();
        suite.eq('counter reset to 0/28', p.count, `0/${PLAN_DAYS} days`);
        suite.eq('percentage reset to 0%', p.pct, '0%');

        await reload();
        await openPlan();
        suite.eq(
          'reset persists across a reload',
          await page.eval('return Object.keys(store.plan[store.planId]).length === 0 && store.testDate === null'),
          true
        );
      });

      /* --- per-day action buttons --------------------------------------- */

      await suite.group('Per-day action buttons dispatch the promised action', async () => {
        // Give "Retry wrong" something to open.
        await page.eval(`
          var ids = DATA.all.slice(0, 2).map(function (q) { return q.id; });
          store.wrong = {};
          store.wrong[ids[0]] = 1;
          store.wrong[ids[1]] = 1;
          saveStore();
          return ids;
        `);

        const cases = [
          { day: 1, action: 'start-cat', cat: 'values_principles', title: 'Values & Principles' },
          { day: 4, action: 'start-cat', cat: 'history', title: 'A Long & Illustrious History' },
          { day: 7, action: 'start-mock' },
          { day: 13, action: 'start-wrong', title: 'Retry wrong' },
          { day: 22, action: 'go-tab', tab: 'stats' },
          { day: 23, action: 'start-all', title: 'All questions' },
          { day: 27, action: 'start-quick', title: 'Quick 10' },
        ];

        for (const c of cases) {
          await openPlan();
          const spec = await page.eval(
            `var d = currentPlan().days.filter(function (x) { return x.d === ${c.day}; })[0]; return d && d.go;`
          );
          const idx = await goIndexForDay(c.day);
          suite.eq(`day ${c.day} has an action button`, idx >= 0, true);
          if (idx < 0) continue;

          suite.eq(
            `day ${c.day} button label matches the plan`,
            await page.eval(`return document.querySelectorAll('.plan-go')[${idx}].textContent.trim();`),
            spec.label
          );
          suite.eq(
            `day ${c.day} button action matches the plan`,
            await page.eval(`return document.querySelectorAll('.plan-go')[${idx}].dataset.action;`),
            c.action
          );

          await page.click('.plan-go', { index: idx });

          if (c.action === 'start-cat') {
            suite.eq(`day ${c.day} opens the practice tab`, await page.eval('return ui.tab'), 'practice');
            suite.eq(`day ${c.day} opens a practice session`, await page.eval('return ui.screen'), 'session');
            suite.eq(
              `day ${c.day} drills the promised category`,
              await page.eval('return ui.session && ui.session.catId'),
              c.cat
            );
            suite.eq(
              `day ${c.day} session title is the category`,
              await page.eval('return ui.session && ui.session.title'),
              c.title
            );
            suite.eq(
              `day ${c.day} loads every question in that category`,
              await page.eval(`return ui.session.items.length === DATA.byCat["${c.cat}"].length`),
              true
            );
          } else if (c.action === 'start-mock') {
            suite.eq(`day ${c.day} switches to the mock tab`, await page.eval('return ui.tab'), 'mock');
            suite.eq(`day ${c.day} opens a mock`, await page.eval('return ui.screen'), 'mock');
            suite.eq(
              `day ${c.day} mock has 24 questions`,
              await page.eval('return ui.mock && ui.mock.items.length'),
              24
            );
            await page.eval('stopTimer(); clearActiveMock(); ui.mock = null; return true;');
          } else if (c.action === 'start-wrong') {
            suite.eq(`day ${c.day} opens the practice tab`, await page.eval('return ui.tab'), 'practice');
            suite.eq(`day ${c.day} opens a practice session`, await page.eval('return ui.screen'), 'session');
            suite.eq(
              `day ${c.day} title is Retry wrong`,
              await page.eval('return ui.session && ui.session.title'),
              c.title
            );
            suite.eq(
              `day ${c.day} loads the two wrong answers`,
              await page.eval('return ui.session.items.length'),
              2
            );
          } else if (c.action === 'go-tab') {
            suite.eq(`day ${c.day} opens the ${c.tab} tab`, await page.eval('return ui.tab'), c.tab);
            suite.eq(
              `day ${c.day} renders the stats screen`,
              await page.eval('return !!document.querySelector(".stat-grid");'),
              true
            );
            suite.eq(
              `day ${c.day} header says Statistics`,
              await page.eval('return document.getElementById("headerSubtitle").textContent'),
              'Statistics'
            );
          } else if (c.action === 'start-all') {
            suite.eq(`day ${c.day} opens the practice tab`, await page.eval('return ui.tab'), 'practice');
            suite.eq(
              `day ${c.day} title is All questions`,
              await page.eval('return ui.session && ui.session.title'),
              c.title
            );
            suite.eq(
              `day ${c.day} loads the whole pool`,
              await page.eval('return ui.session.items.length === DATA.all.length'),
              true
            );
          } else if (c.action === 'start-quick') {
            suite.eq(`day ${c.day} opens the practice tab`, await page.eval('return ui.tab'), 'practice');
            suite.eq(
              `day ${c.day} title is Quick 10`,
              await page.eval('return ui.session && ui.session.title'),
              c.title
            );
            suite.eq(`day ${c.day} loads exactly 10 questions`, await page.eval('return ui.session.items.length'), 10);
          }
        }
      });

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
