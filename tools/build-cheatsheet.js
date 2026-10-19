#!/usr/bin/env node
/**
 * Build the cheat-sheet data the app renders.
 *
 * Source:  Cheat_Sheet.md (repo root) — revision notes split by handbook chapter,
 *          with a "## Chapter N — Title" heading per chapter and the study
 *          sub-headings inside it.
 * Output:  app/data/cheatsheet.json — chapters in pool order, each with its
 *          sections as blocks (paragraphs, nested lists, tables, quotes), with
 *          inline **bold** / *italic* turned into HTML at build time.
 *
 * Chapter numbers are paired with the pool's own category order (index.json), so
 * the cheat sheet and the questions can never drift apart.
 *
 * Usage:   node tools/build-cheatsheet.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'Cheat_Sheet.md');
const INDEX = path.join(ROOT, 'app', 'data', 'questions', 'index.json');
const OUT = path.join(ROOT, 'app', 'data', 'cheatsheet.json');

/* ------------------------------------------------------------------ inline --- */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Escape, then apply the two inline marks the notes actually use. */
function inline(text) {
  let s = esc(String(text).trim());
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Drop the _underscore_ emphasis the notes used to flag unchecked rows.
  s = s.replace(/_([^_]+)_/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}

/* ------------------------------------------------------------------ blocks --- */

const isTableRow = (l) => /^\s*\|/.test(l);
const isSep = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
const isBullet = (l) => /^\s*\*\s+/.test(l);
const isQuote = (l) => /^\s*>/.test(l);
const isRule = (l) => /^\s*([-*=_])\1{2,}\s*$/.test(l);

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** Turn a run of lines into blocks. */
function blocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim() || isRule(line)) {
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(line).map(inline);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        const c = cells(lines[i]);
        // A row shorter than the header is padded so the table stays square.
        while (c.length < head.length) c.push('');
        rows.push(c.map(inline));
        i++;
      }
      out.push({ t: 'table', head, rows });
      continue;
    }

    if (isBullet(line)) {
      const items = [];
      while (i < lines.length && isBullet(lines[i])) {
        const indented = /^\s{2,}\*\s+/.test(lines[i]);
        const text = inline(lines[i].replace(/^\s*\*\s+/, ''));
        if (indented && items.length) {
          const last = items[items.length - 1];
          last.sub = last.sub || [];
          last.sub.push(text);
        } else {
          items.push({ html: text, sub: [] });
        }
        i++;
      }
      out.push({ t: 'ul', items });
      continue;
    }

    if (isQuote(line)) {
      const paras = [];
      let cur = [];
      while (i < lines.length && isQuote(lines[i])) {
        const text = lines[i].replace(/^\s*>\s?/, '').trim();
        if (!text) {
          if (cur.length) paras.push(cur);
          cur = [];
        } else {
          cur.push(inline(text));
        }
        i++;
      }
      if (cur.length) paras.push(cur);
      out.push({ t: 'quote', paras });
      continue;
    }

    // Paragraph: until a blank line or the start of another block type.
    const para = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isTableRow(lines[i]) &&
      !isBullet(lines[i]) &&
      !isQuote(lines[i]) &&
      !isRule(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    out.push({ t: 'p', html: inline(para.join(' ')) });
  }
  return out;
}

/* ---------------------------------------------------------------- chapters --- */

/** Short labels for the chapter chips in the app (the pool names are long). */
const CHIP = {
  values_principles: 'Values',
  what_is_uk: 'What is the UK?',
  history: 'History',
  modern_society: 'Society',
  government_law: 'Government',
};

/* ------------------------------------------ static page & AI text files --- */

/* The app itself is a JavaScript shell: a crawler that does not run scripts
 * sees an empty page, and most AI crawlers do not run scripts at all. These two
 * files are the same notes in forms a machine can read without any JavaScript:
 * notes.html for search engines, llms-full.txt for AI agents. Both are built
 * from Cheat_Sheet.md, and both carry its hash so a stale build is obvious. */

