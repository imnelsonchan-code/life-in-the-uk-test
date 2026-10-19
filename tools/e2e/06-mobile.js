'use strict';

/**
 * Mobile layout & responsiveness.
 *
 * A mobile-first app lives or dies on layout, so this scenario emulates a spread
 * of real phone/tablet viewports and checks, on every tab and screen:
 *
 *   1. nothing overflows horizontally (documentElement + body scrollWidth),
 *   2. the fixed bottom tab bar is visible, inside the viewport, and unclipped,
 *   3. tap targets (primary buttons, filter chips, tab items) are >= 40px tall,
 *   4. category rows and question cards are not truncated or clipped,
 *   5. the single longest question in the pool still fits at 320px,
 *   6. dark mode still renders and actually changes the background,
 *   7. landscape rotation keeps the layout clean and the tab bar visible.
 *
 * Diagnostics name the widest offending element so a real defect is easy to
 * reproduce; the assertions stay tolerant of ±1px rounding but never hide a
 * genuine overflow.
 */

const { launch } = require('../harness');

const EXPECTED_POOL = 716;

/** Real devices, smallest first. */
const VIEWPORTS = [
  { name: '320x568 small', w: 320, h: 568 },
  { name: '360x640 Android', w: 360, h: 640 },
  { name: '390x844 iPhone12/13', w: 390, h: 844 },
  { name: '414x896 iPhoneMax', w: 414, h: 896 },
  { name: '768x1024 tablet', w: 768, h: 1024 },
];
const SMALL = VIEWPORTS[0];
const MID = VIEWPORTS[2];
const SWEEP = [SMALL, MID];

/** 1px of rounding slack: sub-pixel layout is not a defect. */
const SLACK = 1;

/* ------------------------------------------------------------------ probes --- */

/** Horizontal overflow, plus the widest element sticking past the viewport. */
const OVERFLOW_PROBE = `
  var de = document.documentElement, b = document.body, vw = window.innerWidth;
  var worst = null;
  var nodes = document.querySelectorAll('body *');
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    var r = n.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.right - vw > 1) {
      var over = Math.round(r.right - vw);
      if (!worst || over > worst.over) {
        worst = {
          over: over,
          tag: n.tagName.toLowerCase(),
          cls: String(n.className == null ? '' : n.className).slice(0, 60),
          action: n.getAttribute('data-action') || '',
          text: String(n.textContent || '').trim().slice(0, 48),
          right: Math.round(r.right)
        };
      }
    }
  }
  return {
    doc: de.scrollWidth,
    body: b.scrollWidth,
    vw: vw,
    worst: worst
  };
`;

/** The bottom tab bar: geometry per item and of the bar itself. */
const TABBAR_PROBE = `
  var bar = document.getElementById('tabbar');
  if (!bar) return null;
  var cs = getComputedStyle(bar);
  var br = bar.getBoundingClientRect();
  var items = [];
  var nodes = bar.querySelectorAll('.tab');
  for (var i = 0; i < nodes.length; i++) {
    var t = nodes[i];
    var r = t.getBoundingClientRect();
    var label = t.querySelector('span:last-child');
    items.push({
      tab: t.getAttribute('data-tab'),
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      height: Math.round(r.height),
      labelOverflow: label ? label.scrollWidth - label.clientWidth : 0
    });
  }
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
    display: cs.display,
    visibility: cs.visibility,
    bar: {
      left: Math.round(br.left),
      right: Math.round(br.right),
      top: Math.round(br.top),
      bottom: Math.round(br.bottom),
      width: Math.round(br.width),
      height: Math.round(br.height)
    },
    items: items
  };
`;

/** Every button/chip currently on screen, with its measured height. */
const TAP_PROBE = `
  var out = [];
  var nodes = document.querySelectorAll('.btn, .chip');
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    var r = n.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    out.push({
      cls: String(n.className == null ? '' : n.className),
      action: n.getAttribute('data-action') || '',
      text: String(n.textContent || '').trim().slice(0, 30),
      h: Math.round(r.height * 10) / 10,
      w: Math.round(r.width)
    });
  }
  return out;
`;

/* ------------------------------------------------------------------- test --- */

