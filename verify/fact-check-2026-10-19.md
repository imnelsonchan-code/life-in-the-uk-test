# Fact-check report — Life in the UK Test pool

**Date:** 19 October 2026
**Scope:** all 716 questions across the 5 categories
**Method:** 7 independent read-only reviews (history ×2, modern_society ×2, government_law ×2, values_principles + what_is_uk), each verifying marked answers, distractors, explanations, currency of facts, "Which TWO" answer counts, and spelling against the official handbook and current public sources.
**Policy applied:** where the printed handbook now differs from current UK law/practice, the question is brought up to date and the explanation notes the handbook's older figure.

Result after fixes: `node tools/validate.js` passes, `node tools/test.js` passes 51 checks, pool = **716 questions**.

---

## Fixed — Government and law (11)

| id | Issue | Fix |
|---|---|---|
| gov-0050 | Senedd had 60 members | 96 members (since the 7 May 2026 election; Senedd Cymru (Members and Elections) Act 2024) |
| gov-0089 | "a jury can return a verdict of 'not proven'" marked True | marked **False** — verdict abolished for trials from 1 Jan 2026 (Victims, Witnesses, and Justice Reform (Scotland) Act 2025) |
| gov-0122 | Senedd can make laws in "21 areas" | **20 areas** (handbook figure) |
| gov-0137 | explanation cited "defence and foreign affairs" as devolved examples | replaced with civil/criminal law, health, education, planning; noted defence/foreign affairs are **reserved** |
| gov-0107 | explanation said the 1928 Act extended the vote to "men and women" | 1928 gave **women** over 21 the vote on the same terms as men |
| gov-0072 | "most serious terrorist threat = Al Qa'ida" (2013 wording), with non-terrorist distractors | updated to Islamist terrorism including Al Qa'ida and Daesh (ISIS); plausible distractors |
| gov-0029 | premise implied individual registration was NI-only | stem reworded (NI runs a separate system; individual registration is now UK-wide) |
| gov-0031 | "Voters must show photo ID" stated unconditionally | narrowed to UK parliamentary / English local elections, with the devolved-election exceptions in the explanation |
| gov-0092 | 16+ "may drink alcohol with a meal" | beer, wine or cider (not spirits) — GOV.UK |
| gov-0015 | explanation implied hereditary peers still affected only by 1999 | notes the remaining hereditary peers were removed in 2026 |
| gov-0113 | "Since 1999, hereditary peers have elected a few of their number" marked True | now **True that hereditary peers can no longer sit** (House of Lords (Hereditary Peers) Act 2026, in force 29 Apr 2026) — the old statement is no longer true |

## Fixed — History (5)

| id | Issue | Fix |
|---|---|---|
| hist-0059 | stem said Guy Fawkes *led* the Gunpowder Plot (Robert Catesby did) | stem reworded to Fawkes being caught guarding the gunpowder; explanation corrected |
| hist-0112 | "the law of 1847 … women and children working in *mines* and factories" | 1847 Act = factories only; "mines" removed |
| hist-0068 | explanation put Cromwell's Lord Protectorate in 1649 | 1653 |
| hist-0130 | explanation covered only the Kipling half | added Bradley Wiggins (2012 Tour de France) |
| hist-0167 | explanation credited James Goodfellow for the 1967 Enfield ATM | the 1967 machine was John Shepherd-Barron's design |

## Fixed — Modern society (6)

| id | Issue | Fix |
|---|---|---|
| soc-0180 | stem said Dolly was "the first cloned mammal" | "the first mammal to be cloned from an **adult cell**" |
| soc-0070 | Ellen MacArthur record dated 2004 | 2005 (completed 7 Feb 2005, having set off Nov 2004) |
| soc-0097 | "Man Booker Prize … awarded since 1968" | Booker Prize established 1968, **first awarded 1969**; renamed over time |
| soc-0093 | Mercury Prize "awarded each September" | "each year (usually September or October)" |
| soc-0052 | "nearly 10%" foreign parent/grandparent | updated to 2021 Census (~1 in 6 born outside the UK) |
| soc-0057 | garbled explanation fragment | rewritten |

## Fixed — Values and principles (8)

| id | Issue | Fix |
|---|---|---|
| val-0049 | referred to the "UK Border Agency" (abolished 2013) | reworded; explanation notes UK Visas and Immigration (Home Office) |
| val-0056 | explanation pointed to a defunct "UK Border Agency website" | GOV.UK |
| val-0069 | National Citizen Service presented as current | NCS closed 31 Mar 2025; question and explanation updated |
| val-0005 | "take identification and proof of address" | current requirement is the same photo ID used to book |
| val-0043, val-0045, val-0054, val-0055 | nonsensical distractors (Highway Code, "marked by your local MP", "shopping website", "local police station") | replaced with plausible-but-wrong options |

---

## Flagged but deliberately left as-is (to stay aligned with the official handbook/test)

- **hist-0155** — "In 1947 independence was granted to nine countries, including India". Historically only India and Pakistan became independent in 1947 (Ceylon and Burma followed in 1948), but the item reproduces the handbook's own line and the test follows the book.
- **hist-0190** — "Cnut … was the first Danish king to rule England". Strictly Sweyn Forkbeard ruled England briefly in 1013–14; the handbook names Cnut. Kept.
- **gov-0068** — Police and Crime Commissioners first elected November 2012: correct (abolition has been announced for the end of the 2028 cycle, but they still exist).
- **gov-0071** — MOT at three years: correct for Great Britain (four years in Northern Ireland).
- **uk-0046** — "about 30" test centres: matches current GOV.UK ("over 30"), though the printed handbook says "about 60".

## Noted (not defects)

- Missing ids in the ranges (e.g. history 0021/0029/0050/…, what_is_uk 0009/0019/…, modern_society 0006/0017/…) are the previously removed duplicates recorded in `app/data/removed/duplicates.json`.