const APP = path.join(ROOT, 'app');
const SITE = 'https://imnelsonchan-code.github.io/life-in-the-uk-test';

/* One cache-busting stamp for the whole site: the one already on app/index.html.
 * The deploy rewrites that to the commit SHA, and the static pages follow it. */
const STAMP =
  (/[?&]v=([^"'&\s]+)/.exec(fs.readFileSync(path.join(APP, 'index.html'), 'utf8')) || [])[1] || 'dev';

function blockHtml(b) {
  if (b.t === 'p') return `<p>${b.html}</p>`;
  if (b.t === 'quote') {
    return `<blockquote>${b.paras.map((p) => `<p>${p.join('<br>')}</p>`).join('')}</blockquote>`;
  }
  if (b.t === 'ul') {
    return `<ul>${b.items
      .map(
        (it) =>
          `<li>${it.html}${
            it.sub && it.sub.length ? `<ul>${it.sub.map((s) => `<li>${s}</li>`).join('')}</ul>` : ''
          }</li>`
      )
      .join('')}</ul>`;
  }
  if (b.t === 'table') {
    return `<div class="tw"><table>
          <thead><tr>${b.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${b.rows
            .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
            .join('')}</tbody>
        </table></div>`;
  }
  return '';
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function notesPage(doc) {
  const toc = doc.chapters
    .map(
      (c) =>
        `<li><a href="#ch-${c.ch}">${c.ch}. ${esc(c.name)}</a> <span class="count">${c.sections.length} section${c.sections.length === 1 ? '' : 's'}</span></li>`
    )
    .join('\n        ');

  const body = doc.chapters
    .map((c) => {
      const sections = c.sections
        .map(
          (s) => `<h3 id="ch-${c.ch}-${slug(s.title)}">${esc(s.title)}</h3>
        ${s.blocks.map(blockHtml).join('\n        ')}`
        )
        .join('\n\n      ');
      return `<section id="ch-${c.ch}">
      <h2>Chapter ${c.ch} — ${esc(c.name)}</h2>
      ${sections}
    </section>`;
    })
    .join('\n\n    ');

  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Life in the UK Test notes — every fact, by chapter</title>
    <meta
      name="description"
      content="Revision notes for the Life in the UK Test, chapter by chapter: values and principles, what the UK is, history, modern society, government and law. Facts current to 2026."
    />
    <link rel="canonical" href="${SITE}/notes.html" />
    <meta name="robots" content="index,follow" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="Life in the UK Test notes — every fact, by chapter" />
    <meta
      property="og:description"
      content="Revision notes for the Life in the UK Test, chapter by chapter. Facts current to 2026."
    />
    <meta property="og:url" content="${SITE}/notes.html" />
    <meta property="og:image" content="${SITE}/icons/og.png" />
    <link rel="icon" href="icons/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png" />
    <link rel="stylesheet" href="css/doc.css?v=${STAMP}" />
  </head>
  <body>
    <!-- source-hash: ${doc.sourceHash} -->
    <header class="site">
      <a class="back" href="./">← Life in the UK · practice app</a>
      <nav><a href="guide.html">Study guide</a> · <a href="./">Practise</a></nav>
    </header>

    <main class="doc">
      <h1>Life in the UK Test — revision notes</h1>
      <p class="lede">
        Every fact behind the 716 practice questions, written out chapter by
        chapter — the same notes as the cheat sheet in the app, on one page you
        can read, search and print.
      </p>
      <p class="muted">
        These notes follow the five chapters of the official handbook, in the same
        order as the question pool. They are the author's own summaries, not a copy
        of the handbook. Where the 3rd edition (2013) has been overtaken, the current
        figure is given with the handbook's in brackets.
      </p>

      <h2 class="plain">Chapters</h2>
      <ul class="toc">
        ${toc}
      </ul>

      ${body}
    </main>

    <footer class="site">
      <p>
        An independent study aid — not affiliated with GOV.UK or the official
        handbook. Check the current rules on
        <a href="https://www.gov.uk/life-in-the-uk-test" rel="noopener">GOV.UK</a>.
      </p>
      <p><a href="./">Practise the questions</a> · <a href="guide.html">Study guide</a></p>
    </footer>
  </body>
</html>
`;
}

function llmsFull(doc, md) {
  return `# Life in the UK Test — revision notes (full text)

Source: ${SITE}/notes.html
Author: an independent study aid, not affiliated with GOV.UK. Questions and
notes are original, written from public facts.
Facts are current to 2026; where the 3rd-edition handbook (2013) has been
overtaken, the current figure is given and the handbook's is noted in brackets.

<!-- source-hash: ${doc.sourceHash} -->

---

${md.trim()}
`;
}

function main() {
  const md = fs.readFileSync(SRC, 'utf8');
  const cats = JSON.parse(fs.readFileSync(INDEX, 'utf8')).categories;

  const chapters = [];
  let chapter = null;
  let section = null;
  let buf = [];

  const flushSection = () => {
    if (chapter && section) {
      const b = blocks(buf);
      if (b.length) chapter.sections.push({ title: section, blocks: b });
      else throw new Error(`section has no content: ${section}`);
    }
    buf = [];
  };

  for (const raw of md.split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(raw);
    const h3 = /^###\s+(.+?)\s*$/.exec(raw);
    if (h2) {
      flushSection();
      section = null;
      const m = /^Chapter\s+(\d+)\s*[—–-]\s*(.+)$/.exec(h2[1].replace(/#+\s*$/, ''));
      if (!m) throw new Error(`chapter heading must read "## Chapter N — Title": ${raw}`);
      const n = Number(m[1]);
      const cat = cats[n - 1];
      if (!cat) throw new Error(`no pool category for chapter ${n}`);
      chapter = { id: cat.id, ch: n, name: cat.name, chip: CHIP[cat.id] || cat.name, short: m[2].trim(), sections: [] };
      chapters.push(chapter);
      continue;
    }
    if (h3) {
      flushSection();
      section = h3[1].replace(/#+\s*$/, '').trim();
      continue;
    }
    if (chapter && section) buf.push(raw);
  }
  flushSection();

  if (chapters.length !== cats.length) {
    throw new Error(`expected ${cats.length} chapters, found ${chapters.length}`);
  }
  for (const c of chapters) {
    if (!c.sections.length) throw new Error(`chapter ${c.ch} has no sections`);
  }

  const doc = {
    generatedAt: new Date().toISOString(),
    source: 'Cheat_Sheet.md',
    sourceHash: require('crypto').createHash('sha256').update(md).digest('hex').slice(0, 16),
    chapters,
  };
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
  fs.writeFileSync(path.join(APP, 'notes.html'), notesPage(doc));
  fs.writeFileSync(path.join(APP, 'llms-full.txt'), llmsFull(doc, md));

  let sections = 0;
  let items = 0;
  for (const c of chapters) {
    sections += c.sections.length;
    const count = c.sections.reduce(
      (a, s) => a + s.blocks.reduce((b, bl) => b + (bl.t === 'table' ? bl.rows.length : bl.t === 'ul' ? bl.items.length : 1), 0),
      0
    );
    items += count;
    console.log(
      `  Ch ${c.ch} ${c.name} — ${c.sections.length} sections, ${count} blocks (${c.sections
        .map((s) => s.title)
        .join(', ')})`
    );
  }
  console.log(`\napp/data/cheatsheet.json — ${chapters.length} chapters, ${sections} sections, ${items} blocks`);
  console.log('app/notes.html      — the same notes as static HTML, for search engines');
  console.log('app/llms-full.txt   — the same notes as markdown, for AI agents');
}

main();
