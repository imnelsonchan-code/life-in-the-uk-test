'use strict';

/**
 * Verify tab — check the pool against the handbook.
 *
 * Covers the chooser totals, per-chapter review (fact/explanation/answer),
 * navigation, ✅/✗ marking and counts, persistence, the corrections export,
 * the shared-by-id "New questions" pseudo-category, reset, and a full sweep of
 * the whole new-batch view.
 *
 * Marks live in `store.verify[qid] = { k: 'ok' | 'fix', n: note }`.
 */

const { launch } = require('../harness');

const POOL = 716;
const NEW = 139;
const CHAPTERS = [
  { id: 'values_principles', name: 'Values & Principles', total: 72 },
  { id: 'what_is_uk', name: 'What is the UK?', total: 77 },
  { id: 'history', name: 'A Long & Illustrious History', total: 243 },
  { id: 'modern_society', name: 'A Modern, Thriving Society', total: 164 },
  { id: 'government_law', name: 'Government, Law & Your Role', total: 160 },
];
const TOTAL_BY_CAT = Object.fromEntries(CHAPTERS.map((c) => [c.id, c.total]));
const NAME_BY_CAT = Object.fromEntries(CHAPTERS.map((c) => [c.id, c.name]));

module.exports = {
  name: 'Verify tab',

  async run(suite, ctx) {
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.goto(ctx.base + '/');
      await page.ready(POOL);

      /* ---------------------------------------------------------------- helpers */

      // Land on the Verify chooser with no chapter open.
      const verifyHome = () =>
        page.eval(
          'setTab("verify"); ui.screen="home"; ui.verify={cat:null,i:0,editing:false,note:""}; render(); return true;'
        );

      // Open a specific verify question by index (setup only; the navigation
      // assertions below drive real buttons).
      const gotoVerify = (cat, i) =>
        page.eval(
          `setTab("verify"); ui.screen="home"; ui.verify={cat:${JSON.stringify(cat)},i:${i},editing:false,note:""}; render(); return true;`
        );

      const rowMeta = (cat) =>
        page.eval(
          `var r=document.querySelector('[data-action="verify-start"][data-cat=${JSON.stringify(cat)}]'); return r ? r.querySelector('.cat-meta').innerText : null;`
        );

      const statN = (i) =>
        page.eval(
          `var ns=document.querySelectorAll('#main .stat-box .n'); return ns[${i}] ? ns[${i}].innerText : null;`
        );

      const progress = () =>
        page.eval(
          `var p=document.querySelector('.q-progress'); if(!p) return null; var sp=p.querySelectorAll('span'); return { pos: sp[0].innerText, meta: sp[sp.length-1].innerText };`
        );

      // `.pill` is CSS-uppercased (text-transform), so read textContent for the
      // real stored label rather than the rendered innerText.
      const pills = () =>
        page.eval(
          `return [...document.querySelectorAll('#main .q-meta .pill')].map(function(n){return n.textContent;});`
        );

      const feedback = () =>
        page.eval(
          `var f=document.querySelector('#main .feedback'); return f ? f.innerText : null;`
        );

      // Intercept the download so we can read the exact "Export corrections"
      // payload without writing a file.
      const captureExport = async () => {
        await page.eval(`
          window.__exportBlob = null;
          window.__exportName = null;
          if (!window.__origCreate) {
            window.__origCreate = URL.createObjectURL.bind(URL);
            window.__origAnchorClick = HTMLAnchorElement.prototype.click;
          }
          URL.createObjectURL = function(b){ window.__exportBlob = b; return 'blob:stub'; };
          HTMLAnchorElement.prototype.click = function(){
            window.__exportName = this.download;
            if (this.href && this.href.indexOf('blob:') === 0) return;
            return window.__origAnchorClick.apply(this, arguments);
          };
          return true;
        `);
        await page.click('[data-action="verify-export"]');
        const text = await page.eval(
          'return window.__exportBlob ? window.__exportBlob.text() : null;'
        );
        const name = await page.eval('return window.__exportName;');
        return { text, name };
      };

      /* =============================================================== chooser */

      await suite.group('Chooser totals', async () => {
        await verifyHome();
        await page.waitFor('ui.tab === "verify" && !ui.verify.cat');

        suite.eq(
          'chooser lists five chapters plus the new-batch row',
          await page.count('[data-action="verify-start"]'),
          6
        );
        suite.eq(
          'overall pool total is 716',
          await page.eval(
            'var p=[...document.querySelectorAll("#main .card p.small.muted")].map(function(n){return n.innerText;}); return p.some(function(t){return /^716 questions in the pool\\.$/.test(t.trim());});'
          ),
          true
        );

        for (const c of CHAPTERS) {
          suite.eq(`row total for ${c.id}`, await rowMeta(c.id), `0/${c.total}`);
        }

        suite.eq('new-batch row starts 0/139', await rowMeta('new'), `0/${NEW}`);
        suite.eq(
          'new-batch row is labelled "New questions"',
          await page.eval(
            'var r=document.querySelector(\'[data-action="verify-start"][data-cat="new"]\'); return r.querySelector(".cat-name").innerText;'
          ),
          'New questions'
        );
        suite.eq('initial Checked is 0', await statN(0), '0');
        suite.eq('initial To-fix is 0', await statN(1), '0');
        suite.eq(
          'export disabled with nothing to fix',
          await page.eval('return document.querySelector(\'[data-action="verify-export"]\').disabled;'),
          true
        );
        suite.eq(
          'reset disabled with nothing checked',
          await page.eval('return document.querySelector(\'[data-action="verify-reset"]\').disabled;'),
          true
        );
      });

      /* ========================================================= chapter view */

      await suite.group('Chapter view shows the fact and stored answer', async () => {
        await verifyHome();
        await page.click('[data-action="verify-start"][data-cat="history"]');
        await page.waitFor('ui.verify.cat === "history"');

        const first = await page.eval(
          `var qs=catQuestions('history'); var q=qs[0];
           return { id:q.id, explanation:q.explanation, question:q.question, answer:q.answer.slice(), options:q.options.slice() };`
        );

        suite.eq('history chapter length is 243', await page.eval('return catQuestions("history").length'), 243);
        suite.eq('shows question 1/243', (await progress()).pos, '1/243');
        suite.eq(
          'header subtitle names the chapter',
          await page.eval('return document.getElementById("headerSubtitle").innerText;'),
          NAME_BY_CAT.history
        );

        const p = await pills();
        suite.eq('category pill matches the chapter', p[0], NAME_BY_CAT.history);
        suite.eq('id pill matches the question', p[p.length - 1], first.id);

        suite.eq(
          'fact-to-check shows the question explanation',
          await page.text('#main .q-text'),
          first.explanation
        );
        suite.check(
          'the pool question text is shown',
          (await page.eval('return document.getElementById("main").innerText;')).includes(first.question)
        );

        const shown = await page.eval(
          `return [...document.querySelectorAll('#main .ropt')].map(function(n){ return n.querySelectorAll('span')[1].innerText; });`
        );
        const correct = await page.eval(
          `return [...document.querySelectorAll('#main .ropt.correct')].map(function(n){ return n.querySelectorAll('span')[1].innerText; });`
        );
        const want = first.answer.map((i) => first.options[i]);
        suite.eq('all options are listed', shown.length, first.options.length);
        suite.eq(
          'the stored correct answer is the highlighted option(s)',
          JSON.stringify(correct.slice().sort()),
          JSON.stringify(want.slice().sort())
        );
        suite.eq(
          'back control is visible inside a chapter',
          await page.eval('return document.getElementById("backBtn").hidden;'),
          false
        );
      });

      /* ========================================================== navigation */

      await suite.group('Next / previous / back navigation', async () => {
        await verifyHome();
        await page.click('[data-action="verify-start"][data-cat="history"]');
        await page.waitFor('ui.verify.cat === "history"');

        const ids = await page.eval(
          'return catQuestions("history").slice(0,3).map(function(q){return q.id;});'
        );

        await page.click('[data-action="verify-next"]');
        suite.eq('Next moves to 2/243', (await progress()).pos, '2/243');
        suite.eq(
          'Next shows the next question id',
          (await pills()).slice(-1)[0],
          ids[1]
        );

        await page.click('[data-action="verify-prev"]');
        suite.eq('Prev returns to 1/243', (await progress()).pos, '1/243');
        suite.eq('Prev returns to the first question id', (await pills()).slice(-1)[0], ids[0]);
        suite.eq(
          'Prev is disabled on the first question',
          await page.eval('return document.querySelector(\'[data-action="verify-prev"]\').disabled;'),
          true
        );

        await page.click('#backBtn');
        await page.waitFor('!ui.verify.cat');
        suite.eq('back returns to the chooser', await page.eval('return ui.verify.cat;'), null);
        suite.eq(
          'back hides the back control on the chooser',
          await page.eval('return document.getElementById("backBtn").hidden;'),
          true
        );
        suite.eq('chapter row is untouched by navigation', await rowMeta('history'), '0/243');
      });

      await suite.group('End of a chapter is handled', async () => {
        const last = await page.eval('return catQuestions("history").length - 1;');
        await gotoVerify('history', last);
        await page.waitFor('ui.verify.i === ' + last);

        suite.eq('sits on the last question', (await progress()).pos, '243/243');
        suite.eq(
          'Next is disabled on the last question',
          await page.eval('return document.querySelector(\'[data-action="verify-next"]\').disabled;'),
          true
        );
        suite.eq(
          'Prev is enabled on the last question',
          await page.eval('return document.querySelector(\'[data-action="verify-prev"]\').disabled;'),
          false
        );
        suite.eq(
          'clicking back returns to the chooser from the end',
          await (async () => {
            await page.click('#backBtn');
            await page.waitFor('!ui.verify.cat');
            return await page.eval('return ui.verify.cat;');
          })(),
          null
        );
      });

      /* ====================================================== marks & counts */

      let id1 = null; // marked ok
      let id2 = null; // marked fix
      let note2 = 'The battle was in 1485, not 1486.';
      let exp2 = null;

      await suite.group('✅ Correct and ✗ Needs fix update the counts', async () => {
        await verifyHome();
        await page.click('[data-action="verify-start"][data-cat="history"]');
        await page.waitFor('ui.verify.cat === "history"');
        const ids = await page.eval(
          'return catQuestions("history").slice(0,3).map(function(q){return q.id;});'
        );
        id1 = ids[0];
        id2 = ids[1];
        exp2 = await page.eval('return DATA.byId[' + JSON.stringify(id2) + '].explanation;');

        // Mark question 1 correct.
        await page.click('[data-action="verify-ok"]');
        await page.waitFor('ui.verify.i === 1');
        suite.eq('marking Correct records k:"ok"', await page.eval('return store.verify["' + id1 + '"].k;'), 'ok');
        suite.eq('progress counts 1 checked', (await progress()).meta, '1 checked · 0 to fix');
        suite.eq('Correct advances to the next question', (await progress()).pos, '2/243');

        // Mark question 2 as needing a fix, with a note.
        await page.click('[data-action="verify-fix"]');
        suite.check('Needs fix opens the note editor', await page.exists('#vnote'));
        await page.setValue('#vnote', note2);
        await page.click('[data-action="verify-save-fix"]');
        await page.waitFor('ui.verify.i === 2');
        suite.eq(
          'saving a fix records k:"fix" plus the note',
          JSON.stringify(await page.eval('return store.verify["' + id2 + '"];')),
          JSON.stringify({ k: 'fix', n: note2 })
        );
        suite.eq('progress counts 2 checked · 1 to fix', (await progress()).meta, '2 checked · 1 to fix');
        suite.eq('saving a fix advances to the next question', (await progress()).pos, '3/243');

        // Back to the chooser: the row and the overall counts reflect the marks.
        await page.click('#backBtn');
        await page.waitFor('!ui.verify.cat');
        suite.eq('chooser chapter row shows 2/243 · 1 to fix', await rowMeta('history'), '2/243 · 1 to fix');
        suite.eq('chooser Checked total is 2', await statN(0), '2');
        suite.eq('chooser To-fix total is 1', await statN(1), '1');
        suite.eq(
          'export button counts the corrections',
          await page.text('[data-action="verify-export"]'),
          'Export corrections (1)'
        );
        suite.eq(
          'reset becomes available once something is checked',
          await page.eval('return document.querySelector(\'[data-action="verify-reset"]\').disabled;'),
          false
        );
      });

      await suite.group('Marks survive a reload', async () => {
        await page.goto(ctx.base + '/');
        await page.ready(POOL);
        await verifyHome();
        await page.waitFor('ui.tab === "verify"');
        suite.eq('chapter row survives reload', await rowMeta('history'), '2/243 · 1 to fix');
        suite.eq('Checked total survives reload', await statN(0), '2');
        suite.eq('To-fix total survives reload', await statN(1), '1');
        suite.eq(
          'stored verdict survives reload',
          JSON.stringify(await page.eval('return store.verify["' + id2 + '"];')),
          JSON.stringify({ k: 'fix', n: note2 })
        );
      });

      /* ============================================================== export */

      await suite.group('Corrections export', async () => {
        await verifyHome();
        await page.waitFor('ui.tab === "verify"');
        const out = await captureExport();
        suite.check('export produced a file', out.text !== null, String(out.text));
        suite.eq('export filename', out.name, 'life-in-uk-corrections.md');
        suite.check(
          'export contains the marked id',
          !!out.text && out.text.includes(id2),
          out.text
        );
        suite.check(
          'export contains the pool’s stated fact',
          !!out.text && out.text.includes('Pool says: ' + exp2),
          out.text
        );
        suite.check(
          'export contains the note',
          !!out.text && out.text.includes('Should say: ' + note2),
          out.text
        );
        suite.check(
          'export does not list the ✅-only mark',
          !!out.text && !out.text.includes(id1),
          out.text
        );
        page.clearErrors(); // the export sets up a blob download
      });

      /* ============================================ new-batch shared-by-id */

      await suite.group('New questions marks are shared by id', async () => {
        const target = await page.eval(
          `var qs=catQuestions('new'); var q=qs[0]; var home=catQuestions(q.category);
           return { id:q.id, category:q.category, newTotal:qs.length,
                    homeIndex: home.map(function(x){return x.id;}).indexOf(q.id), homeTotal: home.length };`
        );
        suite.eq('new-batch view has 139 questions', target.newTotal, NEW);
        suite.eq('first new-batch question belongs to its chapter', !!NAME_BY_CAT[target.category], true);

        await verifyHome();
        await page.click('[data-action="verify-start"][data-cat="new"]');
        await page.waitFor('ui.verify.cat === "new"');
        suite.eq('new view shows 1/139', (await progress()).pos, '1/139');
        suite.eq('new view pill reads "New questions"', (await pills())[0], 'New questions');
        suite.eq('new view first id matches catQuestions("new")', (await pills()).slice(-1)[0], target.id);

        // Mark it correct from the New questions view.
        await page.click('[data-action="verify-ok"]');
        suite.eq(
          'marking in the new view stores the mark',
          await page.eval('return store.verify["' + target.id + '"].k;'),
          'ok'
        );

        // Claim 1: the mark shows in its home chapter.
        await page.click('#backBtn');
        await page.waitFor('!ui.verify.cat');
        suite.eq('new row counts 1/139', await rowMeta('new'), '1/139');
        suite.eq(
          'home chapter row counts the new-batch mark',
          await rowMeta(target.category),
          `1/${target.homeTotal}`
        );

        await gotoVerify(target.category, target.homeIndex);
        await page.waitFor('ui.verify.cat === ' + JSON.stringify(target.category));
        suite.eq(
          'home chapter shows the same question id',
          (await pills()).slice(-1)[0],
          target.id
        );
        suite.check(
          'home chapter shows the shared "Marked correct" verdict',
          ((await feedback()) || '').includes('Marked correct'),
          await feedback()
        );

        // Claim 2 (reverse): mark a *different* new-batch question from its home
        // chapter and confirm the New questions view sees it.
        const target2 = await page.eval(
          `var qs=catQuestions('new'); var q=qs[1]; var home=catQuestions(q.category);
           return { id:q.id, category:q.category,
                    homeIndex: home.map(function(x){return x.id;}).indexOf(q.id) };`
        );
        const note3 = 'New-batch note from the chapter view.';
        await gotoVerify(target2.category, target2.homeIndex);
        await page.waitFor('ui.verify.cat === ' + JSON.stringify(target2.category));
        await page.click('[data-action="verify-fix"]');
        await page.setValue('#vnote', note3);
        await page.click('[data-action="verify-save-fix"]');
        suite.eq(
          'fix saved from the home chapter',
          JSON.stringify(await page.eval('return store.verify["' + target2.id + '"];')),
          JSON.stringify({ k: 'fix', n: note3 })
        );

        await gotoVerify('new', 1);
        await page.waitFor('ui.verify.cat === "new"');
        suite.eq('new view index 1 is the second new-batch id', (await pills()).slice(-1)[0], target2.id);
        suite.check(
          'new view shows the mark made in the home chapter',
          ((await feedback()) || '').includes('Marked for correction'),
          await feedback()
        );
        suite.check(
          'new view shows the note made in the home chapter',
          ((await feedback()) || '').includes(note3),
          await feedback()
        );

        // Export must tag the new-batch correction.
        await verifyHome();
        await page.waitFor('ui.tab === "verify"');
        const out = await captureExport();
        suite.check(
          'export tags a new-batch correction with "(new batch)"',
          !!out.text && out.text.includes(target2.id + ' (new batch)'),
          out.text
        );
        page.clearErrors();
      });

      /* =============================================================== reset */

      await suite.group('Reset clears every mark', async () => {
        await verifyHome();
        await page.waitFor('ui.tab === "verify"');
        await page.click('[data-action="verify-reset"]');
        await page.waitFor('Object.keys(store.verify).length === 0');

        suite.eq('store.verify is emptied', await page.eval('return Object.keys(store.verify).length;'), 0);
        suite.eq('Checked returns to 0', await statN(0), '0');
        suite.eq('To-fix returns to 0', await statN(1), '0');
        for (const c of CHAPTERS) {
          suite.eq(`row reset for ${c.id}`, await rowMeta(c.id), `0/${c.total}`);
        }
        suite.eq('new-batch row reset', await rowMeta('new'), `0/${NEW}`);
        suite.eq(
          'export disabled again after reset',
          await page.eval('return document.querySelector(\'[data-action="verify-export"]\').disabled;'),
          true
        );
      });

      /* ================================================= full new-batch sweep */

      await suite.group('Sweeping the whole new-batch view', async () => {
        await verifyHome();
        await page.click('[data-action="verify-start"][data-cat="new"]');
        await page.waitFor('ui.verify.cat === "new"');

        const swept = await page.eval(`
          var clicks = 0;
          for (var i = 0; i < 300; i++) {
            var b = document.querySelector('[data-action="verify-next"]');
            if (!b || b.disabled) break;
            b.click();
            clicks++;
          }
          var p = document.querySelector('.q-progress');
          var sp = p.querySelectorAll('span');
          var nxt = document.querySelector('[data-action="verify-next"]');
          var prv = document.querySelector('[data-action="verify-prev"]');
          return {
            clicks: clicks,
            pos: sp[0].innerText,
            meta: sp[sp.length - 1].innerText,
            nextDisabled: !!(nxt && nxt.disabled),
            prevDisabled: !!(prv && prv.disabled),
            index: ui.verify.i
          };
        `);

        suite.eq('115 Next clicks reach the end', swept.clicks, NEW - 1);
        suite.eq('lands on 139/139', swept.pos, `${NEW}/${NEW}`);
        suite.eq('index is the last question', swept.index, NEW - 1);
        suite.eq('Next is disabled at the end', swept.nextDisabled, true);
        suite.eq('Prev is still usable at the end', swept.prevDisabled, false);

        // Marking at the very end must terminate cleanly, not fall off the end.
        await page.click('[data-action="verify-ok"]');
        await page.waitFor('document.getElementById("toast").textContent === "End of this chapter"');
        suite.eq(
          'advance at the end shows "End of this chapter"',
          await page.text('#toast'),
          'End of this chapter'
        );
        suite.eq('still on 139/139 after the end mark', (await progress()).pos, `${NEW}/${NEW}`);
        suite.eq('index stays on the last question', await page.eval('return ui.verify.i;'), NEW - 1);
        suite.eq('the last question is now checked', (await progress()).meta, '1 checked · 0 to fix');
      });

      /* ==================================================== console hygiene */

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