module.exports = {
  name: 'Mobile layout & responsiveness',

  async run(suite, { base }) {
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/');
      await page.ready(EXPECTED_POOL);

      /* ---------------------------------------------------------- helpers -- */

      const setVp = (vp) => page.setViewport({ width: vp.w, height: vp.h, mobile: true });

      const okCheck = (label, cond, detail) => suite.check(label, cond, cond ? undefined : detail);

      /** Assert documentElement *and* body stay inside the viewport. */
      async function noOverflow(screen, vpName) {
        const m = await page.eval(OVERFLOW_PROBE);
        const detail = `docWidth=${m.doc} bodyWidth=${m.body} innerWidth=${m.vw} widestOverflow=${JSON.stringify(
          m.worst
        )}`;
        okCheck(
          `${screen} @ ${vpName}: documentElement has no horizontal overflow`,
          m.doc <= m.vw + SLACK,
          detail
        );
        okCheck(
          `${screen} @ ${vpName}: body has no horizontal overflow`,
          m.body <= m.vw + SLACK,
          detail
        );
      }

      /** Cheap tab-bar sanity check, run on every screen. */
      async function tabbarVisible(screen, vpName) {
        const m = await page.eval(TABBAR_PROBE);
        const six = m && m.items.length === 6 && m.items.every((t) => t.width > 0 && t.height > 0);
        const inside =
          !!m &&
          m.display !== 'none' &&
          m.visibility !== 'hidden' &&
          m.bar.left >= -SLACK &&
          m.bar.right <= m.vw + SLACK &&
          m.bar.top >= -SLACK &&
          m.bar.bottom <= m.vh + SLACK;
        okCheck(
          `${screen} @ ${vpName}: tab bar shows six items inside the viewport`,
          six && inside,
          `bar=${JSON.stringify(m && m.bar)} vw=${m && m.vw} vh=${m && m.vh} items=${JSON.stringify(
            m && m.items
          )}`
        );
      }

      /* -------------------------------------------------- navigation ------ */

      async function practiceHome() {
        await page.eval(
          'ui.screen = "home"; ui.session = null; ui.mock = null; ui.cheat = null; setTab("practice"); render();'
        );
      }

      async function practiceQuestion() {
        await practiceHome();
        await page.click('[data-action="start-cat"]', { index: 0 });
        await page.waitFor('ui.screen === "session" && ui.session && ui.session.items.length > 0', {
          label: 'practice question',
        });
      }

      async function mockHome() {
        await page.eval('ui.screen = "mock-home"; setTab("mock"); render();');
      }

      async function mockQuestion() {
        await mockHome();
        await page.click('[data-action="start-mock"]');
        await page.waitFor('ui.screen === "mock" && ui.mock && ui.mock.items.length === 24', {
          label: 'mock question',
        });
      }

      async function results() {
        const running = await page.eval(
          'return !!(ui.mock && !ui.mock.submitted && ui.mock.items && ui.mock.items.length);'
        );
        if (!running) await mockQuestion();
        await page.click('[data-action="submit-mock"]');
        await page.waitFor('ui.screen === "results" && ui.mock && ui.mock.result', {
          label: 'mock results',
        });
      }

      async function tabTo(tab) {
        await page.click(`.tab[data-tab="${tab}"]`);
        await page.waitFor(`ui.tab === ${JSON.stringify(tab)}`, { label: 'tab ' + tab });
      }

      async function cheatChooser() {
        await page.eval('ui.screen = "home"; ui.cheat = { ch: null }; setTab("cheat"); render();');
        await page.waitFor('ui.tab === "cheat" && !ui.cheat.ch', { label: 'cheat chooser' });
      }

      async function cheatChapter() {
        await page.eval('ui.screen = "home"; ui.cheat = { ch: "history" }; setTab("cheat"); render();');
        await page.waitFor('ui.tab === "cheat" && ui.cheat.ch === "history"', { label: 'cheat chapter' });
      }

      // what_is_uk carries the widest table in the notes (the 7-column
      // "Countries characteristics" one), so it is the worst case for width.
      async function cheatWideTable() {
        await page.eval('ui.screen = "home"; ui.cheat = { ch: "what_is_uk" }; setTab("cheat"); render();');
        await page.waitFor('ui.tab === "cheat" && ui.cheat.ch === "what_is_uk"', { label: 'cheat wide table' });
      }

      // The install panel is the one screen an Android and an iPhone user both
      // land on, so it has to fit the smallest phone too.
      async function installPanel() {
        await page.eval('ui.screen = "home"; setTab("practice"); render(); openInstallHelp();');
        await page.waitFor('!document.getElementById("installHelp").hidden', { label: 'install help' });
      }

      const SCREENS = [
        { name: 'practice home', go: practiceHome },
        { name: 'practice question', go: practiceQuestion },
        { name: 'mock home', go: mockHome },
        { name: 'mock question', go: mockQuestion },
        { name: 'results & review', go: results },
        { name: 'plan', go: () => tabTo('plan') },
        { name: 'stats', go: () => tabTo('stats') },
        { name: 'user', go: () => tabTo('user') },
        { name: 'cheat chooser', go: cheatChooser },
        { name: 'cheat chapter', go: cheatChapter },
        { name: 'cheat wide table', go: cheatWideTable },
        { name: 'install help', go: installPanel },
      ];

      /* =================================================================
       * 1. Every viewport: practice home stays inside the width
       * ================================================================= */
      await suite.group('Viewport sweep — practice home', async () => {
        await practiceHome();
        for (const vp of VIEWPORTS) {
          await setVp(vp);
          await noOverflow('practice home', vp.name);
          await tabbarVisible('practice home', vp.name);
        }
      });

      /* =================================================================
       * 2. Every screen, at the smallest and one mid viewport
       * ================================================================= */
      await suite.group('Every tab and screen @ 320 and 390', async () => {
        for (const s of SCREENS) {
          await s.go();
          for (const vp of SWEEP) {
            await setVp(vp);
            await noOverflow(s.name, vp.name);
            await tabbarVisible(s.name, vp.name);
          }
        }
      });

      /* =================================================================
       * 3. The bottom tab bar in detail, at every viewport
       * ================================================================= */
      await suite.group('Bottom tab bar', async () => {
        await practiceHome();
        for (const vp of VIEWPORTS) {
          await setVp(vp);
          const m = await page.eval(TABBAR_PROBE);
          const names = m.items.map((t) => t.tab);
          suite.check(
            `tab bar @ ${vp.name}: all six tabs present (practice, plan, mock, stats, cheat, user)`,
            JSON.stringify(names) === JSON.stringify(['practice', 'plan', 'mock', 'stats', 'cheat', 'user']),
            `got ${JSON.stringify(names)}`
          );
          okCheck(
            `tab bar @ ${vp.name}: every tab item is visible`,
            m.items.every((t) => t.width > 0 && t.height > 0),
            JSON.stringify(m.items)
          );
          okCheck(
            `tab bar @ ${vp.name}: no tab item is clipped horizontally`,
            m.items.every((t) => t.left >= -SLACK && t.right <= m.vw + SLACK),
            `vw=${m.vw} items=${JSON.stringify(m.items)}`
          );
          okCheck(
            `tab bar @ ${vp.name}: bar sits within the viewport`,
            m.bar.top >= -SLACK &&
              m.bar.bottom <= m.vh + SLACK &&
              m.bar.left >= -SLACK &&
              m.bar.right <= m.vw + SLACK,
            `bar=${JSON.stringify(m.bar)} vw=${m.vw} vh=${m.vh}`
          );
          okCheck(
            `tab bar @ ${vp.name}: bar is anchored to the bottom edge`,
            m.bar.bottom >= m.vh - 2,
            `bar.bottom=${m.bar.bottom} innerHeight=${m.vh}`
          );
          okCheck(
            `tab bar @ ${vp.name}: every tab label is fully shown`,
            m.items.every((t) => t.labelOverflow <= SLACK),
            JSON.stringify(m.items.map((t) => ({ tab: t.tab, over: t.labelOverflow })))
          );
          okCheck(
            `tab bar @ ${vp.name}: every tab item is at least 40px tall`,
            m.items.every((t) => t.height >= 40),
            JSON.stringify(m.items.map((t) => ({ tab: t.tab, h: t.height })))
          );
        }
      });

      /* =================================================================
       * 4. Tap targets >= 40px
       * ================================================================= */
      await suite.group('Tap targets', async () => {
        await setVp(SMALL);
        await practiceHome();
        let taps = await page.eval(TAP_PROBE);
        let btns = taps.filter((t) => /(^|\s)btn(\s|$)/.test(t.cls));
        let chips = taps.filter((t) => /(^|\s)chip(\s|$)/.test(t.cls));
        suite.check('practice home @ 320: found primary buttons to measure', btns.length >= 4, `n=${btns.length}`);
        suite.check('practice home @ 320: found filter chips to measure', chips.length >= 4, `n=${chips.length}`);
        okCheck(
          'practice home @ 320: every primary button is at least 40px tall',
          btns.every((b) => b.h >= 40),
          JSON.stringify(btns.filter((b) => b.h < 40))
        );
        okCheck(
          'practice home @ 320: every filter chip is at least 40px tall',
          chips.every((c) => c.h >= 40),
          JSON.stringify(chips.filter((c) => c.h < 40))
        );

        await practiceQuestion();
        taps = await page.eval(TAP_PROBE);
        btns = taps.filter((t) => /(^|\s)btn(\s|$)/.test(t.cls));
        suite.check('practice question @ 320: found the answer button', btns.length >= 1, `n=${btns.length}`);
        okCheck(
          'practice question @ 320: every primary button is at least 40px tall',
          btns.every((b) => b.h >= 40),
          JSON.stringify(btns.filter((b) => b.h < 40))
        );

        await mockQuestion();
        taps = await page.eval(TAP_PROBE);
        btns = taps.filter((t) => /(^|\s)btn(\s|$)/.test(t.cls));
        suite.check('mock question @ 320: found navigation/submit buttons', btns.length >= 3, `n=${btns.length}`);
        okCheck(
          'mock question @ 320: every primary button is at least 40px tall',
          btns.every((b) => b.h >= 40),
          JSON.stringify(btns.filter((b) => b.h < 40))
        );

        await tabTo('plan');
        taps = await page.eval(TAP_PROBE);
        okCheck(
          'plan @ 320: every button (incl. plan-go) is at least 40px tall',
          taps.every((b) => b.h >= 40),
          JSON.stringify(taps.filter((b) => b.h < 40))
        );
      });

      /* =================================================================
       * 5. Text is not clipped / truncated
       * ================================================================= */
      await suite.group('Text is not clipped', async () => {
        await setVp(SMALL);
        await practiceHome();
        const rows = await page.eval(`
          var out = [];
          var nodes = document.querySelectorAll('.cat-row');
          for (var i = 0; i < nodes.length; i++) {
            var r = nodes[i];
            var name = r.querySelector('.cat-name');
            var meta = r.querySelector('.cat-meta');
            out.push({
              name: name ? name.textContent : null,
              rowOverflow: r.scrollWidth - r.clientWidth,
              rowRight: Math.round(r.getBoundingClientRect().right),
              nameOverflow: name ? name.scrollWidth - name.clientWidth : 0,
              metaOverflow: meta ? meta.scrollWidth - meta.clientWidth : 0,
              nameLines: name ? Math.round(name.getBoundingClientRect().height / (parseFloat(getComputedStyle(name).lineHeight) || 1)) : 0
            });
          }
          return { rows: out, vw: window.innerWidth };
        `);
        suite.eq('practice home @ 320: five category rows rendered', rows.rows.length, 5);
        okCheck(
          'practice home @ 320: no category row overflows its box',
          rows.rows.every((r) => r.rowOverflow <= SLACK),
          JSON.stringify(rows.rows.filter((r) => r.rowOverflow > SLACK))
        );
        okCheck(
          'practice home @ 320: every category label is fully rendered',
          rows.rows.every((r) => r.nameOverflow <= SLACK && r.nameOverflow >= 0),
          JSON.stringify(rows.rows.filter((r) => r.nameOverflow > SLACK))
        );
        okCheck(
          'practice home @ 320: every category label has real content',
          rows.rows.every((r) => r.name && r.name.trim().length > 3),
          JSON.stringify(rows.rows.map((r) => r.name))
        );
        okCheck(
          'practice home @ 320: every category meta count is fully rendered',
          rows.rows.every((r) => r.metaOverflow <= SLACK && r.metaOverflow >= 0),
          JSON.stringify(rows.rows.map((r) => ({ name: r.name, over: r.metaOverflow })))
        );
        okCheck(
          'practice home @ 320: every category row stays inside the viewport',
          rows.rows.every((r) => r.rowRight <= rows.vw + SLACK),
          JSON.stringify(rows.rows.filter((r) => r.rowRight > rows.vw + SLACK))
        );

        await practiceQuestion();
        const q = await page.eval(`
          var t = document.querySelector('.q-text');
          var cs = getComputedStyle(t);
          var card = document.querySelector('#main .card');
          var opts = [];
          var onodes = document.querySelectorAll('.opt');
          for (var i = 0; i < onodes.length; i++) {
            var o = onodes[i];
            var span = o.querySelector('span:last-child');
            opts.push({
              boxOverflow: o.scrollWidth - o.clientWidth,
              textOverflow: span ? span.scrollWidth - span.clientWidth : 0
            });
          }
          return {
            textOverflowX: t.scrollWidth - t.clientWidth,
            textOverflowY: t.scrollHeight - t.clientHeight,
            whiteSpace: cs.whiteSpace,
            overflow: cs.overflow,
            cardOverflow: card.scrollWidth - card.clientWidth,
            optCount: opts.length,
            opts: opts,
            text: t.innerText.slice(0, 40)
          };
        `);
        suite.check('practice question @ 320: has question text', !!q.text, q.text);
        okCheck(
          'practice question @ 320: question text is not clipped horizontally',
          q.textOverflowX <= SLACK,
          `overflowX=${q.textOverflowX} whiteSpace=${q.whiteSpace} overflow=${q.overflow}`
        );
        okCheck(
          'practice question @ 320: question text is not clipped vertically',
          q.textOverflowY <= SLACK,
          `overflowY=${q.textOverflowY} text="${q.text}"`
        );
        okCheck(
          'practice question @ 320: the question card needs no horizontal scrolling',
          q.cardOverflow <= SLACK,
          `cardOverflow=${q.cardOverflow}`
        );
        suite.check('practice question @ 320: options are rendered', q.optCount >= 2, `n=${q.optCount}`);
        okCheck(
          'practice question @ 320: every option is fully readable',
          q.opts.every((o) => o.boxOverflow <= SLACK && o.textOverflow <= SLACK),
          JSON.stringify(q.opts)
        );
      });

      /* =================================================================
       * 6. The longest question in the pool, at 320px
       * ================================================================= */
      await suite.group('Longest content fits at 320px', async () => {
        // Measure every question with the real fonts and pick (a) the widest
        // question text and (b) the widest option among the "two"/"statement"
        // types the brief calls out. Both must still fit at 320px.
        const picks = await page.eval(`
          var c = document.createElement('canvas').getContext('2d');
          var longQuestion = null, wideOption = null;
          for (var i = 0; i < DATA.all.length; i++) {
            var q = DATA.all[i];
            c.font = '650 18px sans-serif';
            var qw = c.measureText(String(q.question || '')).width;
            var maxOpt = 0, maxOptText = '';
            for (var j = 0; j < q.options.length; j++) {
              c.font = '16px sans-serif';
              var ow = c.measureText(String(q.options[j])).width;
              if (ow > maxOpt) {
                maxOpt = ow;
                maxOptText = String(q.options[j]);
              }
            }
            var info = {
              id: q.id,
              type: q.type,
              qw: Math.round(qw),
              qLen: String(q.question || '').length,
              optW: Math.round(maxOpt),
              optLen: maxOptText.length,
              question: String(q.question).slice(0, 70)
            };
            if (!longQuestion || qw > longQuestion.qw) longQuestion = info;
            if ((q.type === 'two' || q.type === 'statement') && (!wideOption || maxOpt > wideOption.optW)) {
              wideOption = info;
            }
          }
          return { longQuestion: longQuestion, wideOption: wideOption };
        `);

        suite.note(
          `widest question text: ${picks.longQuestion.id} (${picks.longQuestion.type}, ${picks.longQuestion.qLen} chars, ${picks.longQuestion.qw}px unwrapped)`
        );
        suite.note(
          `widest option (two/statement): ${picks.wideOption.id} (${picks.wideOption.type}, ${picks.wideOption.optLen} chars, ${picks.wideOption.optW}px unwrapped)`
        );
        suite.check(
          'the pool has a question whose text needs wrapping at 320px',
          picks.longQuestion.qw > SMALL.w,
          JSON.stringify(picks.longQuestion)
        );
        suite.check(
          'the pool has a two/statement question with an option needing wrapping at 320px',
          !!picks.wideOption && picks.wideOption.optW > SMALL.w,
          JSON.stringify(picks.wideOption)
        );

        async function stress(label, id) {
          await page.eval(`startPractice({ ids: [${JSON.stringify(id)}], title: 'Long content' });`);
          await page.waitFor('ui.screen === "session" && ui.session.items.length === 1', { label });

          for (const vp of SWEEP) {
            await setVp(vp);
            await noOverflow(label, vp.name);
            const m = await page.eval(`
              var card = document.querySelector('#main .card');
              var t = document.querySelector('.q-text');
              var opts = [];
              var onodes = document.querySelectorAll('.opt');
              for (var i = 0; i < onodes.length; i++) {
                var o = onodes[i];
                var span = o.querySelector('span:last-child');
                opts.push({
                  boxOverflow: o.scrollWidth - o.clientWidth,
                  textOverflow: span ? span.scrollWidth - span.clientWidth : 0
                });
              }
              return {
                id: ui.session.items[0].id,
                type: ui.session.items[0].ref.type,
                cardOverflow: card.scrollWidth - card.clientWidth,
                cardRight: Math.round(card.getBoundingClientRect().right),
                vw: window.innerWidth,
                textOverflowX: t.scrollWidth - t.clientWidth,
                textOverflowY: t.scrollHeight - t.clientHeight,
                optCount: opts.length,
                opts: opts
              };
            `);
            suite.eq(`${label} @ ${vp.name}: the intended question is shown`, m.id, id);
            okCheck(
              `${label} @ ${vp.name}: card fits the viewport width`,
              m.cardOverflow <= SLACK && m.cardRight <= m.vw + SLACK,
              `cardOverflow=${m.cardOverflow} cardRight=${m.cardRight} vw=${m.vw}`
            );
            okCheck(
              `${label} @ ${vp.name}: question text is not clipped`,
              m.textOverflowX <= SLACK && m.textOverflowY <= SLACK,
              `x=${m.textOverflowX} y=${m.textOverflowY}`
            );
            okCheck(
              `${label} @ ${vp.name}: every option is fully readable`,
              m.opts.every((o) => o.boxOverflow <= SLACK && o.textOverflow <= SLACK),
              JSON.stringify(m.opts)
            );
          }

          // reveal the answer so the (long) feedback block is on screen too
          await setVp(SMALL);
          await page.eval('var it = ui.session.items[0]; it.selected = new Set(it.answer); render();');
          await page.click('[data-action="check"]');
          await page.waitFor('ui.session.items[0].revealed === true', { label: 'answer revealed' });
          await noOverflow(label + ' + feedback', SMALL.name);
          const fb = await page.eval(`
            var f = document.querySelector('.feedback');
            return f ? { overflowX: f.scrollWidth - f.clientWidth, len: f.innerText.length } : null;
          `);
          suite.check(`${label} + feedback @ 320: feedback is rendered`, !!fb && fb.len > 0, JSON.stringify(fb));
          okCheck(
            `${label} + feedback @ 320: feedback text is not clipped`,
            !!fb && fb.overflowX <= SLACK,
            JSON.stringify(fb)
          );
        }

        await stress('longest question text', picks.longQuestion.id);
        await stress('widest option', picks.wideOption.id);
      });

      /* =================================================================
       * 7. Dark mode
       * ================================================================= */
      await suite.group('Dark mode', async () => {
        await page.eval(
          'ui.screen = "home"; ui.session = null; ui.mock = null; ui.cheat = null; setTab("practice"); render();'
        );
        await setVp(SMALL);
        const lightBg = await page.eval('return getComputedStyle(document.body).backgroundColor;');
        const lightSurface = await page.eval(
          'return getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();'
        );

        await page.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-color-scheme', value: 'dark' }],
        });
        await page.goto(base + '/');
        await page.ready(EXPECTED_POOL);

        const darkBg = await page.eval('return getComputedStyle(document.body).backgroundColor;');
        const darkSurface = await page.eval(
          'return getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();'
        );
        const rendered = await page.eval(
          'return !!(DATA.all.length >= 577 && document.querySelector("#main .card") && document.querySelectorAll(".tab").length === 6);'
        );

        suite.check('dark mode: the app still renders after reload', rendered);
        suite.eq('dark mode: the pool still loads', await page.eval('return DATA.all.length'), EXPECTED_POOL);
        suite.check(
          'dark mode: body background differs from light mode',
          !!darkBg && darkBg !== lightBg,
          `light=${lightBg} dark=${darkBg}`
        );
        suite.check(
          'dark mode: --surface token differs from light mode',
          !!darkSurface && darkSurface !== lightSurface,
          `light=${lightSurface} dark=${darkSurface}`
        );

        await noOverflow('practice home', 'dark ' + SMALL.name);
        await tabbarVisible('practice home', 'dark ' + SMALL.name);

        // back to light for the remaining checks
        await page.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-color-scheme', value: 'light' }],
        });
      });

      /* =================================================================
       * 8. Landscape on a question screen
       * ================================================================= */
      await suite.group('Landscape question screen', async () => {
        await practiceQuestion();
        await page.send('Emulation.setDeviceMetricsOverride', {
          width: 844,
          height: 390,
          deviceScaleFactor: 1,
          mobile: true,
          screenOrientation: { type: 'landscapePrimary', angle: 90 },
        });
        await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });

        const m = await page.eval(OVERFLOW_PROBE);
        okCheck(
          'practice question @ 844x390 landscape: documentElement has no horizontal overflow',
          m.doc <= m.vw + SLACK,
          `docWidth=${m.doc} innerWidth=${m.vw} widestOverflow=${JSON.stringify(m.worst)}`
        );
        okCheck(
          'practice question @ 844x390 landscape: body has no horizontal overflow',
          m.body <= m.vw + SLACK,
          `bodyWidth=${m.body} innerWidth=${m.vw} widestOverflow=${JSON.stringify(m.worst)}`
        );

        const tab = await page.eval(TABBAR_PROBE);
        okCheck(
          'practice question @ 844x390 landscape: six tab items are visible',
          tab.items.length === 6 && tab.items.every((t) => t.width > 0 && t.height > 0),
          JSON.stringify(tab.items)
        );
        okCheck(
          'practice question @ 844x390 landscape: tab bar sits within the viewport',
          tab.bar.top >= -SLACK &&
            tab.bar.bottom <= tab.vh + SLACK &&
            tab.bar.left >= -SLACK &&
            tab.bar.right <= tab.vw + SLACK,
          `bar=${JSON.stringify(tab.bar)} vw=${tab.vw} vh=${tab.vh}`
        );

        const card = await page.eval(`
          var c = document.querySelector('#main .card');
          var t = document.querySelector('.q-text');
          return {
            cardOverflow: c.scrollWidth - c.clientWidth,
            textOverflow: t.scrollWidth - t.clientWidth
          };
        `);
        okCheck(
          'practice question @ 844x390 landscape: the question card fits',
          card.cardOverflow <= SLACK && card.textOverflow <= SLACK,
          JSON.stringify(card)
        );

        // back to portrait for good measure
        await page.send('Emulation.setDeviceMetricsOverride', {
          width: 390,
          height: 844,
          deviceScaleFactor: 1,
          mobile: true,
          screenOrientation: { type: 'portraitPrimary', angle: 0 },
        });
      });

      /* =================================================================
       * 9. Nothing blew up along the way
       * ================================================================= */
      await suite.group('No client-side errors', async () => {
        const problems = page.problems();
        suite.check(
          'no console errors or failed requests during the mobile run',
          problems.length === 0,
          problems.join(' | ')
        );
      });

      await page.close();
    } finally {
      await browser.close();
    }
  },
};
