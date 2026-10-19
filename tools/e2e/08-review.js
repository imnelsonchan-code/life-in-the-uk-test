'use strict';

/**
 * Flag for review + the review screens.
 *
 * Covers: flagging a question while practising (and while sitting a mock), the
 * flag surviving a reload, the "Review flagged" / "Review wrong" buttons on the
 * practice home, the read-only review screen (answer + explanation, prev/next),
 * "Practise these", and removing an item from a review list.
 *
 * Determinism: questions are shuffled for every session, so assertions are
 * about counts, ids and rendered state — never about which question comes first.
 */

const { launch } = require('../harness');

const POOL = 716;

module.exports = {
  name: 'Flag & review',
  async run(suite, ctx) {
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.goto(ctx.base + '/');
      await page.ready(POOL);

      const flagBtn = '[data-action="review-open"][data-list="flags"]';
      const wrongBtn = '[data-action="review-open"][data-list="wrong"]';
      const isDisabled = (sel) => page.eval(`return document.querySelector('${sel}').disabled`);
      const openReview = async (sel) => {
        await page.click(sel);
        await page.waitFor("ui.screen === 'review'");
      };
      const removeFromReview = async () => {
        await page.click('[data-action="review-remove"]');
        await page.waitFor("ui.screen === 'home'");
      };

      await suite.group('A fresh install has nothing to review', async () => {
        suite.eq('the flagged button is disabled', await isDisabled(flagBtn), true);
        suite.check('and advertises zero', (await page.text(flagBtn)).indexOf('Review flagged (0)') >= 0);
        suite.eq('the wrong button is disabled', await isDisabled(wrongBtn), true);
        suite.check('and advertises zero', (await page.text(wrongBtn)).indexOf('Review wrong (0)') >= 0);
      });

      let flaggedId = null;

      await suite.group('Flag a question while practising', async () => {
        await page.click('[data-action="start-quick"]');
        await page.waitFor("ui.screen === 'session' && ui.session");
        flaggedId = await page.eval('return ui.session.items[ui.session.i].id');

        suite.check('the question screen offers a flag button', await page.exists('[data-action="toggle-flag"]'));
        await page.click('[data-action="toggle-flag"]');
        suite.eq('the flag is written to the store', await page.eval(`return !!store.flags['${flaggedId}']`), true);
        suite.check('the button reads Flagged', (await page.text('[data-action="toggle-flag"]')).indexOf('Flagged') >= 0);

        await page.click('[data-action="toggle-flag"]');
        suite.eq('clicking again clears the flag', await page.eval(`return !!store.flags['${flaggedId}']`), false);
        await page.click('[data-action="toggle-flag"]'); // leave it flagged for the next group

        await page.click('#backBtn');
        await page.waitFor("ui.screen === 'home'");
        suite.eq('the home button is now enabled', await isDisabled(flagBtn), false);
        suite.check('and counts the flagged question', (await page.text(flagBtn)).indexOf('(1)') >= 0);
      });

      await suite.group('Review the flagged question', async () => {
        await openReview(flagBtn);
        suite.eq('the review list is the flags list', await page.eval('return ui.review.kind'), 'flags');
        suite.eq('it holds exactly one question', await page.eval("return reviewIds('flags').length"), 1);

        const q = await page.eval(`return DATA.byId['${flaggedId}']`);
        suite.check('the question text is shown', (await page.text('.q-text')).trim() === q.question);
        suite.eq('the correct option(s) are marked', await page.eval("return document.querySelectorAll('.ropt.correct').length"), q.answer.length);
        suite.check('the answer is revealed', (await page.text('.feedback')).indexOf('Answer:') >= 0);
        suite.eq('previous is disabled on the only question', await isDisabled('[data-action="review-prev"]'), true);
        suite.eq('next is disabled on the only question', await isDisabled('[data-action="review-next"]'), true);

        await page.click('[data-action="review-practise"]');
        await page.waitFor("ui.screen === 'session'");
        suite.eq('"Practise these" starts exactly the flagged question', await page.eval('return ui.session.items.length'), 1);
        suite.eq('and it is the right one', await page.eval('return ui.session.items[0].id'), flaggedId);
      });

      await suite.group('Remove a flag from the review screen', async () => {
        await page.click('#backBtn'); // leave the practice session
        await page.waitFor("ui.screen === 'home'");
        await openReview(flagBtn);
        await removeFromReview();
        suite.eq('the flag is gone from the store', await page.eval('return Object.keys(store.flags).length'), 0);
        suite.eq('the flagged button is disabled again', await isDisabled(flagBtn), true);
      });

      await suite.group('Review a wrong answer', async () => {
        await page.click('[data-action="start-quick"]');
        await page.waitFor("ui.screen === 'session' && ui.session");
        const id = await page.eval('return ui.session.items[ui.session.i].id');

        // deliberately pick a set of options that differs from the answer
        await page.eval(`
          const it = ui.session.items[ui.session.i];
          const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
          let picks;
          if (it.answer.length === 1) picks = [it.answer.includes(0) ? 1 : 0];
          else {
            picks = [0, 1];
            if (same(picks, it.answer)) picks = [0, 2];
          }
          for (const i of picks) document.querySelector('[data-action="pick"][data-idx="' + i + '"]').click();
          return picks;
        `);
        await page.click('[data-action="check"]');
        await page.waitFor('ui.session.items[ui.session.i].revealed');
        suite.eq('a wrong answer is recorded', await page.eval(`return store.wrong['${id}']`), 1);

        await page.click('#backBtn');
        await page.waitFor("ui.screen === 'home'");
        suite.eq('the wrong button is enabled', await isDisabled(wrongBtn), false);

        await openReview(wrongBtn);
        suite.eq('the review list is the wrong list', await page.eval('return ui.review.kind'), 'wrong');
        suite.check('it shows how many times you got it wrong', (await page.text('#main')).indexOf('wrong 1×') >= 0);
        suite.eq(
          'the correct option(s) are marked',
          await page.eval("return document.querySelectorAll('.ropt.correct').length"),
          await page.eval(`return DATA.byId['${id}'].answer.length`)
        );

        await removeFromReview();
        suite.eq('the wrong entry is cleared', await page.eval(`return !!store.wrong['${id}']`), false);
      });

      await suite.group('Flags survive a reload', async () => {
        await page.click('[data-action="start-quick"]');
        await page.waitFor("ui.screen === 'session' && ui.session");
        const id = await page.eval('return ui.session.items[ui.session.i].id');
        await page.click('[data-action="toggle-flag"]');

        await page.goto(ctx.base + '/');
        await page.ready(POOL);
        suite.eq('the flag is still in the store', await page.eval(`return !!store.flags['${id}']`), true);
        suite.check('and the home button counts it', (await page.text(flagBtn)).indexOf('(1)') >= 0);

        await openReview(flagBtn);
        await removeFromReview();
        suite.eq('cleanup leaves no flags', await page.eval('return Object.keys(store.flags).length'), 0);
      });

      await suite.group('Flagging inside a mock is remembered too', async () => {
        await page.click('.tab[data-tab="mock"]');
        await page.waitFor("ui.screen === 'mock-home'");
        await page.click('[data-action="start-mock"]');
        await page.waitFor("ui.screen === 'mock' && ui.mock");

        const id = await page.eval('return ui.mock.items[ui.mock.i].id');
        await page.click('[data-action="mock-flag"]');
        suite.eq('the mock flag lands in the shared store', await page.eval(`return !!store.flags['${id}']`), true);
        await page.click('[data-action="mock-flag"]');
        suite.eq('unflagging in the mock clears it too', await page.eval(`return !!store.flags['${id}']`), false);
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
