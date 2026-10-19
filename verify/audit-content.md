# Content Audit — Life in the UK question pool

Independent, adversarial content audit of `app/data/questions/*.json` (577 questions).
Auditor: independent agent. Scope: content correctness, duplicate/redundancy, staleness,
and structural integrity. I did **not** rely on `tools/dupes.js` or the existing
`verify/*.md` checklists.

## Summary

| Metric | Result |
|---|---|
| Questions in live pool | **577** (history 202, modern_society 126, government_law 120, what_is_uk 69, values_principles 60) |
| Types | single 364, two 83, truefalse 77, statement 53 |
| Formally sampled & verified | **82** (gov 16, hist 26, soc 14, uk 13, val 13 — ≥12/category, history-weighted) |
| Answer-key / factual errors found | **0** |
| Structural shape errors | **0** |
| Concrete defects found | **2** (both staleness; see table) |
| Suspected-but-unconfirmed items | **6** |
| Near-duplicate merge groups | **20** (6 true-duplicate groups + 14 near-duplicate groups) |

Read-through coverage: I read the **entire** 577-question pool, not just the sample, and
cross-checked factual claims against the official handbook text (`/tmp/opencode/ref/ch1..ch5`).
No wrong answer keys, no wrong facts, and no false-premise defects were found. The pool's
main defect class is **redundancy / near-duplication**, plus a handful of **staleness** items.

## Known exceptions — re-verified (not reported as bugs)

All three intentionally retain the handbook answer while noting the real-world change in the
explanation. Confirmed present and correct:

- `gov-0050` (Senedd 60 members): explanation states the Senedd "expanded to 96 members from the 2026 election". ✔
- `gov-0024` (voting age 18): explanation notes 16 is used for Scottish/Welsh devolved elections. ✔
- `gov-0029` (individual electoral registration): explanation notes "Individual registration has since been extended across the UK." ✔

## Concrete problems

| id | What is wrong | Correction | Confidence |
|---|---|---|---|
| `gov-0125` | States the Council of Europe has **47 member countries** and repeats it in the explanation. The handbook says 47, but the real-world figure has been **46** since Russia was expelled in March 2022. The explanation gives no hint that the number changed. | Keep the handbook answer (47) for consistency, but amend the explanation to note that Russia's membership ended in 2022, so the current figure is 46 — mirroring the treatment of the Senedd/voting-age exceptions. | **High** (real-world fact) / **Medium** (that it warrants the note) |
| `soc-0097` | "The **Man Booker** Prize for Fiction has been awarded since 1968." The prize was renamed **The Booker Prize** in 2019 after Man Group's sponsorship ended; "Man Booker" (2002–2019) is no longer its name. The underlying statement (awarded since 1968) is true and matches the handbook. | Keep the True key; update the wording/explanation to note the current name "The Booker Prize" (renamed 2019). | **High** (rename) / **Low** (severity — handbook itself uses the old name) |

I found **no** wrong-answer, wrong-fact, or false-premise defects anywhere in the pool.

## Suspected but unconfirmed

These are defensible because they either match the handbook verbatim or are explicitly
time-anchored. Listed for awareness, not as confirmed bugs.

| id | Concern | Why it is only suspected |
|---|---|---|
| `val-0049` | Refers to the **UK Border Agency** to accept test certificates. UKBA was abolished in 2013 (replaced by UK Visas & Immigration / Border Force). | Question says "According to the handbook…", and the handbook names UKBA; answer key is correct. |
| `val-0056` | Explanation tells applicants to check the **UK Border Agency website**. | The question itself is a timeless true/false; only the explanation names the defunct body (and attributes it to the handbook). |
| `uk-0044` | "Approximately how many people live in the UK **(2017 estimate)**?" → just over 66 million. Now ~68 million. | Explicitly labelled a 2017 estimate, so not strictly wrong; matches handbook. |
| `soc-0001`, `soc-0002`, `soc-0117` | 2011 Census religion figures (Christian 59%, no religion ~25%, Muslim 4.8%). The **2021 Census** returned materially different figures. | Each question is explicitly anchored to "the 2011 Census" and matches the handbook. |
| `gov-0072` | "Which group is considered the most serious terrorist threat to the UK?" → Al Qa'ida and its affiliates. The current threat picture is broader (Islamist terrorism generally, plus NI-related and far-right). | Matches the handbook verbatim; no single clearly-correct modern replacement. |
| `soc-0125` | "…won the Formula 1 World Championship for Britain **in recent years**" — vague time-anchoring. | The drivers named (Hill, Hamilton) are historically correct; only the phrasing is loose. |

