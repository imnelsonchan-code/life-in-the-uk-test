# End-to-end tests

Browser tests for the Life in the UK app. No npm install: the harness drives the
system Chrome over the DevTools Protocol using Node's built-in `fetch` and
`WebSocket`.

## Running

```bash
node tools/e2e.js                        # all files, against http://127.0.0.1:8899
node tools/e2e.js --base=http://localhost:8090
node tools/e2e.js --only=mock            # only files whose name contains "mock"
node tools/e2e.js --list
```

Start a server first if one is not already running:

```bash
python3 -m http.server 8899 --directory app
```

The runner exits non-zero if anything fails.

## Writing a test file

One scenario per file, named `NN-topic.js` in this directory. The runner loads
every `.js` file here, so a file must export:

```js
const { launch } = require('../harness');

module.exports = {
  name: 'Practice & filters',
  async run(suite, ctx) {
    const browser = await launch();          // fresh profile => clean localStorage
    try {
      const page = await browser.newPage();
      await page.goto(ctx.base + '/');
      await page.ready(716);                 // waits for DATA.all to populate
      suite.eq('pool size', await page.eval('return DATA.all.length'), 716);
    } finally {
      await browser.close();
    }
  },
};
```

Always close in a `finally`. A file that leaks a browser slows the whole run.

## Harness API

`launch()` → `Browser`. Every `launch()` gets its own temporary Chrome profile,
so localStorage, cookies and progress start empty — **except** where a test
deliberately reloads the same page to check persistence.

**Browser**

| Method | Notes |
| --- | --- |
| `newPage()` | opens a tab, returns a `Page` |
| `close()` | kills Chrome and deletes the profile |

**Page**

| Method | Notes |
| --- | --- |
| `goto(url)` | navigates, waits for `document.readyState === "complete"` |
| `ready(min=1, timeout=20000)` | waits for the app to load its pool |
| `eval(expr)` | runs `expr` **inside a function body — you must `return`** |
| `evalRaw(expr)` | runs `expr` as a bare expression, **no `return`** |
| `waitFor(expr, {timeout,label})` | polls a bare expression until truthy; throws with a useful message |
| `exists(sel)`, `count(sel)`, `text(sel)`, `attr(sel,name)` | DOM helpers |
| `click(sel, {index})` | clicks; **throws** if the element is missing |
| `setValue(sel, value, event='change')` | sets an input and dispatches the event |
| `setViewport({width,height,mobile})` | emulates a device (use for mobile checks) |
| `captureDownloads()` | call before clicking an export button; swallows the real download |
| `downloads()` | `[{name, size, text}]` captured since `captureDownloads()` |
| `errors`, `netFailures`, `dialogs`, `problems()` | client-side problems seen so far; dialogs are auto-dismissed |
| `clearErrors()` | resets the three collectors |
| `close()` | closes the tab |

**Suite**

| Method | Notes |
| --- | --- |
| `check(label, cond, detail)` | one assertion |
| `eq(label, actual, expected)` | strict equality |
| `near(label, actual, expected, tol)` | numeric tolerance |
| `group(label, async fn)` | a named block; a throw inside fails just that block |
| `note(msg)` | informational line |

Keep assertions granular and label them in plain English — the labels are the
test report.

## Driving the app from a test

The app keeps everything on globals, which makes it easy to inspect:

| Global | Meaning |
| --- | --- |
| `DATA.all` | every question in the pool |
| `DATA.byCat[id]` | questions for one category |
| `DATA.batchNew` | the most recently added batch |
| `DATA.cheat` | the cheat-sheet chapters (`{id, ch, name, chip, sections}`) |
| `ui.tab`, `ui.screen`, `ui.session`, `ui.filters`, `ui.mock`, `ui.cheat` | view state |
| `store.seen`, `store.right`, `store.wrong`, `store.flags`, `store.mocks`, `store.plan`, `store.testDate` | persisted state |
| `render()` | re-renders the current screen |
| `setTab(id)` | switches tab (`practice`, `plan`, `mock`, `stats`, `cheat`, `user`) |

Prefer **driving the real UI** (`page.click('[data-action="..."]')`) over calling
internals, so the tests cover what a user actually does. Reach for the globals to
*assert*, and for setup that would be tedious to click through.

`localStorage` keys: `liuk_state_v1` (the active person's state), `liuk_active_mock_v1`
(their in-progress mock) and `liuk_users_v1` (the roster of named people). With no
profiles created the first two behave exactly as a single-user app did.

To test persistence: mutate through the UI, then `goto(ctx.base + '/')` again on
the same page and assert the state survived. To test a first-time user, call
`launch()` again for a clean profile.

## Rules

- **Do not edit `app/`** — report bugs instead. Parallel agents share this repo;
  app edits would collide and hide regressions.
- **Do not edit `tools/harness.js` or `tools/e2e.js`**, and only ever edit your
  own test file. If the harness is missing something you need, work around it and
  say so in your report.
- Determinism matters: the pool is shuffled for practice, so assert on counts and
  invariants, not on a specific question appearing first.
