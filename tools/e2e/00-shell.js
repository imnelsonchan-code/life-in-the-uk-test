'use strict';

/**
 * Smoke test: does the app boot, load the whole pool, and wire up its shell?
 *
 * This is the cheapest test in the suite and should always pass. If it fails,
 * every other scenario will fail too.
 */

const { launch } = require('../harness');

const EXPECTED_POOL = 716;
const EXPECTED_NEW = 139;
const TABS = ['practice', 'plan', 'mock', 'stats', 'cheat', 'user'];

module.exports = {
  name: 'App shell & data load',

  async run(suite, { base }) {
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/');
      await page.ready(EXPECTED_POOL);

      await suite.group('Page and pool', async () => {
        suite.check('has a title', !!(await page.eval('return document.title')), await page.eval('return document.title'));
        suite.eq('pool size', await page.eval('return DATA.all.length'), EXPECTED_POOL);
        suite.eq(
          'every question has a category bucket',
          await page.eval(
            'return DATA.all.every(function(q){ return Array.isArray(DATA.byCat[q.category]); })'
          ),
          true
        );
        suite.eq(
          'byId covers the whole pool',
          await page.eval('return Object.keys(DATA.byId).length'),
          EXPECTED_POOL
        );
        suite.eq(
          'manifest matches the loaded pool',
          await page.eval(
            'return DATA.base.length === DATA.all.length'
          ),
          true
        );
      });

      await suite.group('Mobile shell', async () => {
        suite.check(
          'viewport meta is present',
          await page.eval('var m=document.querySelector("meta[name=viewport]"); return !!m;')
        );
        suite.eq(
          'declares six tabs',
          await page.eval('return document.querySelectorAll(".tab[data-tab]").length'),
          6
        );
        for (const t of TABS) {
          suite.check(`tab exists: ${t}`, await page.exists(`.tab[data-tab="${t}"]`));
        }
        suite.eq(
          'exactly one tab starts active',
          await page.eval('return document.querySelectorAll(".tab.is-active").length'),
          1
        );
      });

      await suite.group('Practice home', async () => {
        suite.eq(
          'five category rows',
          await page.eval('return document.querySelectorAll(\'[data-action="start-cat"]\').length'),
          5
        );
        const rows = await page.eval(
          'return [...document.querySelectorAll(\'[data-action="start-cat"]\')].map(function(r){ return r.dataset.cat; });'
        );
        const want = await page.eval('return Object.keys(DATA.byCat)');
        suite.check(
          'category rows match the data',
          JSON.stringify(rows.slice().sort()) === JSON.stringify(want.slice().sort()),
          `rows=${JSON.stringify(rows)} data=${JSON.stringify(want)}`
        );
      });

      await suite.group('New-questions section', async () => {
        suite.eq('new-batch size', await page.eval('return DATA.batchNew.length'), EXPECTED_NEW);
        suite.check(
          'section heading is rendered',
          await page.eval('return [...document.querySelectorAll("h2.section")].some(function(h){return h.textContent==="New questions";})')
        );
        suite.eq(
          'practise-new button shows the count',
          await page.eval('var b=document.querySelector(\'[data-action="start-new"]\'); return b ? b.innerText.trim() : null;'),
          `✨ Practise new (${EXPECTED_NEW})`
        );
      });

      await suite.group('Back button visibility', async () => {
        // The back chevron must only appear where there is something to go back to.
        // (CSS note: .icon-btn sets `display`, which would beat the UA [hidden] rule.)
        const backVisible = () =>
          page.eval(
            `var b = document.getElementById("backBtn");
             return !b.hidden && getComputedStyle(b).display !== "none" && b.offsetWidth > 0;`
          );

        await page.click('.tab[data-tab="practice"]');
        await page.waitFor('ui.tab === "practice" && ui.screen === "home"', { label: 'practice home' });
        suite.eq('hidden on the practice home', await backVisible(), false);

        await page.click('[data-action="start-cat"]', { index: 0 });
        await page.waitFor('ui.screen === "session"', { label: 'practice session' });
        suite.eq('shown inside a session', await backVisible(), true);

        await page.click('#backBtn');
        await page.waitFor('ui.screen === "home"', { label: 'back to home' });
        suite.eq('and hidden again once back home', await backVisible(), false);

        await page.click('.tab[data-tab="user"]');
        await page.waitFor('ui.tab === "user"', { label: 'user tab' });
        suite.eq('hidden on the user tab', await backVisible(), false);
      });

      await suite.group('GitHub link', async () => {
        const REPO = 'https://github.com/imnelsonchan-code/life-in-the-uk-test';
        suite.check('header star button exists', await page.exists('#ghBtn'));
        suite.eq(
          'header button points at the repo',
          await page.eval('return document.getElementById("ghBtn").href'),
          REPO
        );
        suite.check(
          'header button opens in a new tab, safely',
          await page.eval(
            'var b=document.getElementById("ghBtn"); return b.target === "_blank" && /noopener/.test(b.rel);'
          )
        );
        // It must live outside the dynamic slot, so screen renders never wipe it.
        suite.eq(
          'header button is not inside the dynamic slot',
          await page.eval(
            'return document.getElementById("headerExtra").contains(document.getElementById("ghBtn"));'
          ),
          false
        );
        suite.check(
          'header button has an icon',
          await page.eval('return !!document.querySelector("#ghBtn .gh-ico svg");')
        );

        await page.click('.tab[data-tab="practice"]');
        await page.waitFor('ui.tab === "practice" && ui.screen === "home"', { label: 'practice home' });
        suite.check('home has a GitHub tile', await page.exists('#ghTile'));
        suite.eq(
          'tile points at the repo',
          await page.eval('return document.getElementById("ghTile").href'),
          REPO
        );
        suite.check(
          'tile opens in a new tab, safely',
          await page.eval(
            'var a=document.getElementById("ghTile"); return a.target === "_blank" && /noopener/.test(a.rel);'
          )
        );
        suite.check(
          'tile shows a star label',
          await page.eval(
            'var s=document.getElementById("ghTileStars"); return !!s && /star/i.test(s.textContent);'
          ),
          await page.eval('var s=document.getElementById("ghTileStars"); return s ? s.textContent : null;')
        );
      });

      await suite.group('Install to the home screen', async () => {
        // The button lives in the header permanent area, so a render never
        // clears it, and it starts hidden until app.js decides it is useful.
        suite.check('header install button exists', await page.exists('#installBtn'));
        suite.eq(
          'install button is not inside the dynamic slot',
          await page.eval(
            'return document.getElementById("headerExtra").contains(document.getElementById("installBtn"));'
          ),
          false
        );
        suite.check(
          'install button is offered once the app has booted',
          await page.eval('return !document.getElementById("installBtn").hidden;')
        );
        suite.eq(
          'install button has an accessible name',
          await page.eval('return document.getElementById("installBtn").getAttribute("aria-label")'),
          'Add this app to your home screen'
        );
        suite.check(
          'install button has an icon',
          await page.eval('return !!document.querySelector("#installBtn svg");')
        );

        // No captured prompt (iOS Safari and Firefox never offer one): the click
        // must open the step-by-step panel rather than a toast that is gone
        // before the user has finished hunting through the Share sheet.
        await page.eval('INSTALL.prompt = null; return true;');
        suite.check(
          'the install help panel starts hidden',
          await page.eval('return document.getElementById("installHelp").hidden;')
        );
        await page.click('#installBtn');
        suite.check(
          'clicking it with no prompt opens the help panel',
          await page.eval('return !document.getElementById("installHelp").hidden;')
        );
        suite.check(
          'the panel is a labelled dialog',
          await page.eval(
            'var d = document.querySelector("#installHelp .sheet");' +
              'return d.getAttribute("role") === "dialog" && d.getAttribute("aria-modal") === "true" &&' +
              ' !!document.getElementById(d.getAttribute("aria-labelledby")).textContent;'
          )
        );
        suite.check(
          'the panel lists the install steps',
          await page.eval('return document.querySelectorAll("#installHelp .sheet-steps li").length >= 3;')
        );
        suite.check(
          'the steps name the home screen',
          await page.eval('return /home screen/i.test(document.getElementById("installHelpBody").innerText);')
        );
        suite.check(
          'the panel has a way out',
          await page.eval('return !!document.getElementById("installHelpClose");')
        );

        // It must outlive a render and stay until dismissed.
        await page.eval('render(); return true;');
        suite.check(
          'a re-render leaves the panel up',
          await page.eval('return !document.getElementById("installHelp").hidden;')
        );
        await page.eval('document.getElementById("installHelpClose").click(); return true;');
        suite.check(
          'the button closes it',
          await page.eval('return document.getElementById("installHelp").hidden;')
        );
        await page.click('#installBtn');
        await page.eval('document.getElementById("installHelp").click(); return true;');
        suite.check(
          'tapping outside closes it too',
          await page.eval('return document.getElementById("installHelp").hidden;')
        );
        await page.eval('INSTALL.prompt = null; return true;');
        await page.click('#installBtn');
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        suite.check(
          'and Escape closes it',
          await page.eval('return document.getElementById("installHelp").hidden;')
        );

        // On an iPhone the panel has to name the Safari route, and the Share
        // list's own "Add to Home Screen" toggle (the usual reason it "does not
        // work"), and it has to say when the browser cannot do it at all.
        const IPHONE_UA =
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 ' +
          '(KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
        const IPHONE_CHROME_UA =
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 ' +
          '(KHTML, like Gecko) CriOS/140.0.7339.100 Mobile/15E148 Safari/604.1';

        await page.send('Emulation.setUserAgentOverride', {
          userAgent: IPHONE_UA,
          platform: 'iPhone',
        });
        await page.goto(base + '/');
        await page.ready(EXPECTED_POOL);
        await page.eval('INSTALL.prompt = null; return true;');
        await page.click('#installBtn');
        const iosBody = await page.eval('return document.getElementById("installHelpBody").innerText;');
        suite.check(
          'iPhone: the panel is shown',
          await page.eval('return !document.getElementById("installHelp").hidden;')
        );
        suite.check('iPhone: it names the Share sheet', /share/i.test(iosBody), iosBody);
        suite.check('iPhone: it names Add to Home Screen', /add to home screen/i.test(iosBody), iosBody);
        suite.check('iPhone: it mentions Edit Actions', /edit actions/i.test(iosBody), iosBody);
        suite.check('iPhone: it names Safari', /safari/i.test(iosBody), iosBody);
        suite.check('iPhone: it does not talk about browser menus', !/browser menu/i.test(iosBody), iosBody);
        await page.eval('closeInstallHelp(); return true;');

        await page.send('Emulation.setUserAgentOverride', {
          userAgent: IPHONE_CHROME_UA,
          platform: 'iPhone',
        });
        await page.goto(base + '/');
        await page.ready(EXPECTED_POOL);
        await page.eval('INSTALL.prompt = null; return true;');
        await page.click('#installBtn');
        const chromeBody = await page.eval('return document.getElementById("installHelpBody").innerText;');
        suite.check('iPhone Chrome: it names the browser in use', /Chrome/.test(chromeBody), chromeBody);
        suite.check('iPhone Chrome: and sends the user to Safari', /Safari/i.test(chromeBody), chromeBody);
        await page.eval('closeInstallHelp(); return true;');

        await page.send('Emulation.setUserAgentOverride', { userAgent: '' });
        await page.goto(base + '/');
        await page.ready(EXPECTED_POOL);
        await page.eval('INSTALL.prompt = null; return true;');
        await page.click('#installBtn');
        suite.check(
          'back on a desktop browser the panel is up again',
          await page.eval('return !document.getElementById("installHelp").hidden;')
        );
        suite.check(
          'and it talks about the browser menu, not about Safari',
          await page.eval(
            'return /browser menu/i.test(document.getElementById("installHelpBody").innerText);'
          ),
          await page.eval('return document.getElementById("installHelpBody").innerText;')
        );
        await page.eval('closeInstallHelp(); return true;');

        /* ------------------------------------------------------------ Android ---
         * Android offers the same function as the iPhone: the button is in the
         * header, Chrome's own install prompt is used when it is available, and
         * otherwise the panel has to give the right menu route for the browser
         * the person is actually holding (Chrome, Samsung Internet, Firefox).
         */
        const ANDROID_CHROME =
          'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/140.0.0.0 Mobile Safari/537.36';
        const ANDROID_SAMSUNG =
          'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36';
        const ANDROID_FIREFOX =
          'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0';

        const asAndroid = async (ua, label, want, notWant) => {
          await page.send('Emulation.setUserAgentOverride', { userAgent: ua, platform: 'Linux armv8l' });
          await page.goto(base + '/');
          await page.ready(EXPECTED_POOL);
          suite.check(
            `${label}: the install button is offered`,
            await page.eval('return !document.getElementById("installBtn").hidden;')
          );
          suite.check(
            `${label}: the app is not treated as iOS`,
            await page.eval('return isIos() === false && isStandalone() === false;')
          );
          await page.eval('INSTALL.prompt = null; return true;');
          await page.click('#installBtn');
          const body = await page.eval('return document.getElementById("installHelpBody").innerText;');
          suite.check(`${label}: the panel names ${want}`, new RegExp(want, 'i').test(body), body);
          if (notWant) {
            suite.check(`${label}: and never mentions ${notWant}`, !new RegExp(notWant, 'i').test(body), body);
          }
          await page.eval('closeInstallHelp(); return true;');
        };

        await asAndroid(ANDROID_CHROME, 'android chrome', 'Install app', 'Safari');
        await asAndroid(ANDROID_SAMSUNG, 'android samsung internet', 'Home screen', 'Safari');
        await asAndroid(ANDROID_FIREFOX, 'android firefox', 'Install', 'Safari');

        // Android Chrome with a captured prompt must spend it, exactly as on
        // desktop — the native prompt is the whole point of the feature there.
        await page.send('Emulation.setUserAgentOverride', {
          userAgent: ANDROID_CHROME,
          platform: 'Linux armv8l',
        });
        await page.goto(base + '/');
        await page.ready(EXPECTED_POOL);
        await page.eval(
          'window.__prompted = 0;' +
            'INSTALL.prompt = {' +
            '  prompt: function(){ window.__prompted++; },' +
            '  userChoice: Promise.resolve({ outcome: "accepted" })' +
            '};' +
            'return true;'
        );
        await page.click('#installBtn');
        suite.check(
          'android chrome: the native install prompt is used',
          await page.eval('return window.__prompted === 1;')
        );
        await page.waitFor('INSTALL.done === true');
        suite.check(
          'android chrome: and the button retires afterwards',
          await page.eval('return document.getElementById("installBtn").hidden;')
        );

        // Back to the default user agent for the rest of the file.
        await page.send('Emulation.setUserAgentOverride', { userAgent: '' });
        await page.goto(base + '/');
        await page.ready(EXPECTED_POOL);

        // A prompt the browser refuses (no user gesture) is a rejected promise,
        // not a thrown error: the panel must take over, and nothing may be left
        // as an unhandled rejection.
        await page.eval(
          'INSTALL.prompt = {' +
            '  prompt: function(){ return Promise.reject(new Error("no user gesture")); },' +
            '  userChoice: new Promise(function(){})' + // never settles: the prompt was refused
            '};' +
            'return true;'
        );
        await page.click('#installBtn');
        await page.waitFor('!document.getElementById("installHelp").hidden', { label: 'refused prompt fallback' });
        suite.check(
          'a refused prompt opens the panel instead',
          await page.eval('return !document.getElementById("installHelp").hidden;')
        );
        await page.eval('closeInstallHelp(); INSTALL.prompt = null; return true;');

        // With a prompt captured, the click must spend it and retire the button.
        // (A synthetic element.click() carries no user gesture, so the app has to
        // survive prompt() refusing the call — the catch path above.)
        await page.eval(
          'window.__prompted = 0;' +
            'INSTALL.prompt = {' +
            '  prompt: function(){ window.__prompted++; },' +
            '  userChoice: Promise.resolve({ outcome: "accepted" })' +
            '};' +
            'return true;'
        );
        await page.click('#installBtn');
        suite.check('a captured install prompt is used', await page.eval('return window.__prompted === 1;'));
        await page.waitFor('INSTALL.done === true');
        suite.check(
          'the button retires once the app is installed',
          await page.eval('return document.getElementById("installBtn").hidden;')
        );
        suite.check(
          'and the app says so',
          await page.eval(
            'return /Installed/.test(document.getElementById("toast").textContent);'
          ),
          await page.eval('return document.getElementById("toast").textContent;')
        );

        const manifest = await page.eval(
          "return fetch('manifest.webmanifest').then(function(r){ return r.ok ? r.json() : null; });"
        );
        suite.check('the manifest is served as JSON', !!manifest, JSON.stringify(manifest));
        if (manifest) {
          suite.check('manifest names the app', !!manifest.name && !!manifest.short_name);
          suite.eq('manifest opens standalone', manifest.display, 'standalone');
          suite.check(
            'manifest starts and scopes inside the app',
            /^\.?\/?$/.test(manifest.start_url) || /^\.\//.test(manifest.start_url),
            manifest.start_url
          );
          suite.check('manifest sets a theme colour', !!manifest.theme_color, manifest.theme_color);
          const sizes = (manifest.icons || []).map((i) => i.sizes);
          suite.check('manifest has a 192 icon', sizes.indexOf('192x192') >= 0, sizes.join(','));
          suite.check('manifest has a 512 icon', sizes.indexOf('512x512') >= 0, sizes.join(','));
          suite.check(
            'manifest has a maskable icon',
            (manifest.icons || []).some((i) => /maskable/.test(i.purpose || ''))
          );
          suite.check(
            'every icon the manifest names is served',
            await page.eval(
              "return fetch('manifest.webmanifest').then(function(r){ return r.json(); }).then(function(m){ return Promise.all(m.icons.map(function(i){ return fetch(i.src).then(function(r){ return r.ok; }); })); }).then(function(oks){ return oks.length > 0 && oks.every(Boolean); });"
            )
          );
        }

        suite.eq(
          'the page links that manifest',
          await page.eval(
            "var l=document.querySelector('link[rel=manifest]'); return l ? l.getAttribute('href').replace(/\\?.*$/, '') : null;"
          ),
          'manifest.webmanifest'
        );
        suite.eq(
          'iOS gets an apple-touch-icon',
          await page.eval(
            "var l=document.querySelector('link[rel=apple-touch-icon]'); return l ? l.getAttribute('href') : null;"
          ),
          'icons/apple-touch-icon.png'
        );
        suite.eq(
          'the browser tab gets a vector icon',
          await page.eval(
            "var l=document.querySelector('link[rel=icon]'); return l ? l.getAttribute('type') : null;"
          ),
          'image/svg+xml'
        );

        const sw = await page.eval(
          "return fetch('sw.js').then(function(r){ return r.ok ? r.text() : null; });"
        );
        suite.check('the service worker is served', !!sw);
        if (sw) {
          suite.check(
            'the service worker caches and answers fetches',
            /addEventListener\('fetch'/.test(sw) && /caches\s*\.\s*open/.test(sw)
          );
          suite.eq(
            'the service worker stays out of cross-origin requests',
            /url\.origin !== self\.location\.origin/.test(sw),
            true
          );
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
