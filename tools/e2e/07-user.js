/**
 * 07-user.js — the User tab.
 *
 * Covers named profiles on one device: creating a profile (and adopting the
 * progress already made anonymously), per-person progress, switching between
 * people, renaming, deleting, persistence across a reload, and the isolation
 * of per-person state (progress and a half-finished mock).
 */

const { launch } = require('../harness');

const POOL = 716;

module.exports = {
  name: 'User profiles',
  async run(suite, ctx) {
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.goto(ctx.base + '/');
      await page.ready(POOL);

      /** Open the User tab and wait for it to settle. */
      async function toUser() {
        await page.click('.tab[data-tab="user"]');
        await page.waitFor('ui.tab === "user" && ui.screen === "home"', { label: 'user tab' });
      }

      async function toPracticeHome() {
        await page.click('.tab[data-tab="practice"]');
        await page.waitFor('ui.tab === "practice" && ui.screen === "home"', { label: 'practice home' });
      }

      /** Add a person through the real form. */
      async function addPerson(name) {
        await toUser();
        await page.setValue('#userNew', name);
        await page.click('[data-action="add-user"]');
        await page.waitFor('ui.tab === "user"', { label: 'after add-user' });
      }

      /** Answer exactly one practice question, optionally getting it wrong. */
      async function answerOne(right) {
        await toPracticeHome();
        await page.click('[data-action="start-cat"]', { index: 0 });
        await page.waitFor('ui.screen === "session" && ui.session', { label: 'practice session' });
        const picks = await page.eval(
          `var it = ui.session.items[ui.session.i];
           var all = it.options.map(function (_, i) { return i; });
           if (${right}) return it.answer.slice();
           // For a "Choose TWO" question a wrong answer still needs two picks.
           return all.filter(function (i) { return it.answer.indexOf(i) < 0; }).slice(0, it.answer.length);`
        );
        for (const p of picks) await page.click(`[data-action="pick"][data-idx="${p}"]`);
        await page.click('[data-action="check"]');
        await page.waitFor('ui.session.items[ui.session.i].revealed === true', { label: 'revealed' });
        return picks.length;
      }

      const seenCount = () => page.eval('return Object.keys(store.seen).length');

      /* ============================================================== group 1 */
      await suite.group('A fresh device starts with no profile', async () => {
        await toUser();
        suite.eq('the user tab renders', await page.eval('return ui.tab'), 'user');
        suite.eq('no profile is active yet', await page.eval('return activeUser()'), null);
        suite.check('the name field is offered', await page.exists('#userName'));
        suite.check('the "Start tracking" button is offered', await page.exists('[data-action="save-user"]'));
        suite.check(
          'the empty roster leaves liuk_users_v1 unset',
          await page.eval('return localStorage.getItem("liuk_users_v1") === null')
        );
      });

      /* ============================================================== group 2 */
      await suite.group('Naming yourself adopts progress already made', async () => {
        await answerOne(true);
        suite.eq('one question is now recorded as seen', await seenCount(), 1);

        await toUser();
        await page.setValue('#userName', 'Alex');
        await page.click('[data-action="save-user"]');
        await page.waitFor('activeUser() && activeUser().name === "Alex"', { label: 'profile Alex' });

        suite.eq('a profile was created', await page.eval('return profiles.order.length'), 1);
        suite.eq('it is the active person', await page.eval('return activeUser().name'), 'Alex');
        suite.eq('the progress made before naming is kept', await seenCount(), 1);
        suite.eq(
          'the progress card renders that count',
          await page.eval('return document.querySelector(".stat-box .n").textContent'),
          '1'
        );
        suite.check(
          'the roster is persisted',
          await page.eval('return JSON.parse(localStorage.getItem("liuk_users_v1")).order.length === 1')
        );
        suite.check(
          'the progress card shows the person by name',
          (await page.eval('return document.querySelector("main").textContent')).indexOf("Alex's progress") >= 0
        );
      });

      /* ============================================================== group 3 */
      await suite.group('Adding a second person gives them a clean slate', async () => {
        await addPerson('Sam');
        suite.eq('two people are on the device', await page.eval('return profiles.order.length'), 2);
        suite.eq('the new person is active', await page.eval('return activeUser().name'), 'Sam');
        suite.eq('the new person starts with no seen questions', await seenCount(), 0);
        suite.eq('the new person has no mock history', await page.eval('return store.mocks.length'), 0);

        suite.eq(
          "Alex's progress is parked, not lost",
          await page.eval(
            `var a = profiles.order.map(function (id) { return profiles.byId[id]; })
               .filter(function (p) { return p.name === "Alex"; })[0];
             return Object.keys(a.saved.seen).length;`
          ),
          1
        );

        await answerOne(false);
        suite.eq("Sam's own progress is recorded", await seenCount(), 1);
        suite.eq('and it counts as a wrong answer', await page.eval('return Object.keys(store.wrong).length'), 1);
      });

      /* ============================================================== group 4 */
      await suite.group('Switching back restores exactly that person', async () => {
        await toUser();
        const alexId = await page.eval(
          `return profiles.order.map(function (id) { return profiles.byId[id]; })
             .filter(function (p) { return p.name === "Alex"; })[0].id;`
        );
        await page.click(`[data-action="switch-user"][data-id="${alexId}"]`);
        await page.waitFor('activeUser().name === "Alex"', { label: 'switch back to Alex' });

        suite.eq('Alex is active again', await page.eval('return activeUser().name'), 'Alex');
        suite.eq("Alex's seen count is restored", await seenCount(), 1);
        suite.eq("Alex's answer was right, Sam's was wrong", await page.eval('return Object.keys(store.wrong).length'), 0);
        suite.eq('Alex has no mock history either', await page.eval('return store.mocks.length'), 0);
        suite.check(
          'the switcher marks Alex as the active person',
          await page.eval(
            `return document.querySelector('[data-action="switch-user"][data-id="${alexId}"] .cat-chev').textContent === "✓";`
          )
        );
      });

      /* ============================================================== group 5 */
      await suite.group('Renaming the active person', async () => {
        await toUser();
        await page.setValue('#userName', 'Alexandra');
        await page.click('[data-action="save-user"]');
        await page.waitFor('activeUser().name === "Alexandra"', { label: 'rename' });
        suite.eq('the roster shows the new name', await page.eval('return activeUser().name'), 'Alexandra');
        suite.eq('renaming does not create a second person', await page.eval('return profiles.order.length'), 2);
        suite.eq('and does not disturb progress', await seenCount(), 1);
        suite.eq('no name is invented when the field is empty', await page.eval(
          `var el = document.getElementById("userName"); el.value = "   ";
           var before = activeUser().name;
           renameUser(el.value);
           return activeUser().name === before;`
        ), true);
      });

      /* ============================================================== group 6 */
      await suite.group('A reload keeps the active person and their progress', async () => {
        await page.goto(ctx.base + '/');
        await page.ready(POOL);
        suite.eq('the active person survives a reload', await page.eval('return activeUser().name'), 'Alexandra');
        suite.eq('so does their progress', await page.eval('return Object.keys(store.seen).length'), 1);
        suite.eq('and the whole roster', await page.eval('return profiles.order.length'), 2);
      });

      /* ============================================================== group 7 */
      await suite.group('A half-finished mock belongs to one person', async () => {
        await page.click('.tab[data-tab="mock"]');
        await page.waitFor('ui.tab === "mock" && ui.screen === "mock-home"', { label: 'mock home' });
        await page.eval('var d = document.querySelector(\'[data-action="discard-mock"]\'); if (d) d.click(); return true;');
        await page.waitFor('!localStorage.getItem("liuk_active_mock_v1")', { label: 'no active mock' });
        await page.click('[data-action="start-mock"]');
        await page.waitFor('ui.screen === "mock" && ui.mock', { label: 'mock running' });
        suite.check(
          'the running mock is written for this person',
          await page.eval('return !!localStorage.getItem("liuk_active_mock_v1")')
        );

        await addPerson('Robin');
        suite.eq(
          "the new person does not inherit the mock in progress",
          await page.eval('return localStorage.getItem("liuk_active_mock_v1")'),
          null
        );

        const alexId = await page.eval(
          `return profiles.order.map(function (id) { return profiles.byId[id]; })
             .filter(function (p) { return p.name === "Alexandra"; })[0].id;`
        );
        await page.click(`[data-action="switch-user"][data-id="${alexId}"]`);
        await page.waitFor('activeUser().name === "Alexandra"', { label: 'back to Alexandra' });
        suite.check(
          'switching back brings the mock in progress with them',
          await page.eval('return !!localStorage.getItem("liuk_active_mock_v1")')
        );
      });

      /* ============================================================== group 8b */
      await suite.group('Resetting progress clears only the active person', async () => {
        await page.click('.tab[data-tab="stats"]');
        await page.waitFor('ui.tab === "stats"', { label: 'stats tab' });
        await page.click('[data-action="reset-stats"]');
        await page.waitFor('Object.keys(store.seen).length === 0', { label: 'progress reset' });

        suite.eq('the active person is wiped', await seenCount(), 0);
        suite.eq('but the roster survives', await page.eval('return profiles.order.length'), 3);
        suite.check(
          "and the other people's saved progress is untouched",
          await page.eval(
            `var s = profiles.order.map(function (id) { return profiles.byId[id]; })
               .filter(function (p) { return p.name === "Sam"; })[0];
             return Object.keys(s.saved.seen).length;`
          ) === 1
        );

        const alexId = await page.eval(
          `return profiles.order.map(function (id) { return profiles.byId[id]; })
             .filter(function (p) { return p.name === "Alexandra"; })[0].id;`
        );
        await toUser();
        await page.click(`[data-action="switch-user"][data-id="${alexId}"]`);
        await page.waitFor('activeUser().name === "Alexandra"', { label: 'back to Alexandra' });
        suite.eq('the reset person stays reset', await seenCount(), 0);
      });

      /* ============================================================== group 9 */
      await suite.group('Removing people', async () => {
        await toUser();
        // Removing the active person falls back to whoever is left.
        await page.click('[data-action="delete-user"]');
        await page.waitFor('activeUser() && activeUser().name !== "Alexandra"', { label: 'fell back to someone else' });
        suite.eq('the roster shrank by one', await page.eval('return profiles.order.length'), 2);
        suite.check(
          'the survivor cannot be the one just deleted',
          await page.eval('return Object.keys(profiles.byId).indexOf(profiles.active) >= 0')
        );
        suite.eq(
          "the survivor kept their own progress, not the deleted person's",
          await page.eval('return profiles.byId[profiles.active].saved === null || profiles.byId[profiles.active].saved === undefined'),
          true
        );
        suite.eq('the survivor is Sam, who had one seen question', await seenCount(), 1);

        // Removing everyone returns to the anonymous setup form.
        await page.eval(
          `while (profiles.order.length) { removeUser(profiles.order.slice()[0]); }
           return true;`
        );
        await toUser();
        suite.eq('no profiles remain', await page.eval('return profiles.order.length'), 0);
        suite.eq('no profile is active', await page.eval('return activeUser()'), null);
        suite.check('the setup form comes back', await page.exists('#userName'));
        suite.eq('and the anonymous state is a clean slate', await seenCount(), 0);
      });

      /* ============================================================= group 10 */
      await suite.group('No client-side problems', async () => {
        const problems = page.problems();
        suite.eq('no console errors or failed requests', problems.length, 0, JSON.stringify(problems).slice(0, 400));
      });
    } finally {
      await browser.close();
    }
  },
};