## Near-duplicate merge note

Judgement rule: a **true duplicate** tests the *same single fact* as another live question
(answer-equivalent); a **near-duplicate** tests the same underlying fact in a different format
(single ↔ two ↔ truefalse) or a strict subset; a **false positive** tests a genuinely distinct
fact. Merge groups below are ordered by confidence.

### Tier A — true duplicates (same single fact; recommend dropping/merging one)

| Group | ids | Shared fact |
|---|---|---|
| A1 | `soc-0111` ↔ `uk-0017` | St David's Day = 1 March |
| A2 | `hist-0060` ↔ `soc-0036` | Bonfire Night commemorates the Gunpowder Plot |
| A3 | `gov-0025` ↔ `hist-0171` (also embedded in `gov-0026`) | Voting age reduced to 18 in 1969 |
| A4 | `gov-0090` ↔ `hist-0160` | UK signed the European Convention on Human Rights in 1950 |
| A5 | `hist-0179` ↔ `soc-0096` | Turner Prize established in 1984 |
| A6 | `val-0038` ↔ `val-0039` ↔ `val-0040` | Life in the UK test + English speaking/listening at B1 required |

### Tier B — near-duplicates (same underlying fact, different framing; consider consolidating)

| Group | ids | Overlap |
|---|---|---|
| B1 | `gov-0048` ↔ `gov-0049` | Reserved matters: defence / foreign affairs / social security / taxation |
| B2 | `hist-0156` ↔ `hist-0157` | NHS established 1948 (and Bevan) |
| B3 | `hist-0074` ↔ `hist-0085` | Huguenots = Protestants persecuted in France |
| B4 | `gov-0015` ↔ `gov-0113` | House of Lords Act 1999 and hereditary peers |
| B5 | `gov-0107` ↔ `hist-0138` | 1918: vote extended to women over 30 |
| B6 | `hist-0041` ↔ `hist-0042` | Bosworth Field 1485 / Henry VII |
| B7 | `hist-0003` ↔ `hist-0004` | First farmers arrived ~6,000 years ago |
| B8 | `hist-0130` ↔ `soc-0072` | Bradley Wiggins first Briton to win the Tour de France |
| B9 | `val-0027` ↔ `val-0028` | Definition of tolerance |
| B10 | `uk-0036` ↔ `uk-0037` ↔ `uk-0038` | British overseas territories (the `two` subsumes both singles) |
| B11 | `gov-0026` ↔ `hist-0144` | Fully democratic voting system since 1928 |
| B12 | `hist-0082` ↔ `hist-0083` | Battle of the Boyne 1690 |
| B13 | `hist-0020` ↔ `hist-0023` | William the Conqueror / Battle of Hastings 1066 |
| B14 | `soc-0111` ↔ `soc-0112` | St David's Day falls in March |

### Tier C — false positives (distinct facts; keep both)

Per-country fact families look similar but each item tests a different fact and should be kept:
patron saints (`uk-0011`–`uk-0014`), saint days (`uk-0015`–`uk-0018`), capitals
(`uk-0006`/`uk-0007`/`uk-0008`/`uk-0010`), national flowers/plants (`uk-0021`–`uk-0025`).
Also false positives: `soc-0003`/`soc-0009`, `soc-0028`/`soc-0029`, `soc-0001`/`soc-0117`,
`soc-0040` vs the saint-day items, `soc-0005` vs the saint-day items (holiday status ≠ date),
`uk-0004`/`uk-0042`/`uk-0043`, `hist-0132`/`hist-0136`,
`gov-0011` vs `gov-0014`/`gov-0115`/`hist-0196`, `soc-0046`/`soc-0030`.

