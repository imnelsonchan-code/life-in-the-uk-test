# Life in the UK Test — practice app

[![Deploy to GitHub Pages](https://github.com/imnelsonchan-code/life-in-the-uk-test/actions/workflows/pages.yml/badge.svg)](https://github.com/imnelsonchan-code/life-in-the-uk-test/actions/workflows/pages.yml)
![Questions](https://img.shields.io/badge/questions-716-blue)
![No build step](https://img.shields.io/badge/build-none%20%E2%80%94%20plain%20HTML%2FCSS%2FJS-brightgreen)

A small, offline-friendly web app for practising the Life in the UK Test: drill by
category, sit timed mock tests, follow a study plan, and review the questions you
keep getting wrong.

> **Live site:** https://imnelsonchan-code.github.io/life-in-the-uk-test/

![The practice home](docs/screenshot.png)

## Features

- **Practice by category** — 716 questions across the five handbook chapters,
  with filters for question type, difficulty and "only questions I haven't seen".
- **Timed mock tests** — 24 questions in 45 minutes, 18 to pass, with the real
  test's chapter weighting and a per-question review at the end.
- **Study plan** — choose a **4-week, 2-week or 1-week** schedule. Each day has
  its own reading, drilling and mock targets, a "today" marker driven by your
  test date, and progress you tick off as you go (kept per plan).
- **Flag & review** — flag any question for a second look, then review your
  flagged questions or your wrong answers. The review screens show the question
  and options only; use *Practise these* to answer them and see the explanation.
- **Statistics** — seen/correct totals, per-category accuracy, mock history and
  your best score.
- **Verify mode** — work through the pool alongside your own copy of the
  handbook, mark each question *OK* or *needs fix*, and export the notes.
- **Multiple people** — optional named profiles, so several people can share one
  device without mixing up their progress.
- **Project link** — a GitHub star button sits in the header (and a
  home-screen-style tile on the Practice home) pointing at the source repo, with
  its live star count.
- **Offline** — everything (progress included) lives in `localStorage`. There is
  no backend and no account, and no data ever leaves the device. The single
  optional network call is the GitHub star count; if it can't be reached, the
  number is hidden and the rest of the app is unaffected.

## The question pool

| Chapter | Questions |
|---|---|
| The values and principles of the UK | 72 |
| What is the UK? | 77 |
| A long and illustrious history | 243 |
| A modern, thriving society | 164 |
| The UK government, the law and your role | 160 |
| **Total** | **716** |

Every question follows the schema in [`app/data/schema.md`](app/data/schema.md)
(`single`, `truefalse`, `two`, `statement`) and ships with an explanation and a
source note.

## Running it locally

The app is plain HTML/CSS/JS — no framework, no bundler, no `npm install`. Serve
the `app/` folder with anything:

```bash
python3 -m http.server 8899 --directory app     # then open http://localhost:8899
```

Or with Docker (nginx, rebuilds the image):

```bash
LIFE_IN_UK_PORT=8090 docker compose up -d --build   # then open http://localhost:8090
```

## Working on the questions

`app/data/parts/*.json` holds the source questions. `app/data/questions/*.json`
is the merged pool the app actually loads — regenerate it after editing parts:

```bash
node tools/merge.js        # parts -> app/data/questions (+ index.json)
node tools/validate.js     # schema and invariant checks
node tools/test.js         # regression suite (64 checks)
```

Browser end-to-end tests run against a live server (they drive the system Chrome
over the DevTools protocol, no dependencies to install):

```bash
node tools/e2e.js --base=http://localhost:8090          # all suites
node tools/e2e.js --only=plan --base=http://localhost:8090
```

Other helpers: `tools/stats.js` (pool breakdown), `tools/dupes.js`
(near-duplicate detection), `tools/find.js` (locate a question by id),
`tools/verify-sheet.js` (markdown verify sheet).

The fact-checking notes for the current pool are in
[`verify/`](verify/fact-check-2026-10-19.md).

## Project structure

```
app/                     the site — this directory is what gets deployed
  index.html
  css/styles.css
  js/app.js              the whole application
  data/questions/        merged pool loaded at runtime
  data/parts/            source questions (edit these)
  data/schema.md         question schema
docker/                  nginx config for the container
docs/                    README assets
tools/                   data pipeline, tests and the e2e harness
verify/                  fact-check reports
.github/workflows/       GitHub Pages deploy workflow
```

## Deployment

Hosting is a standard **GitHub Pages** site built by
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). On every push to
`main` the workflow:

1. runs `node tools/validate.js` and `node tools/test.js` (a red build blocks the deploy),
2. stamps the CSS/JS URLs in `index.html` with the commit SHA, so browsers never
   serve a stale app after a release,
3. uploads only the `app/` directory and deploys it to Pages.

So the published site is exactly the tested, committed `app/` folder — and it
lands at `https://<user>.github.io/<repo>/`.

## A note on content

This is an independent study aid. It is **not** affiliated with, endorsed by, or
connected to the Home Office, PSI, or the official *Life in the UK* handbook. All
questions here are original, written from publicly available facts, and the
explanations are our own wording — no third-party question bank or PDF is
included in this repository. Always treat the official handbook as the source of
truth.

## Credits

Built for personal study. Questions and explanations written for this project;
the fact-checking pass is documented in `verify/`.