### Already-removed duplicates

All 43 ids in `app/data/removed/duplicates.json` are absent from the live pool; none of the
`tools/dedupe-list*.json` ids remain. The Tier A/B groups above are the residual redundancy.

## Structural checks

- **Shapes:** every `single`/`statement` has 4 options/1 answer; every `truefalse` is exactly
  `["True","False"]`/1 answer; every `two` has 4–5 options/2 distinct answers. No out-of-range
  or duplicate answer indexes, no duplicate option text. **0 issues.**
- **`two` questions — exactly 2 defensible:** all 83 reviewed; each has exactly two correct
  options with the remaining options clearly false (verified against the handbook).
- **`truefalse` ambiguity:** all 77 reviewed; no statement found where both True and False are
  defensible.
- **Explanations vs key:** no explanation contradicts its key. Two explanations mention a
  *wrong* option verbatim (`soc-0120`, `uk-0038`) but only to explain why it is wrong (e.g.
  Super League = rugby league, *not* rugby union; Isle of Man = Crown dependency, *not* a
  British overseas territory) — benign clarifications, not defects.
- **Repeated correct-option text in explanations:** common across the pool, but acceptable
  since explanations are shown on the review screen after answering. Not counted as a defect.
- **False premises:** none found in any question stem.

## Method / evidence

- Full pool dumped to `/tmp/opencode/scratch/all_questions.txt`; read end-to-end.
- Independent duplicate finders in Python (token Jaccard + character-4-gram + answer-centric
  grouping): `/tmp/opencode/scratch/mysim3.py`, `ansdup.py` → 81 candidate pairs
  (`pairs3.json`, `pairs_report.txt`), adjudicated by hand into Tiers A/B/C.
- Structural checker `/tmp/opencode/scratch/structure.py` (shape, duplicate-option, index,
  explanation-vs-key, cross-question answer-collision checks).
- Sample of 82 (`sample_ids.txt`) verified line-by-line against the handbook.
- Real-world staleness facts confirmed via current sources: Council of Europe = 46 members
  since Russia's expulsion (March 2022); "Man Booker Prize" renamed "The Booker Prize" in 2019;
  UK Border Agency abolished 2013.
- Only file written: `verify/audit-content.md`. No changes under `app/` or `tools/`.

---

## Decisions taken (after review)

**Acted on — the two staleness defects:**

| id | Action |
| --- | --- |
| `gov-0125` | Council of Europe: kept the handbook answer **47** (the exam marks the handbook), added `(Russia was expelled in March 2022, leaving 46 members.)` to the explanation — the same pattern already used for the Senedd (`gov-0050`), voting age (`gov-0024`) and registration (`gov-0029`). |
| `soc-0097` | Booker Prize: the handbook fact ("awarded since 1968") is still true, so the answer stands. Renamed in 2019, so the explanation now reads `(The prize has been known simply as The Booker Prize since 2019.)` |

**Deliberately NOT acted on — the duplicate/redundancy groups.**

The 6 groups flagged as testing the same single fact have been **kept on purpose**:

`soc-0111`↔`uk-0017` · `hist-0060`↔`soc-0036` · `gov-0025`↔`hist-0171` ·
`gov-0090`↔`hist-0160` · `hist-0179`↔`soc-0096` · `val-0038`/`val-0039`/`val-0040`

Rationale: five of the six are *cross-category* pairs. Seeing the same fact from a
different chapter reinforces it, and removing one side would silently shift the
per-chapter balance that the mock test is built on. This is a deliberate exception
to the "remove one" dedupe rule, not an oversight. The remaining near-duplicate
groups (14) test the same fact in different formats (`single` vs `two` vs
`truefalse`) and were already treated as acceptable.

**Not yet actioned (reported, lower confidence):** the 6 "suspected" items
(`val-0049`/`val-0056`, `uk-0044`, `soc-0001`/`soc-0002`/`soc-0117`, `gov-0072`,
`soc-0125`) are handbook-faithful or explicitly time-anchored, so they were left
as-is. Revisit if the handbook is ever updated.
