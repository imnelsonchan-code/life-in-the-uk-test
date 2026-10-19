'use strict';

/* =========================================================================
 * Life in the UK — practice + mock test app (no dependencies)
 * ========================================================================= */

const CATEGORIES = [
  { id: 'values_principles', name: 'Values & Principles', prefix: 'val', color: '#7c3aed' },
  { id: 'what_is_uk', name: 'What is the UK?', prefix: 'uk', color: '#0ea5e9' },
  { id: 'history', name: 'A Long & Illustrious History', prefix: 'hist', color: '#f59e0b' },
  { id: 'modern_society', name: 'A Modern, Thriving Society', prefix: 'soc', color: '#10b981' },
  { id: 'government_law', name: 'Government, Law & Your Role', prefix: 'gov', color: '#ef4444' },
];
const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const CAT_ORDER = CATEGORIES.map((c) => c.id);
/* Defensive label for a question whose category is missing from the pool index. */
const UNKNOWN_CAT = { id: 'unknown', name: 'Question', color: 'var(--muted)' };

const MOCK = {
  total: 24,
  minutes: 45,
  pass: 18,
  // NOTE: the Home Office does NOT publish a per-chapter breakdown of the real
  // test, and does not release the live question bank. These weights are an
  // ESTIMATE based on the relative size of each handbook chapter (History is by
  // far the longest) and on third-party practice sites. They are a reasonable
  // study aid, not an official distribution. Tweak freely.
  weights: {
    history: 11,
    modern_society: 5,
    government_law: 4,
    what_is_uk: 3,
    values_principles: 1,
  },
};

/* The 4-week plan (mirrors STUDY_PLAN.md). `go` links a day to an action in-app. */
const PLAN_4W = [
  { d: 1, w: 1, t: 'The values & principles of the UK (Ch 1)', k: ['Read Ch 1: the 5 fundamental principles, rights & responsibilities, the citizenship pledge.', 'Answer all Ch 1 questions in the official Q&A.', 'Also read the practical half of Ch 1: becoming a permanent resident and taking the test.', 'Practise 20 questions: Values & Principles.'], go: { label: 'Drill Values & Principles', action: 'start-cat', cat: 'values_principles' } },
  { d: 2, w: 1, t: 'What is the UK? — nations & capitals (Ch 2)', k: ['Read: the 4 nations, capitals, Great Britain vs the UK, the British Isles, Crown dependencies, overseas territories.', 'Note what "Great Britain" excludes.', 'Practise 25 questions: What is the UK?'], go: { label: 'Drill What is the UK?', action: 'start-cat', cat: 'what_is_uk' } },
  { d: 3, w: 1, t: 'Symbols, people & geography (Ch 2)', k: ['Read: patron saints & days, national flowers, the Union Flag, population, languages, cities, currency — and the physical geography: hills, mountains, rivers and lakes.', 'Answer all Ch 2 questions in the official Q&A.', 'Practise 25 × What is the UK? + one Quick 10.'], go: { label: 'Drill What is the UK?', action: 'start-cat', cat: 'what_is_uk' } },
  { d: 4, w: 1, t: 'Early Britain (Ch 3)', k: ['Read Stone Age → Romans → Anglo-Saxons → Vikings → Norman Conquest.', 'Memorise the anchor dates: AD 43, AD 410, 1066, 1086.', 'Practise 30 History questions — set the Difficulty chip to Easy first.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 5, w: 1, t: 'The Middle Ages (Ch 3)', k: ['Read: Magna Carta, Wales & Scotland, the Hundred Years War, the Black Death, the Wars of the Roses.', 'Timeline card: 1215, 1314, 1348, 1415, 1455 (the Wars of the Roses begin), 1485.', 'Practise 30 History questions.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 6, w: 1, t: 'The Tudors & Stuarts (Ch 3)', k: ['Read: Henry VIII, the Reformation, Elizabeth I, the Armada, the Gunpowder Plot, the Civil War, the Restoration.', 'Do the first half of Ch 3 in the official Q&A.', 'Practise 30 History questions.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 7, w: 1, t: 'Week 1 review + baseline mock', k: ['Clear every wrong answer so far (Practice → Retry wrong).', 'Sit the baseline mock (target about 15/24) — it is a baseline, not a verdict.', 'Re-read Ch 1–2 notes and your timeline card.'], go: { label: 'Start mock test', action: 'start-mock' } },

  { d: 8, w: 2, t: 'The 18th & 19th centuries (Ch 3)', k: ['Read: the 1707 Union, the empire, Trafalgar, Waterloo, the Reform Acts, Victoria, the Industrial Revolution, Ireland — and the abolition of slavery.', 'Practise 30 History questions.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 9, w: 2, t: 'The 20th century, part 1 (Ch 3)', k: ['Read: WWI and the Somme, women\'s suffrage (1918, 1928), Ireland, the Depression, WWII and the Battle of Britain.', 'Practise 30 History questions.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 10, w: 2, t: 'The 20th century, part 2 & since 1945 (Ch 3)', k: ['Read: the NHS (1948), the welfare state, the Commonwealth, the 1960s–2000s, broadcasting (the BBC was founded in 1922), devolution, and the UK leaving the EU in 2020.', 'Do the second half of Ch 3 in the official Q&A.', 'Practise 30 History questions.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 11, w: 2, t: 'History consolidation', k: ['Practise 30 History questions — set the Difficulty chip to Hard first.', 'Review every wrong answer and add the fact to your notes.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 12, w: 2, t: 'Weak areas + Mock #1', k: ['Check Stats, then drill your two weakest categories on Practice.', 'Sit Mock #1. Target 18+/24.', 'Review every wrong answer fully.'], go: { label: 'Start mock test', action: 'start-mock' } },
  { d: 13, w: 2, t: 'Revisit the shorter chapters', k: ['Retry your wrong answers — start with Values & Principles and What is the UK?.', 'Two Quick 10 mixed sets from the Practice tab.'], go: { label: 'Retry wrong answers', action: 'start-wrong' } },
  { d: 14, w: 2, t: 'Rest + light revision', k: ['Official app quiz only — 15–20 min.', 'Re-read your key-facts sheet. No heavy study.'] },

  { d: 15, w: 3, t: 'Religion (Ch 4)', k: ['Read: the churches, other faiths, and the census figures.', 'Practise 25 Modern Society questions.'], go: { label: 'Drill Modern Society', action: 'start-cat', cat: 'modern_society' } },
  { d: 16, w: 3, t: 'Festivals, customs & traditions (Ch 4)', k: ['Read: patron saints\' days, Christmas/Easter, Diwali, Hannukah, Eid, Vaisakhi, Remembrance Day, bank holidays.', 'Do the first half of Ch 4 in the official Q&A.', 'Practise 25 Modern Society questions.'], go: { label: 'Drill Modern Society', action: 'start-cat', cat: 'modern_society' } },
  { d: 17, w: 3, t: 'Sport, arts, culture & leisure (Ch 4)', k: ['Read: sports & sportspeople, music, literature, art, architecture, gardens and places of interest — plus film, television & the media, science, and food.', 'Practise 30 Modern Society questions.'], go: { label: 'Drill Modern Society', action: 'start-cat', cat: 'modern_society' } },
  { d: 18, w: 3, t: 'Government & the constitution (Ch 5)', k: ['Read: the monarchy, Parliament, Commons/Lords, the Speaker, elections, voting, the PM, cabinet, parties, local government.', 'Practise 30 Government & Law questions.'], go: { label: 'Drill Government & Law', action: 'start-cat', cat: 'government_law' } },
  { d: 19, w: 3, t: 'Devolution & international bodies (Ch 5)', k: ['Read: the Scottish Parliament, the Senedd, the NI Assembly; the Commonwealth, UN, NATO, Council of Europe.', 'Do the first half of Ch 5 in the official Q&A.', 'Practise 25 Government & Law questions.'], go: { label: 'Drill Government & Law', action: 'start-cat', cat: 'government_law' } },
  { d: 20, w: 3, t: 'Law, courts & your role (Ch 5)', k: ['Read: criminal vs civil law, courts & juries, the police, human rights, tax, driving, volunteering — plus the civil service, equality & discrimination, and the laws on alcohol, tobacco and drugs.', 'Practise 30 Government & Law questions.'], go: { label: 'Drill Government & Law', action: 'start-cat', cat: 'government_law' } },
  { d: 21, w: 3, t: 'Week 3 review + Mock #2', k: ['Retry wrong answers in Modern Society and Government & Law (Practice → Retry wrong).', 'Sit Mock #2. Target 20+/24.', 'Review every wrong answer in depth.'], go: { label: 'Start mock test', action: 'start-mock' } },

  { d: 22, w: 4, t: 'Target your weakest areas', k: ['Stats: find your two weakest categories and drill them (hard).', 'Redo those chapters in the official Q&A.'], go: { label: 'Open Stats', action: 'go-tab', tab: 'stats' } },
  { d: 23, w: 4, t: 'Full sweep — Ch 1 + Ch 2', k: ['Practise all Values & Principles (72) and What is the UK? (77) — 149 questions in one sitting.', 'Target 90%+.'], go: { label: 'Sweep Ch 1 + Ch 2', action: 'start-cats', cats: ['values_principles', 'what_is_uk'] } },
  { d: 24, w: 4, t: 'Full sweep — History', k: ['On Practice, switch on "Only questions I haven’t seen", then drill History to confirm you have covered it all.', 'Target 85%+.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 25, w: 4, t: 'Mock #3 + review', k: ['Sit Mock #3. Target 22+/24.', 'Add any new facts to your sheet.'], go: { label: 'Start mock test', action: 'start-mock' } },
  { d: 26, w: 4, t: 'Mock #4 under exam conditions', k: ['Sit Mock #4 in the morning, phone away. Target 22+/24 again — you are confirming it now, not learning it.', 'Analyse the result and close the last gaps.'], go: { label: 'Start mock test', action: 'start-mock' } },
  { d: 27, w: 4, t: 'Light revision', k: ['Re-read your key-facts sheet and notes.', 'Official app questions for speed. Optionally sit one more full mock (24 questions / 45 minutes).'], go: { label: 'Quick 10', action: 'start-quick' } },
  { d: 28, w: 4, t: 'Rest and prepare', k: ['No cramming. Confirm your ID and test centre details.', 'Early night. Remember: 24 questions, 45 minutes, 18 to pass.'] },
];

const MILESTONES_4W = [
  { day: 7, target: '~15/24', note: 'Baseline — you know the format' },
  { day: 12, target: '18+/24', note: 'Passing level' },
  { day: 21, target: '20+/24', note: 'Comfortable' },
  { day: 26, target: '22+/24', note: 'Exam-ready with margin' },
];

/* --------------------------------------------------------------------------
 * Plan variants. Each plan is a list of days: d = day number, w = week,
 * t = focus, k = tasks, go = optional in-app action. A plan is chosen with
 * `store.planId`; ticking a day only affects that plan.
 * ------------------------------------------------------------------------ */

const PLAN_2W = [
  { d: 1, w: 1, t: 'Values, nations & symbols (Ch 1–2)', k: ['Read Ch 1: the 5 fundamental principles, your rights & responsibilities, the citizenship pledge.', 'Read Ch 2: the 4 nations, capitals, Great Britain vs the UK, the British Isles, Crown dependencies.', 'Practise 25 Values & Principles, then 20 What is the UK? — both from the Practice tab.'], go: { label: 'Drill Values & Principles', action: 'start-cat', cat: 'values_principles' } },
  { d: 2, w: 1, t: 'Ch 2 finish + Early Britain (Ch 3)', k: ['Read: patron saints & days, national flowers, the Union Flag, currency, languages, major cities.', 'Read Ch 3: Stone Age → Romans → Anglo-Saxons → Vikings → Norman Conquest.', 'Memorise AD 43, AD 410, 1066, 1086. Practise 25 × What is the UK?'], go: { label: 'Drill What is the UK?', action: 'start-cat', cat: 'what_is_uk' } },
  { d: 3, w: 1, t: 'Middle Ages, Tudors & Stuarts (Ch 3)', k: ['Read: Magna Carta, Wales & Scotland, the Hundred Years War, the Black Death, the Wars of the Roses.', 'Read: Henry VIII, the Reformation, Elizabeth I, the Armada, the Gunpowder Plot, the Civil War, the Restoration.', 'Timeline: 1215, 1314, 1348, 1415, 1485, 1530s (the Reformation), 1588, 1605. Practise 40 History questions.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 4, w: 1, t: 'The 18th century to the Great War (Ch 3)', k: ['Read: the 1707 Union, empire, Trafalgar, Waterloo, the Reform Acts, Victoria, the Industrial Revolution, Ireland.', "Read: WWI and the Somme, women's suffrage (1918, 1928), the Depression, WWII and the Battle of Britain.", 'Practise 40 History questions.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 5, w: 1, t: 'Ch 3 finish + baseline mock', k: ['Read: the NHS (1948), the welfare state, the Commonwealth, the 1960s–2000s, broadcasting (the BBC was founded in 1922), devolution, and the UK leaving the EU in 2020.', 'Clear every wrong answer so far, then sit the baseline mock (target ~15/24).', 'Review every wrong answer and add the facts to your notes.'], go: { label: 'Start mock test', action: 'start-mock' } },
  { d: 6, w: 1, t: 'Religion, festivals & customs (Ch 4)', k: ['Read: the churches and other faiths, the census figures, patron saints, Christmas/Easter, Diwali, Hannukah, Eid, Vaisakhi, Remembrance Day.', 'Practise 30 Modern Society questions.', 'Retry any Values & Principles / What is the UK? questions you have got wrong (Practice → Retry wrong).'], go: { label: 'Drill Modern Society', action: 'start-cat', cat: 'modern_society' } },
  { d: 7, w: 1, t: 'Ch 4 finish + week 1 review', k: ['Read: sport & sportspeople, music, literature, art, architecture, gardens, places of interest.', 'Practise 30 Modern Society questions.', 'Review your notes and re-read the timeline card.'], go: { label: 'Drill Modern Society', action: 'start-cat', cat: 'modern_society' } },

  { d: 8, w: 2, t: 'Government & the constitution (Ch 5)', k: ['Read: the monarchy, Parliament, Commons/Lords, the Speaker, elections and voting, the PM, cabinet, parties, local government.', 'Practise 30 Government & Law questions.', 'Re-read the devolution summary before tomorrow.'], go: { label: 'Drill Government & Law', action: 'start-cat', cat: 'government_law' } },
  { d: 9, w: 2, t: 'Devolution & international bodies (Ch 5)', k: ['Read: the Scottish Parliament, the Senedd, the NI Assembly; the Commonwealth, UN, NATO, Council of Europe.', 'Practise 30 Government & Law questions.', 'On the Mock tab, sit Mock #1 (target 18+/24) and review it fully.'], go: { label: 'Drill Government & Law', action: 'start-cat', cat: 'government_law' } },
  { d: 10, w: 2, t: 'Law, courts & your role (Ch 5)', k: ['Read: criminal vs civil law, courts and juries, the police, human rights, tax, driving, volunteering.', 'Practise 30 Government & Law questions.', 'Retry every wrong answer from the whole pool (Practice → Retry wrong).'], go: { label: 'Drill Government & Law', action: 'start-cat', cat: 'government_law' } },
  { d: 11, w: 2, t: 'Weak areas + Mock #2', k: ['Open Stats and drill your two weakest categories (hard).', 'Sit Mock #2 — hold 18+/24.', 'Review every wrong answer in depth.'], go: { label: 'Open Stats', action: 'go-tab', tab: 'stats' } },
  { d: 12, w: 2, t: 'Full sweep + Mock #3', k: ['Practise all Values & Principles (72) and What is the UK? (77) — 149 questions in one sitting.', 'Sit Mock #3 — target 20+/24.', 'Add any new facts to your key-facts sheet.'], go: { label: 'Sweep Ch 1 + Ch 2', action: 'start-cats', cats: ['values_principles', 'what_is_uk'] } },
  { d: 13, w: 2, t: 'Mock #4 under exam conditions', k: ['Sit Mock #4 in the morning, phone away. Target 22+/24.', 'Analyse the result and close the last gaps.', 'Light revision only in the evening.'], go: { label: 'Start mock test', action: 'start-mock' } },
  { d: 14, w: 2, t: 'Rest and prepare', k: ['No cramming. Re-read your key-facts sheet once — or a single Quick 10 if you want to stay sharp.', 'Confirm your ID and test centre details.', 'Early night: 24 questions, 45 minutes, 18 to pass.'], go: { label: 'Quick 10', action: 'start-quick' } },
];

const MILESTONES_2W = [
  { day: 5, target: '~15/24', note: 'Baseline — you know the format' },
  { day: 9, target: '18+/24', note: 'Passing level' },
  { day: 12, target: '20+/24', note: 'Comfortable' },
  { day: 13, target: '22+/24', note: 'Exam-ready with margin' },
];

const PLAN_1W = [
  { d: 1, w: 1, t: 'Values, nations & symbols (Ch 1–2)', k: ['Read Ch 1: the 5 fundamental principles, rights & responsibilities, the citizenship pledge.', 'Read Ch 2: the 4 nations, capitals, Great Britain vs the UK, patron saints, the Union Flag, currency.', 'Practise 30 Values & Principles, then 30 What is the UK? — both from the Practice tab. Expect 3–4 hours today.'], go: { label: 'Drill Values & Principles', action: 'start-cat', cat: 'values_principles' } },
  { d: 2, w: 1, t: 'Early Britain to the Industrial Revolution (Ch 3)', k: ['Read: Stone Age → Romans → Anglo-Saxons → Vikings → Normans; Magna Carta, the Middle Ages, Wales & Scotland.', 'Read: the Tudors and Stuarts; the 1707 Union, empire, Trafalgar, Waterloo, the Reform Acts, Victoria, the Industrial Revolution.', 'Memorise AD 43, 1066, 1215, 1485, 1530s (the Reformation), 1588, 1605, 1707. Practise 50 History questions.'], go: { label: 'Drill History', action: 'start-cat', cat: 'history' } },
  { d: 3, w: 1, t: 'Ch 3 finish + baseline mock', k: ['Read: WWI and the Somme, suffrage (1918, 1928), the Depression, WWII and the Battle of Britain, the NHS (1948), the Commonwealth, devolution, and the UK leaving the EU in 2020.', 'Practise 40 History questions, then sit the baseline mock (target ~15/24).', 'Review every wrong answer (Practice → Retry wrong) — these are your priority for tomorrow.'], go: { label: 'Start mock test', action: 'start-mock' } },
  { d: 4, w: 1, t: 'Modern society in one day (Ch 4)', k: ['Read: religion and the census, festivals and customs, sport, music, literature, art, architecture, gardens, places of interest.', 'Practise 50 Modern Society questions.', 'Retry every Modern Society question you have got wrong.'], go: { label: 'Drill Modern Society', action: 'start-cat', cat: 'modern_society' } },
  { d: 5, w: 1, t: 'Government & devolution (Ch 5) + Mock #1', k: ['Read: the monarchy, Parliament, elections and voting, the PM and cabinet, parties, local government.', 'Read: the Scottish Parliament, the Senedd, the NI Assembly; the Commonwealth, UN, NATO, Council of Europe.', 'Practise 30 Government & Law questions, then sit Mock #1 (target 18+/24).'], go: { label: 'Drill Government & Law', action: 'start-cat', cat: 'government_law' } },
  { d: 6, w: 1, t: 'Law & your role (Ch 5) + weak areas', k: ['Read: criminal vs civil law, courts and juries, the police, human rights, tax, driving, volunteering.', 'Open Stats and drill your two weakest categories.', 'Sit Mock #2 — target 20+/24 — and review every wrong answer.'], go: { label: 'Open Stats', action: 'go-tab', tab: 'stats' } },
  { d: 7, w: 1, t: 'Final revision, Mock #3 & rest', k: ['Morning: Mock #3 under exam conditions — target 22+/24.', 'Afternoon: re-read your key-facts sheet and only the facts you keep missing.', 'No cramming after that. Confirm your ID and test centre details. Early night.'], go: { label: 'Start mock test', action: 'start-mock' } },
];

const MILESTONES_1W = [
  { day: 3, target: '~15/24', note: 'Baseline — you know the format' },
  { day: 5, target: '18+/24', note: 'Passing level' },
  { day: 6, target: '20+/24', note: 'Comfortable' },
  { day: 7, target: '22+/24', note: 'Exam-ready with margin' },
];

const PLANS = {
  '4w': {
    id: '4w',
    chip: '4 weeks',
    name: '4-week plan',
    days: PLAN_4W,
    milestones: MILESTONES_4W,
    weeks: {
      1: 'Week 1 — Foundations & early History',
      2: 'Week 2 — History (the big one)',
      3: 'Week 3 — Society & Government',
      4: 'Week 4 — Exam readiness',
    },
    lede: 'A 4-week plan built around your official handbook, Q&A and app — with this app for drilling and mock tests. Tick each day off as you go.',
  },
  '2w': {
    id: '2w',
    chip: '2 weeks',
    name: '2-week plan',
    days: PLAN_2W,
    milestones: MILESTONES_2W,
    weeks: {
      1: 'Week 1 — Foundations & History',
      2: 'Week 2 — Society, Government & exam readiness',
    },
    lede: 'A 14-day plan for when the test is a fortnight away. Expect 2–3 focused hours a day: a first pass through each chapter, with mocks woven in from day 5 and the last days spent on your weak areas.',
  },
  '1w': {
    id: '1w',
    chip: '1 week',
    name: '1-week plan',
    days: PLAN_1W,
    milestones: MILESTONES_1W,
    weeks: { 1: 'The week — one pass, then mocks' },
    lede: 'A 7-day intensive for when the test is next week. Expect 3–4 hours a day: cover each chapter once, with a mock from day 3 and the final day kept for revision and rest.',
  },
};

const PLAN_ORDER = ['4w', '2w', '1w'];

function planDef(id) {
  return PLANS[id] || PLANS['4w'];
}

function currentPlan() {
  return planDef(store.planId);
}

/** The tick map for a store's selected plan (creating it if needed). */
function planDoneMap(s = store) {
  if (!s.plan || typeof s.plan !== 'object') s.plan = {};
  const id = planDef(s.planId).id;
  if (!s.plan[id]) s.plan[id] = {};
  return s.plan[id];
}

function planDoneCount(s) {
  const def = planDef(s.planId);
  const done = (s.plan && s.plan[def.id]) || {};
  return def.days.filter((d) => done[d.d]).length;
}

/** Migrate the old flat { "3": 1 } map into the 4-week bucket. */
function normalizeStore(s) {
  if (!s.plan || typeof s.plan !== 'object') s.plan = {};
  const legacy = Object.keys(s.plan).filter((k) => /^\d+$/.test(k));
  if (legacy.length) {
    const done = {};
    for (const k of legacy) done[k] = s.plan[k];
    s.plan = { '4w': done };
  }
  for (const id of PLAN_ORDER) if (!s.plan[id]) s.plan[id] = {};
  if (!PLANS[s.planId]) s.planId = '4w';
  return s;
}

const STORE_KEY = 'liuk_state_v1';
const ACTIVE_MOCK_KEY = 'liuk_active_mock_v1';

const TYPE_LABEL = {
  single: 'Single answer',
  truefalse: 'True or false',
  two: 'Choose TWO',
  statement: 'Pick the true statement',
};

/* ---------- storage ---------- */

function defaultStore() {
  return {
    seen: {},
    right: {},
    wrong: {},
    flags: {},
    mocks: [],
    plan: { '4w': {}, '2w': {}, '1w': {} },
    planId: '4w',
    testDate: null,
  };
}

let store = (() => {
  try {
    return normalizeStore(Object.assign(defaultStore(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}')));
  } catch (e) {
    return defaultStore();
  }
})();

function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    /* ignore quota errors */
  }
}

/* ---------- profiles (separate progress per person) ----------
 * The active person's state always lives in STORE_KEY, so a device with no
 * profiles behaves exactly as it did before this feature existed. Everyone
 * else's state is parked in `saved` while they are not the active person.
 */

const USERS_KEY = 'liuk_users_v1';

function defaultProfiles() {
  return { active: null, order: [], byId: {} };
}

function loadProfiles() {
  try {
    const raw = JSON.parse(localStorage.getItem(USERS_KEY) || 'null');
    if (raw && typeof raw === 'object' && raw.byId && Array.isArray(raw.order)) return raw;
  } catch (e) {
    /* fall through to an empty roster */
  }
  return defaultProfiles();
}

let profiles = loadProfiles();

function saveProfiles() {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(profiles));
  } catch (e) {
    /* ignore quota errors */
  }
}

function activeUser() {
  return profiles.active ? profiles.byId[profiles.active] || null : null;
}

function newUserId() {
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Park the live state (and any half-finished mock) under the active person. */
function parkActive() {
  const u = activeUser();
  if (!u) return;
  u.saved = store;
  try {
    u.savedMock = localStorage.getItem(ACTIVE_MOCK_KEY);
  } catch (e) {
    u.savedMock = null;
  }
}

/** Leave the current screen and re-read the pool for whoever is now active. */
function reloadForUser() {
  stopTimer();
  buildData();
  ui.session = null;
  ui.mock = null;
  ui.screen = 'home';
  setTab('user');
  render();
}

function switchUser(id) {
  const target = profiles.byId[id];
  if (!target || id === profiles.active) return;
  parkActive();
  store = normalizeStore(Object.assign(defaultStore(), target.saved || {}));
  target.saved = null;
  profiles.active = id;
  if (target.savedMock) localStorage.setItem(ACTIVE_MOCK_KEY, target.savedMock);
  else localStorage.removeItem(ACTIVE_MOCK_KEY);
  target.savedMock = null;
  saveStore();
  saveProfiles();
  reloadForUser();
  toast('Now tracking ' + target.name);
}

function addUser(name) {
  const clean = String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40);
  if (!clean) {
    toast('Enter a name first');
    return;
  }
  // The very first person adopts whatever has been tracked so far, so nobody
  // loses progress by naming themselves after practising anonymously.
  const first = !profiles.active && profiles.order.length === 0;
  if (!first) {
    parkActive();
    store = defaultStore();
    localStorage.removeItem(ACTIVE_MOCK_KEY);
  }
  const id = newUserId();
  profiles.byId[id] = { id: id, name: clean, createdAt: Date.now(), saved: null, savedMock: null };
  profiles.order.push(id);
  profiles.active = id;
  saveStore();
  saveProfiles();
  reloadForUser();
  toast(first ? 'Name saved — your progress so far is kept' : 'Now tracking ' + clean);
}

function renameUser(name) {
  const clean = String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40);
  const u = activeUser();
  if (!u) {
    addUser(clean);
    return;
  }
  if (!clean) {
    toast('Enter a name first');
    return;
  }
  u.name = clean;
  saveProfiles();
  render();
  toast('Name updated');
}

function removeUser(id) {
  const p = profiles.byId[id];
  if (!p) return;
  const wasActive = profiles.active === id;
  delete profiles.byId[id];
  profiles.order = profiles.order.filter((x) => x !== id);
  if (!wasActive) {
    saveProfiles();
    render();
    toast('Removed ' + p.name);
    return;
  }
  profiles.active = null; // never park the deleted person's state anywhere
  if (profiles.order.length) {
    switchUser(profiles.order[0]);
    return;
  }
  store = defaultStore();
  localStorage.removeItem(ACTIVE_MOCK_KEY);
  saveStore();
  saveProfiles();
  reloadForUser();
  toast('Removed ' + p.name);
}

/* ---------- app data ---------- */

const DATA = { all: [], base: [], byId: {}, byCat: {}, batchNew: [], cheat: null };

async function loadData() {
  const res = await fetch('data/questions/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('manifest ' + res.status);
  const manifest = await res.json();
  const lists = await Promise.all(
    manifest.categories.map((c) =>
      fetch('data/questions/' + c.file, { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error(c.file + ' ' + r.status);
        return r.json();
      })
    )
  );
  // The cheat sheet is study material, not exam material: the app still works
  // if it is missing, so a failure here is not fatal.
  DATA.cheat = await fetch('data/cheatsheet.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  DATA.base = lists.flat();
  buildData();
  return DATA;
}

/** Rebuild the in-memory pool from the shipped question files. */
function buildData() {
  DATA.all = (DATA.base || []).slice();
  DATA.byId = {};
  DATA.byCat = {};
  for (const c of CATEGORIES) DATA.byCat[c.id] = [];
  for (const q of DATA.all) {
    DATA.byId[q.id] = q;
    (DATA.byCat[q.category] || (DATA.byCat[q.category] = [])).push(q);
  }
  DATA.batchNew = DATA.all.filter((q) => q.batch === 'new');
}

/* ---------- helpers ---------- */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function instantiate(q, forcedOrder) {
  const n = q.options.length;
  const valid =
    Array.isArray(forcedOrder) &&
    forcedOrder.length === n &&
    new Set(forcedOrder).size === n &&
    forcedOrder.every((i) => Number.isInteger(i) && i >= 0 && i < n);
  // A saved mock passes its original permutation back in, so resuming restores
  // the same option order — and therefore the same meaning for every answer the
  // user already gave.
  const order = valid ? forcedOrder.slice() : shuffle(q.options.map((_, i) => i));
  return {
    id: q.id,
    ref: q,
    optionOrder: order,
    options: order.map((i) => q.options[i]),
    answer: q.answer.map((a) => order.indexOf(a)).sort((x, y) => x - y),
    selected: new Set(),
    revealed: false,
    flagged: !!store.flags[q.id],
    correct: null,
  };
}

function sameSet(a, b) {
  const A = [...a].sort((x, y) => x - y);
  const B = [...b].sort((x, y) => x - y);
  return A.length === B.length && A.every((v, i) => v === B[i]);
}

function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

let toastTimer = null;
function toast(msg, ms) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms || 1900);
}

/* group questions for the "statement" type preview */
function questionHtml(item) {
  const q = item.ref;
  const m = q.question.match(/^Is this statement true\?\s*[“"](.+)[”"]\s*$/i);
  if (m) {
    return `Is this statement true?<span class="quote">${esc(m[1])}</span>`;
  }
  return esc(q.question);
}

/* =========================================================================
 * UI state
 * ========================================================================= */

const ui = {
  tab: 'practice',
  screen: 'home', // home | session | review | mock-home | mock | results | cheat
  session: null, // practice session
  mock: null, // mock session
  filters: { type: 'all', difficulty: 'all', unseen: false },
  review: null, // { kind: 'flags' | 'wrong', i }
  cheat: null, // { ch: null | category id }
  timer: null,
};

const mainEl = document.getElementById('main');
const headerSub = document.getElementById('headerSubtitle');
const backBtn = document.getElementById('backBtn');
/* The GitHub button lives directly in #headerRight and must survive re-renders,
 * so screen-specific header content goes into this separate slot. */
const headerExtra = document.getElementById('headerExtra');

function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('is-active', x.dataset.tab === tab));
}

/* =========================================================================
 * Practice
 * ========================================================================= */

/** The filtered pool for one category, several categories, or the whole pool. */
function poolFor(catId) {
  const cats = Array.isArray(catId) ? catId : catId ? [catId] : null;
  const pool = cats ? cats.flatMap((c) => DATA.byCat[c] || []) : DATA.all;
  const f = ui.filters;
  return pool.filter(
    (q) =>
      (f.type === 'all' || q.type === f.type) &&
      (f.difficulty === 'all' || q.difficulty === f.difficulty) &&
      (!f.unseen || !store.seen[q.id])
  );
}

/** Display name for a category, or for several joined with " + ". */
function catTitle(catId) {
  if (!catId) return 'All questions';
  return (Array.isArray(catId) ? catId : [catId])
    .map((id) => (CAT_BY_ID[id] || {}).name || id)
    .join(' + ');
}

function startPractice({ catId = null, title, ids = null, limit = 0 } = {}) {
  let pool = ids ? ids.map((id) => DATA.byId[id]).filter(Boolean) : poolFor(catId);
  pool = shuffle(pool);
  if (limit > 0) pool = pool.slice(0, limit);
  if (!pool.length) {
    toast('No questions match these filters');
    return;
  }
  ui.session = {
    mode: 'practice',
    catId,
    title: title || catTitle(catId),
    items: pool.map((q) => instantiate(q)),
    i: 0,
    answered: 0,
    correct: 0,
  };
  stopTimer();
  ui.mock = null;
  ui.screen = 'session';
  setTab('practice');
  render();
}

function currentItem() {
  if (ui.screen === 'mock') return ui.mock ? ui.mock.items[ui.mock.i] : null;
  return ui.session ? ui.session.items[ui.session.i] : null;
}

/** Record one attempt. Answering a question correctly clears it from "Retry wrong". */
function recordResult(id, isCorrect) {
  store.seen[id] = 1;
  if (isCorrect) {
    store.right[id] = (store.right[id] || 0) + 1;
    delete store.wrong[id];
  } else {
    store.wrong[id] = (store.wrong[id] || 0) + 1;
  }
}

function recordAnswer(item, isCorrect) {
  recordResult(item.id, isCorrect);
  saveStore();
}

function checkAnswer() {
  const s = ui.session;
  const item = currentItem();
  if (!item || item.revealed) return;
  if (item.selected.size !== item.answer.length) {
    toast('Select ' + item.answer.length + ' answer' + (item.answer.length > 1 ? 's' : ''));
    return;
  }
  item.revealed = true;
  item.correct = sameSet(item.selected, item.answer);
  s.answered++;
  if (item.correct) s.correct++;
  recordAnswer(item, item.correct);
  render();
}

function nextQuestion() {
  const s = ui.session;
  if (s.i < s.items.length - 1) {
    s.i++;
    render();
  } else {
    finishPractice();
  }
}

function prevQuestion() {
  if (ui.session.i > 0) {
    ui.session.i--;
    render();
  }
}

function finishPractice() {
  const s = ui.session;
  const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
  toast(`Session done — ${s.correct}/${s.answered} (${pct}%)`);
  ui.screen = 'home';
  ui.session = null;
  render();
}

/* =========================================================================
 * Mock test
 * ========================================================================= */

function activeMockRaw() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_MOCK_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function saveActiveMock() {
  const m = ui.mock;
  if (!m || m.submitted) return;
  try {
    localStorage.setItem(
      ACTIVE_MOCK_KEY,
      JSON.stringify({
        ids: m.items.map((it) => it.id),
        order: m.order,
        i: m.i,
        deadline: m.deadline,
        // Persist the option permutation alongside the selections: the indexes
        // are only meaningful against the order they were chosen in.
        optionOrder: m.items.map((it) => it.optionOrder),
        selections: m.items.map((it) => [...it.selected]),
        flags: m.items.map((it) => !!it.flagged),
      })
    );
  } catch (e) {
    /* ignore */
  }
}

function clearActiveMock() {
  try {
    localStorage.removeItem(ACTIVE_MOCK_KEY);
  } catch (e) {
    /* ignore */
  }
}

function buildMockPool() {
  const picked = [];
  for (const catId of CAT_ORDER) {
    const n = MOCK.weights[catId] || 0;
    if (!n) continue;
    let pool = shuffle(DATA.byCat[catId] || []);
    // stable-sort so unseen questions come first, keeping random order within groups
    pool = pool.sort((a, b) => (store.seen[a.id] ? 1 : 0) - (store.seen[b.id] ? 1 : 0));
    picked.push(...pool.slice(0, n));
  }
  return shuffle(picked);
}

function startMock() {
  if (DATA.all.length < MOCK.total) {
    toast('Not enough questions for a mock');
    return;
  }
  const items = buildMockPool().map((q) => instantiate(q));
  // order == display order; instance options already shuffled
  ui.session = null;
  ui.mock = {
    items,
    order: items.map((it) => it.id),
    i: 0,
    deadline: Date.now() + MOCK.minutes * 60 * 1000,
    startedAt: Date.now(),
    submitted: false,
    result: null,
  };
  saveActiveMock();
  ui.screen = 'mock';
  setTab('mock');
  startTimer();
  render();
}

function resumeMock() {
  const raw = activeMockRaw();
  if (!raw) return;
  // Rebuild by index, not after filtering, so each saved selection stays paired
  // with the question it belongs to even if the pool has changed underneath.
  const items = [];
  (raw.ids || []).forEach((id, idx) => {
    const q = DATA.byId[id];
    if (!q) return;
    const it = instantiate(q, raw.optionOrder && raw.optionOrder[idx]);
    const sel = (raw.selections && raw.selections[idx]) || [];
    it.selected = new Set(sel);
    it.flagged = !!store.flags[q.id];
    items.push(it);
  });
  ui.session = null;
  ui.mock = {
    items,
    order: raw.order || raw.ids,
    i: raw.i || 0,
    deadline: raw.deadline,
    startedAt: raw.deadline - MOCK.minutes * 60 * 1000,
    submitted: false,
    result: null,
  };
  ui.screen = 'mock';
  setTab('mock');
  startTimer();
  render();
}

function startTimer() {
  stopTimer();
  ui.timer = setInterval(() => {
    const m = ui.mock;
    if (!m || m.submitted) return stopTimer();
    const left = (m.deadline - Date.now()) / 1000;
    const el = document.getElementById('mockTimer');
    if (el) {
      el.textContent = fmtTime(left);
      el.classList.toggle('low', left <= 300);
    }
    if (left <= 0) {
      stopTimer();
      toast('Time is up — submitting');
      submitMock(true);
    }
  }, 250);
}

function stopTimer() {
  if (ui.timer) {
    clearInterval(ui.timer);
    ui.timer = null;
  }
}

/** Flag the current question (in practice or a mock) and remember it for review. */
function toggleFlag() {
  const it = currentItem();
  if (!it) return;
  it.flagged = !it.flagged;
  if (it.flagged) store.flags[it.id] = 1;
  else delete store.flags[it.id];
  saveStore();
  saveActiveMock();
  render();
}

function mockGoto(i) {
  ui.mock.i = i;
  saveActiveMock();
  render();
}

function submitMock(auto) {
  const m = ui.mock;
  if (!m || m.submitted) return;
  stopTimer();
  m.submitted = true;

  const perCat = {};
  let correct = 0;
  for (const it of m.items) {
    const isCorrect = sameSet(it.selected, it.answer);
    it.correct = isCorrect;
    it.revealed = true;
    if (isCorrect) correct++;
    const c = it.ref.category;
    perCat[c] = perCat[c] || { correct: 0, total: 0 };
    perCat[c].total++;
    if (isCorrect) perCat[c].correct++;
    recordResult(it.id, isCorrect);
  }
  const timeUsed = Math.min(MOCK.minutes * 60, Math.round((Date.now() - m.startedAt) / 1000));
  const pass = correct >= MOCK.pass;
  const record = { date: Date.now(), correct, total: m.items.length, pass, timeUsed, perCat };
  store.mocks.unshift(record);
  store.mocks = store.mocks.slice(0, 50);
  saveStore();
  clearActiveMock();

  m.result = record;
  ui.screen = 'results';
  if (auto) toast('Auto-submitted at 45:00');
  render();
}

/* =========================================================================
 * Rendering
 * ========================================================================= */

function render() {
  headerExtra.innerHTML = '';
  backBtn.hidden =
    (ui.screen === 'home' || ui.screen === 'mock-home') && !(ui.tab === 'cheat' && ui.cheat && ui.cheat.ch);
  headerSub.textContent =
    {
      practice: 'Practice',
      plan: 'Study plan',
      mock: 'Mock test',
      stats: 'Statistics',
      cheat: 'Cheat sheet',
      user: 'User',
    }[ui.tab] || 'Practice';

  if (ui.screen === 'session') return renderPractice();
  if (ui.screen === 'review') return renderReview();
  if (ui.screen === 'mock') return renderMock();
  if (ui.screen === 'results') return renderResults();
  if (ui.tab === 'plan') return renderPlan();
  if (ui.tab === 'mock') return renderMockHome();
  if (ui.tab === 'stats') return renderStats();
  if (ui.tab === 'cheat') return renderCheatsheet();
  if (ui.tab === 'user') return renderUser();
  return renderPracticeHome();
}

/* ---------- practice: home ---------- */

function renderPracticeHome() {
  const f = ui.filters;
  const total = DATA.all.length;
  const unseenCount = DATA.all.filter((q) => !store.seen[q.id]).length;
  const wrongCount = Object.keys(store.wrong).length;
  const flagCount = Object.keys(store.flags).length;
  const newCount = DATA.batchNew.length;

  const typeChips = [
    ['all', 'All types'],
    ['single', 'Single'],
    ['truefalse', 'True/False'],
    ['two', 'Which TWO'],
    ['statement', 'Statement'],
  ]
    .map(
      ([v, t]) =>
        `<button class="chip ${f.type === v ? 'is-on' : ''}" data-action="filter" data-key="type" data-val="${v}">${t}</button>`
    )
    .join('');

  const diffChips = [
    ['all', 'Any'],
    ['easy', 'Easy'],
    ['medium', 'Medium'],
    ['hard', 'Hard'],
  ]
    .map(
      ([v, t]) =>
        `<button class="chip ${f.difficulty === v ? 'is-on' : ''}" data-action="filter" data-key="difficulty" data-val="${v}">${t}</button>`
    )
    .join('');

  const rows = CATEGORIES.map((c) => {
    const n = poolFor(c.id).length;
    const sheet = cheatChapter(c.id);
    return `<div class="cat-line">
      <button class="cat-row" data-action="start-cat" data-cat="${c.id}">
        <span class="cat-dot" style="background:${c.color}"></span>
        <span class="cat-name">${esc(c.name)}</span>
        <span class="cat-meta">${n} Q</span>
        <span class="cat-chev">›</span>
      </button>
      ${
        sheet
          ? `<button class="cheat-btn" data-action="cheat-open" data-ch="${c.id}"
               aria-label="Cheat sheet for ${esc(c.name)}" title="Cheat sheet for this chapter">📄</button>`
          : ''
      }
    </div>`;
  }).join('');

  mainEl.innerHTML = `
    <p class="lede">Practise by category, or target the questions you keep getting wrong. Options are shuffled each time.</p>

    <div class="card">
      <div class="field" style="border-bottom:none;padding-bottom:2px">
        <label><strong>${total}</strong> questions in the pool · <span class="muted">${unseenCount} not yet seen</span></label>
      </div>
      <div class="mt small muted">Type</div>
      <div class="chips">${typeChips}</div>
      <div class="small muted">Difficulty</div>
      <div class="chips">${diffChips}</div>
      <div class="field">
        <label for="unseenToggle">Only questions I haven't seen</label>
        <span class="switch">
          <input type="checkbox" id="unseenToggle" data-action="filter-toggle" data-key="unseen" ${f.unseen ? 'checked' : ''}>
          <span class="track"></span>
        </span>
      </div>
    </div>

    <h2 class="section">By category</h2>
    ${rows}

    <h2 class="section">Targeted practice</h2>
    <div class="card">
      <div class="btn-row">
        <button class="btn secondary" data-action="start-wrong" ${wrongCount ? '' : 'disabled'}>
          🔁 Retry wrong (${wrongCount})
        </button>
        <button class="btn secondary" data-action="review-open" data-list="wrong" ${
          wrongCount ? '' : 'disabled'
        }>
          📖 Review wrong (${wrongCount})
        </button>
      </div>
      <div class="btn-row mt">
        <button class="btn secondary" data-action="review-open" data-list="flags" ${
          flagCount ? '' : 'disabled'
        }>
          🚩 Review flagged (${flagCount})
        </button>
        <button class="btn secondary" data-action="start-quick">⚡ Quick 10</button>
      </div>
      <div class="btn-row mt">
        <button class="btn" data-action="start-all">▶️ Practise all ${poolFor(null).length} questions</button>
      </div>
    </div>

    <h2 class="section">New questions</h2>
    <div class="card">
      <p class="small muted">The ${newCount} questions added in the most recent batch.</p>
      <div class="btn-row mt">
        <button class="btn" data-action="start-new" ${newCount ? '' : 'disabled'}>✨ Practise new (${newCount})</button>
      </div>
    </div>

    <h2 class="section">Links</h2>
    <div class="app-grid">
      <a class="app-tile" id="ghTile" href="${GH.url}" target="_blank" rel="noopener noreferrer">
        <span class="app-ico gh" aria-hidden="true">${GH_ICON}</span>
        <span class="app-label">GitHub</span>
        <span class="app-sub" id="ghTileStars">${ghStarsText()}</span>
      </a>
      <a class="app-tile" href="https://www.gov.uk/life-in-the-uk-test" target="_blank" rel="noopener noreferrer">
        <span class="app-ico gov" aria-hidden="true">🇬🇧</span>
        <span class="app-label">Official test</span>
        <span class="app-sub">GOV.UK</span>
      </a>
    </div>
  `;
}

/* ---------- cheat sheet ---------- */

/** The cheat-sheet chapter that backs a pool category (null when it is missing). */
function cheatChapter(id) {
  return (DATA.cheat && DATA.cheat.chapters.find((c) => c.id === id)) || null;
}

/**
 * Render one section's blocks. The HTML is escaped and assembled by
 * tools/build-cheatsheet.js, so nothing here needs to sanitise it again.
 */
function cheatBlocks(blocks) {
  return blocks
    .map((b) => {
      if (b.t === 'p') return `<p>${b.html}</p>`;
      if (b.t === 'quote') {
        return `<blockquote>${b.paras.map((p) => `<p>${p.join('<br>')}</p>`).join('')}</blockquote>`;
      }
      if (b.t === 'ul') {
        return `<ul class="cheat-list">${b.items
          .map(
            (it) =>
              `<li>${it.html}${
                it.sub && it.sub.length
                  ? `<ul class="cheat-list">${it.sub.map((s) => `<li>${s}</li>`).join('')}</ul>`
                  : ''
              }</li>`
          )
          .join('')}</ul>`;
      }
      if (b.t === 'table') {
        return `<div class="cheat-scroll"><table class="cheat-table${
          b.head.length > 3 ? ' wide' : ''
        }">
            <thead><tr>${b.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
          </table></div>`;
      }
      return '';
    })
    .join('');
}

function renderCheatsheet() {
  const doc = DATA.cheat;
  if (!doc || !doc.chapters.length) {
    mainEl.innerHTML = `<div class="card"><p class="muted">The cheat sheet has not been cached on this device yet. Connect once and it will stay available offline.</p></div>`;
    return;
  }
  const chId = ui.cheat && ui.cheat.ch;
  const chapter = chId ? doc.chapters.find((c) => c.id === chId) : null;

  const chips = `<div class="chips">
    ${doc.chapters
      .map(
        (c) =>
          `<button class="chip ${
            chapter && chapter.id === c.id ? 'is-on' : ''
          }" data-action="cheat-open" data-ch="${c.id}">${c.ch}. ${esc(c.chip)}</button>`
      )
      .join('')}
    <button class="chip ${chapter ? '' : 'is-on'}" data-action="cheat-open">All chapters</button>
  </div>`;

  if (!chapter) {
    const rows = doc.chapters
      .map(
        (c) => `<button class="cat-row" data-action="cheat-open" data-ch="${c.id}">
          <span class="cat-dot" style="background:${(CAT_BY_ID[c.id] || {}).color || 'var(--muted)'}"></span>
          <span class="cat-name">${c.ch}. ${esc(c.name)}</span>
          <span class="cat-meta">${c.sections.length} section${c.sections.length === 1 ? '' : 's'}</span>
          <span class="cat-chev">›</span>
        </button>`
      )
      .join('');
    mainEl.innerHTML = `
      <p class="lede">Revision notes, split the same way as the question pool. Facts are current to 2026; where the handbook has moved on, the older figure is noted in brackets.</p>
      ${chips}
      <h2 class="section">By chapter</h2>
      ${rows}`;
    return;
  }

  mainEl.innerHTML = `
    <p class="lede"><strong>${chapter.ch}. ${esc(chapter.name)}</strong> — revision notes for this chapter.</p>
    ${chips}
    ${chapter.sections
      .map((s) => `<h2 class="section">${esc(s.title)}</h2><div class="card">${cheatBlocks(s.blocks)}</div>`)
      .join('')}`;
}

/* ---------- practice: session ---------- */

function renderPractice() {
  const s = ui.session;
  const item = currentItem();
  const q = item.ref;
  const cat = CAT_BY_ID[q.category];
  const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;

  headerSub.textContent = s.title;

  mainEl.innerHTML = `
    <div class="q-progress">
      <span>${s.i + 1}/${s.items.length}</span>
      <span class="progress-bar"><span style="width:${((s.i + 1) / s.items.length) * 100}%"></span></span>
      <span>${pct}% (${s.correct}/${s.answered})</span>
    </div>

    <div class="card">
      <div class="q-meta">
        <span class="pill" style="color:${cat.color};border-color:${cat.color}">${esc(cat.name)}</span>
        <span class="pill type">${TYPE_LABEL[q.type] || q.type}</span>
        <span class="pill">${esc(q.subcategory)}</span>
        <span class="pill">${q.difficulty}</span>
      </div>
      <div class="q-text">${questionHtml(item)}</div>
      ${optionsHtml(item)}
      ${feedbackHtml(item)}
    </div>

    <div class="actions">
      ${
        item.revealed
          ? `<div class="btn-row">
               <button class="btn secondary" data-action="prev" ${s.i === 0 ? 'disabled' : ''}>‹ Previous</button>
               <button class="btn" data-action="next">${s.i === s.items.length - 1 ? 'Finish' : 'Next ›'}</button>
             </div>`
          : `<button class="btn" data-action="check">Check answer</button>`
      }
      <div class="btn-row mt">
        <button class="btn secondary" data-action="toggle-flag">${
          item.flagged ? '🚩 Flagged for review' : '⚐ Flag for review'
        }</button>
      </div>
    </div>
  `;
}

function optionsHtml(item) {
  return `<div class="options">${item.options
    .map((opt, idx) => {
      let cls = 'opt';
      const selected = item.selected.has(idx);
      if (selected) cls += ' is-selected';
      if (item.revealed) {
        if (item.answer.includes(idx)) cls += ' is-correct';
        else if (selected) cls += ' is-wrong';
      }
      const letter = String.fromCharCode(65 + idx);
      return `<button class="${cls}" data-action="pick" data-idx="${idx}" ${item.revealed ? 'disabled' : ''}>
          <span class="mark">${item.revealed && item.answer.includes(idx) ? '✓' : letter}</span>
          <span>${esc(opt)}</span>
        </button>`;
    })
    .join('')}</div>`;
}

function feedbackHtml(item) {
  if (!item.revealed) return '';
  const correctText = item.answer.map((i) => item.options[i]).join(' and ');
  if (item.correct) {
    return `<div class="feedback ok"><strong>✅ Correct</strong>${esc(item.ref.explanation)}</div>`;
  }
  return `<div class="feedback bad"><strong>❌ Not quite — the answer is: ${esc(correctText)}</strong>${esc(
    item.ref.explanation
  )}</div>`;
}

/* ---------- practice: review flagged / wrong ---------- */

const REVIEW_TITLES = { flags: 'Flagged questions', wrong: 'Wrong answers' };

/** Ids in a review list, ordered by category then question number. */
function reviewIds(kind) {
  const src = kind === 'flags' ? store.flags : kind === 'wrong' ? store.wrong : null;
  if (!src) return [];
  return Object.keys(src)
    .filter((id) => DATA.byId[id])
    .sort((a, b) => {
      const qa = DATA.byId[a];
      const qb = DATA.byId[b];
      return (
        CAT_ORDER.indexOf(qa.category) - CAT_ORDER.indexOf(qb.category) || numFromId(a) - numFromId(b)
      );
    });
}

function openReview(kind) {
  if (!reviewIds(kind).length) {
    toast(kind === 'flags' ? 'No flagged questions yet' : 'No wrong answers to review');
    return;
  }
  ui.review = { kind, i: 0 };
  ui.screen = 'review';
  setTab('practice');
  render();
}

/** Read-only browse of the questions you flagged or got wrong, with the answer shown. */
function renderReview() {
  const r = ui.review;
  const ids = r ? reviewIds(r.kind) : [];
  if (!ids.length) {
    ui.review = null;
    ui.screen = 'home';
    return render();
  }
  const i = Math.max(0, Math.min(r.i, ids.length - 1));
  r.i = i;
  const q = DATA.byId[ids[i]];
  const cat = CAT_BY_ID[q.category] || UNKNOWN_CAT;

  const opts = q.options
    .map(
      (o, idx) =>
        `<div class="ropt"><span>${String.fromCharCode(65 + idx)}</span><span>${esc(o)}</span></div>`
    )
    .join('');

  headerSub.textContent = REVIEW_TITLES[r.kind] || 'Review';

  mainEl.innerHTML = `
    <div class="q-progress">
      <span>${i + 1}/${ids.length}</span>
      <span class="progress-bar"><span style="width:${((i + 1) / ids.length) * 100}%"></span></span>
      <span>${r.kind === 'flags' ? '🚩 flagged' : 'wrong ' + (store.wrong[q.id] || 0) + '×'}</span>
    </div>

    <div class="card">
      <div class="q-meta">
        <span class="pill" style="color:${cat.color};border-color:${cat.color}">${esc(cat.name)}</span>
        <span class="pill type">${TYPE_LABEL[q.type] || q.type}</span>
        <span class="pill">${esc(q.subcategory)}</span>
        <span class="pill">${q.difficulty}</span>
        <span class="pill">${q.id}</span>
      </div>
      <div class="q-text">${esc(q.question)}</div>
      ${opts}
      <p class="small muted">Answer hidden — use <strong>Practise these</strong> to answer them and see the explanation.</p>
    </div>

    <div class="actions">
      <div class="btn-row">
        <button class="btn secondary" data-action="review-prev" ${i === 0 ? 'disabled' : ''}>‹ Previous</button>
        <button class="btn secondary" data-action="review-next" ${
          i === ids.length - 1 ? 'disabled' : ''
        }>Next ›</button>
      </div>
      <div class="btn-row mt">
        <button class="btn" data-action="review-practise">▶️ Practise these (${ids.length})</button>
        <button class="btn secondary" data-action="review-remove">${
          r.kind === 'flags' ? '🚩 Remove flag' : '✅ Got it, remove'
        }</button>
      </div>
    </div>
  `;
}

/* ---------- mock: home ---------- */

function renderMockHome() {
  const raw = activeMockRaw();
  const last = store.mocks[0];
  const best = store.mocks.reduce((b, m) => (m.correct > (b ? b.correct : -1) ? m : b), null);

  mainEl.innerHTML = `
    <p class="lede">A full simulation: ${MOCK.total} questions, ${MOCK.minutes} minutes, pass mark ${MOCK.pass}/${MOCK.total} (75%). Questions cover all five chapters using <strong>estimated</strong> chapter proportions (history-heavy) — the Home Office does not publish an official split of questions per chapter.</p>

    ${raw ? `<div class="card">
        <strong>Resume your mock</strong>
        <p class="small muted mt">You have a mock in progress with ${fmtTime((raw.deadline - Date.now()) / 1000)} left on the clock.</p>
        <div class="btn-row mt">
          <button class="btn" data-action="resume-mock">Resume</button>
          <button class="btn secondary" data-action="discard-mock">Discard</button>
        </div>
      </div>` : ''}

    <div class="card">
      <div class="stat-grid">
        <div class="stat-box"><div class="n">${MOCK.total}</div><div class="l">Questions</div></div>
        <div class="stat-box"><div class="n">${MOCK.minutes} min</div><div class="l">Time limit</div></div>
      </div>
      <div class="btn-row mt">
        <button class="btn" data-action="start-mock">Start mock test</button>
      </div>
    </div>

    ${
      store.mocks.length
        ? `<h2 class="section">Recent attempts</h2>
           <div class="card">
             ${best ? `<p class="small muted">Best: <strong>${best.correct}/${best.total}</strong></p>` : ''}
             <div class="breakdown mt">
               ${store.mocks
                 .slice(0, 6)
                 .map(
                   (m) => `<div class="bd-row">
                     <span>${new Date(m.date).toLocaleDateString()} · ${fmtTime(m.timeUsed)}</span>
                     <span><strong>${m.correct}/${m.total}</strong> ${m.pass ? '✅' : '❌'}</span>
                     <span class="bd-bar"><span style="width:${(m.correct / m.total) * 100}%"></span></span>
                   </div>`
                 )
                 .join('')}
             </div>
           </div>`
        : ''
    }
  `;
}

/* ---------- mock: in progress ---------- */

function renderMock() {
  const m = ui.mock;
  const item = currentItem();
  const q = item.ref;
  const cat = CAT_BY_ID[q.category];
  const left = (m.deadline - Date.now()) / 1000;
  const answered = m.items.filter((it) => it.selected.size).length;

  headerSub.textContent = 'Mock test';
  headerExtra.innerHTML = `<span class="timer ${left <= 300 ? 'low' : ''}" id="mockTimer">${fmtTime(left)}</span>`;

  mainEl.innerHTML = `
    <div class="q-progress">
      <span>Question ${m.i + 1} of ${m.items.length}</span>
      <span class="progress-bar"><span style="width:${((m.i + 1) / m.items.length) * 100}%"></span></span>
      <span>${answered} answered</span>
    </div>

    <div class="card">
      <div class="q-meta">
        <span class="pill">${TYPE_LABEL[q.type] || q.type}</span>
        <span class="pill">${esc(q.subcategory)}</span>
      </div>
      <div class="q-text">${questionHtml(item)}</div>
      ${optionsHtml(item)}
    </div>

    <div class="actions">
      <div class="btn-row">
        <button class="btn secondary" data-action="mock-prev" ${m.i === 0 ? 'disabled' : ''}>‹</button>
        <button class="btn secondary" data-action="mock-flag">${item.flagged ? '🚩 Flagged' : '⚐ Flag'}</button>
        <button class="btn" data-action="mock-next" ${m.i === m.items.length - 1 ? 'disabled' : ''}>›</button>
      </div>
    </div>

    <h2 class="section">Question map</h2>
    <div class="card">
      <div class="grid">
        ${m.items
          .map(
            (it, idx) =>
              `<button class="${it.selected.size ? 'answered' : ''} ${it.flagged ? 'flagged' : ''} ${
                idx === m.i ? 'current' : ''
              }" data-action="mock-goto" data-idx="${idx}">${idx + 1}</button>`
          )
          .join('')}
      </div>
      <div class="btn-row mt">
        <button class="btn danger" data-action="submit-mock">Submit test</button>
      </div>
    </div>
  `;
}

/* ---------- results ---------- */

function renderResults() {
  const r = ui.mock.result;
  headerSub.textContent = 'Results';

  const cats = CAT_ORDER.filter((c) => r.perCat[c]);
  const breakdown = cats
    .map((c) => {
      const d = r.perCat[c];
      return `<div class="bd-row">
          <span>${esc(CAT_BY_ID[c].name)}</span>
          <span><strong>${d.correct}/${d.total}</strong></span>
          <span class="bd-bar"><span style="width:${(d.correct / d.total) * 100}%"></span></span>
        </div>`;
    })
    .join('');

  const review = ui.mock.items
    .map((item, idx) => {
      const correctText = item.answer.map((i) => item.options[i]).join(' and ');
      const opts = item.options
        .map((opt, i) => {
          let cls = 'ropt';
          if (item.answer.includes(i)) cls += ' correct';
          else if (item.selected.has(i)) cls += ' wrong';
          const tag = item.answer.includes(i) ? '✓' : item.selected.has(i) ? '✗' : '';
          return `<div class="${cls}"><span>${tag}</span><span>${esc(opt)}</span></div>`;
        })
        .join('');
      const yours = item.selected.size
        ? item.selected
            .values()
            .map((i) => item.options[i])
            .toArray()
            .join(' and ')
        : 'No answer';
      return `<div class="review-item">
          <div class="rq">${idx + 1}. ${questionHtml(item)}</div>
          ${opts}
          <div class="small">Your answer: <strong>${esc(yours)}</strong>${item.correct ? ' ✅' : ' ❌'}</div>
          <div class="rexp">${esc(item.ref.explanation)}</div>
        </div>`;
    })
    .join('');

  mainEl.innerHTML = `
    <div class="card">
      <div class="big-score">
        <div><span class="val">${r.correct}</span><span class="of">/${r.total}</span></div>
        <div><span class="badge ${r.pass ? 'pass' : 'fail'}">${r.pass ? 'PASS' : 'FAIL'}</span></div>
        <p class="small muted mt">Pass mark ${MOCK.pass}/${MOCK.total} · Time used ${fmtTime(r.timeUsed)}</p>
      </div>
    </div>

    <h2 class="section">By category</h2>
    <div class="card"><div class="breakdown">${breakdown}</div></div>

    <div class="btn-row">
      <button class="btn" data-action="start-mock">🔁 New mock</button>
      <button class="btn secondary" data-action="home">Done</button>
    </div>

    <h2 class="section">Review all questions</h2>
    ${review}
  `;
}

/* ---------- user (per-person progress) ---------- */

function statFor(s, total) {
  const seen = Object.keys(s.seen || {}).length;
  const right = Object.values(s.right || {}).reduce((a, b) => a + b, 0);
  const wrong = Object.values(s.wrong || {}).reduce((a, b) => a + b, 0);
  const attempts = right + wrong;
  return {
    seen: seen,
    total: total,
    acc: attempts ? Math.round((right / attempts) * 100) : 0,
    attempts: attempts,
    mocks: (s.mocks || []).length,
    best: (s.mocks || []).reduce((m, r) => Math.max(m, r.correct || 0), 0),
    planDone: planDoneCount(s),
    planDays: planDef(s.planId).days.length,
  };
}

function renderUser() {
  const u = activeUser();
  const total = DATA.base.length;

  const people = profiles.order
    .map((id) => profiles.byId[id])
    .filter(Boolean)
    .map((p) => {
      const isActive = p.id === profiles.active;
      const st = statFor(isActive ? store : p.saved || defaultStore(), total);
      const bits = [st.seen + '/' + total + ' seen'];
      if (st.attempts) bits.push(st.acc + '% correct');
      if (st.mocks) bits.push(st.mocks + (st.mocks === 1 ? ' mock' : ' mocks'));
      return `<button class="person-row${isActive ? ' is-active' : ''}" data-action="switch-user" data-id="${esc(p.id)}">
        <span class="cat-dot"${isActive ? ' style="background:var(--accent)"' : ''}></span>
        <span class="who"><b>${esc(p.name)}</b><span>${bits.join(' · ')}</span></span>
        <span class="cat-chev">${isActive ? '✓' : '›'}</span>
      </button>`;
    })
    .join('');

  if (!u) {
    mainEl.innerHTML = `
      <p class="lede">Enter a name to keep a record of your progress. Everything stays in this browser — nothing is sent anywhere.</p>
      <div class="card">
        <label class="f-label" for="userName">Your name</label>
        <input type="text" id="userName" maxlength="40" placeholder="e.g. Sam" autocomplete="off">
        <div class="btn-row mt">
          <button class="btn" data-action="save-user">Start tracking</button>
        </div>
      </div>`;
    return;
  }

  const st = statFor(store, total);
  mainEl.innerHTML = `
    <p class="lede">This device is tracking <strong>${esc(u.name)}</strong>. Progress is kept in this browser only.</p>
    <div class="card">
      <label class="f-label" for="userName">Name</label>
      <input type="text" id="userName" maxlength="40" value="${esc(u.name)}" autocomplete="off">
      <div class="btn-row mt">
        <button class="btn" data-action="save-user">Save name</button>
      </div>
    </div>

    <h2 class="section">${esc(u.name)}'s progress</h2>
    <div class="stat-grid">
      <div class="stat-box"><div class="n">${st.seen}</div><div class="l">Seen / ${total}</div></div>
      <div class="stat-box"><div class="n">${st.acc}%</div><div class="l">Correct</div></div>
      <div class="stat-box"><div class="n">${st.mocks}</div><div class="l">Mocks</div></div>
      <div class="stat-box"><div class="n">${st.best ? st.best + '/' + MOCK.total : '—'}</div><div class="l">Best mock</div></div>
      <div class="stat-box"><div class="n">${st.planDone}/${st.planDays}</div><div class="l">Plan days</div></div>
    </div>

    <h2 class="section">People on this device</h2>
    <div class="card">${people}</div>
    <div class="card">
      <label class="f-label" for="userNew">Add someone else</label>
      <input type="text" id="userNew" maxlength="40" placeholder="Their name" autocomplete="off">
      <div class="btn-row mt">
        <button class="btn secondary" data-action="add-user">Add person</button>
        <button class="btn secondary" data-action="delete-user">Remove ${esc(u.name)}</button>
      </div>
    </div>`;
}

/* ---------- stats ---------- */

function renderStats() {
  const totalSeen = Object.keys(store.seen).length;
  const rightAll = Object.values(store.right).reduce((a, b) => a + b, 0);
  const wrongAll = Object.values(store.wrong).reduce((a, b) => a + b, 0);
  const attempts = rightAll + wrongAll;
  const accuracy = attempts ? Math.round((rightAll / attempts) * 100) : 0;
  const best = store.mocks.reduce((b, m) => (m.correct > (b ? b.correct : -1) ? m : b), null);

  const perCat = CAT_ORDER.map((c) => {
    const pool = DATA.byCat[c] || [];
    let r = 0,
      w = 0;
    for (const q of pool) {
      r += store.right[q.id] || 0;
      w += store.wrong[q.id] || 0;
    }
    const seen = pool.filter((q) => store.seen[q.id]).length;
    return { c, r, w, seen, total: pool.length };
  });

  const catRows = perCat
    .map(({ c, r, w, seen, total }) => {
      const attempts = r + w;
      const pct = attempts ? Math.round((r / attempts) * 100) : 0;
      return `<div class="bd-row">
          <span>${esc(CAT_BY_ID[c].name)}</span>
          <span class="muted small">${seen}/${total} seen · ${attempts ? pct + '%' : '—'}</span>
          <span class="bd-bar"><span style="width:${pct}%"></span></span>
        </div>`;
    })
    .join('');

  const weakest = DATA.all
    .map((q) => ({ q, w: store.wrong[q.id] || 0, r: store.right[q.id] || 0 }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w || a.r - b.r)
    .slice(0, 8);

  mainEl.innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><div class="n">${totalSeen}</div><div class="l">Seen</div></div>
      <div class="stat-box"><div class="n">${accuracy}%</div><div class="l">Accuracy</div></div>
      <div class="stat-box"><div class="n">${store.mocks.length}</div><div class="l">Mocks taken</div></div>
      <div class="stat-box"><div class="n">${best ? best.correct + '/' + best.total : '—'}</div><div class="l">Best mock</div></div>
    </div>

    <h2 class="section">Accuracy by category</h2>
    <div class="card"><div class="breakdown">${catRows}</div></div>

    ${
      weakest.length
        ? `<h2 class="section">Trouble spots</h2>
           <div class="card">
             ${weakest
               .map(
                 (x) =>
                   `<div class="small" style="margin-bottom:8px">• ${esc(
                     x.q.question.length > 110 ? x.q.question.slice(0, 107) + '…' : x.q.question
                   )}<br><span class="muted">${esc(CAT_BY_ID[x.q.category].name)} · wrong ${x.w}×</span></div>`
               )
               .join('')}
           </div>`
        : ''}

    <h2 class="section">Data</h2>
    <div class="card">
      <p class="small muted">Attempts recorded: ${attempts} · Pool size: ${DATA.all.length}</p>
      <div class="btn-row mt">
        <button class="btn secondary" data-action="reset-stats">Reset all progress</button>
      </div>
    </div>
  `;
}

/* =========================================================================
 * Study plan
 * ========================================================================= */

function planToday(totalDays = currentPlan().days.length) {
  if (!store.testDate) return null;
  const test = new Date(store.testDate + 'T00:00:00');
  if (isNaN(test.getTime())) return null;

  // Count whole calendar days, never absolute milliseconds: subtracting
  // 27 * 86400000 ms lands an hour short whenever the span crosses a DST
  // change, and the extra hour then truncates a day off the result.
  const DAY = 86400000;
  const midnightUtc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

  const start = new Date(test.getTime());
  start.setDate(start.getDate() - (totalDays - 1));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const day = Math.round((midnightUtc(today) - midnightUtc(start)) / DAY) + 1;
  const daysToTest = Math.round((midnightUtc(test) - midnightUtc(today)) / DAY);
  return { day, daysToTest };
}

function renderPlan() {
  const plan = currentPlan();
  const done = planDoneMap();
  const total = plan.days.length;
  const doneCount = plan.days.filter((d) => done[d.d]).length;
  const pt = planToday(total);
  const todayDay = pt && pt.day >= 1 && pt.day <= total ? pt.day : null;
  const pct = Math.round((doneCount / total) * 100);

  const selector = PLAN_ORDER.map(
    (id) =>
      `<button class="chip ${id === plan.id ? 'is-on' : ''}" data-action="set-plan" data-plan="${id}">${
        PLANS[id].chip
      }</button>`
  ).join('');

  const milestones = plan.milestones
    .map(
      (m) => `<div class="bd-row">
        <span>Day ${m.day}</span>
        <span><strong>${m.target}</strong></span>
        <span class="bd-bar"><span style="width:${done[m.day] ? 100 : 0}%"></span></span>
        <span class="small muted" style="grid-column:1/-1">${esc(m.note)}</span>
      </div>`
    )
    .join('');

  const weeks = Object.keys(plan.weeks)
    .map(Number)
    .sort((a, b) => a - b)
    .map((w) => {
      const days = plan.days
        .filter((d) => d.w === w)
        .map((d) => {
          const isDone = !!done[d.d];
          const isToday = todayDay === d.d;
          const go = d.go
            ? `<button class="btn secondary plan-go" data-action="${d.go.action}"${
                d.go.cat ? ` data-cat="${d.go.cat}"` : ''
              }${d.go.cats ? ` data-cats="${d.go.cats.join(',')}"` : ''}${
                d.go.tab ? ` data-tab="${d.go.tab}"` : ''
              }>${esc(d.go.label)}</button>`
            : '';
          return `<div class="plan-day${isDone ? ' is-done' : ''}${isToday ? ' is-today' : ''}">
            <button class="plan-check" data-action="plan-toggle" data-day="${d.d}" aria-label="Mark day ${d.d} complete">${
            isDone ? '✓' : ''
          }</button>
            <div class="plan-body">
              <div class="plan-head"><strong>Day ${d.d}</strong><span class="plan-focus">${esc(d.t)}</span>${
            isToday ? '<span class="pill">Today</span>' : ''
          }</div>
              <ul class="plan-tasks">${d.k.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
              ${go}
            </div>
          </div>`;
        })
        .join('');
      return `<h2 class="section">${esc(plan.weeks[w])}</h2><div class="card plan-card">${days}</div>`;
    })
    .join('');

  // If the test date is set, suggest the longest plan that still fits. A plan of
  // N days starts on testDate - (N - 1), so N - 1 days of runway is the most it
  // can use; with less than that, day 1 would already be in the past.
  let suggestion = '';
  if (pt && pt.daysToTest >= 1) {
    const fits = (id) => pt.daysToTest <= PLANS[id].days.length - 1;
    const fit = fits('1w') ? '1w' : fits('2w') ? '2w' : fits('4w') ? '4w' : null;
    const days = pt.daysToTest === 1 ? 'day' : 'days';
    if (!fit) {
      suggestion = `<p class="small muted">Your test is in <strong>${pt.daysToTest}</strong> ${days} — further out than the 4-week plan reaches (its day 1 is 27 days before the test). Come back to this tab when the date is closer.</p>`;
    } else if (fit !== plan.id) {
      suggestion = `<p class="small muted">Your test is in <strong>${pt.daysToTest}</strong> ${days} — the ${PLANS[fit].name} fits. <button class="chip plan-suggest" data-action="set-plan" data-plan="${fit}">Use it</button></p>`;
    }
  }

  mainEl.innerHTML = `
    <p class="lede">${esc(plan.lede)}</p>

    <h2 class="section">Your timeline</h2>
    <div class="chips">${selector}</div>

    <div class="card">
      <div class="q-progress">
        <span>${doneCount}/${total} days</span>
        <span class="progress-bar"><span style="width:${pct}%"></span></span>
        <span>${pct}%</span>
      </div>
      <div class="field" style="border-bottom:none">
        <label for="testDate">Test date</label>
        <input type="date" id="testDate" data-action="set-test-date" value="${store.testDate || ''}">
      </div>
      ${
        pt
          ? `<p class="small muted">${
              pt.daysToTest > 0
                ? `<strong>${pt.daysToTest}</strong> ${pt.daysToTest === 1 ? 'day' : 'days'} to go`
                : pt.daysToTest === 0
                ? 'Test is today — good luck!'
                : 'Test date has passed'
            }${todayDay ? ` · you are on <strong>day ${todayDay}</strong> of the plan` : ''}</p>`
          : `<p class="small muted">Set your test date for a countdown and to see which day you are on.</p>`
      }
      ${suggestion}
    </div>

    <h2 class="section">Milestones</h2>
    <div class="card"><div class="breakdown">${milestones}</div></div>

    <div class="btn-row">
      <button class="btn secondary" data-action="go-tab" data-tab="practice">Go to practice</button>
      <button class="btn secondary" data-action="reset-plan">Reset plan</button>
    </div>

    ${weeks}
  `;
}

/** Trailing number in a question id — history-042 sorts as 42. */
function numFromId(id) {
  const m = /-(\d+)$/.exec(String(id || ''));
  return m ? Number(m[1]) : 0;
}

/* =========================================================================
 * Events
 * ========================================================================= */

backBtn.addEventListener('click', () => {
  if (ui.screen === 'session') {
    ui.session = null;
    ui.screen = 'home';
    render();
  } else if (ui.screen === 'review') {
    ui.review = null;
    ui.screen = 'home';
    render();
  } else if (ui.screen === 'results') {
    ui.screen = 'mock-home';
    render();
  } else if (ui.screen === 'mock') {
    saveActiveMock();
    ui.screen = 'mock-home';
    render();
  } else if (ui.tab === 'cheat' && ui.cheat && ui.cheat.ch) {
    ui.cheat.ch = null;
    render();
  } else {
    ui.screen = 'home';
    render();
  }
});

document.getElementById('tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  if (ui.screen === 'mock' && ui.tab !== btn.dataset.tab) {
    // leaving an in-progress mock: keep it saved
    saveActiveMock();
    stopTimer();
  }
  setTab(btn.dataset.tab);
  ui.screen = ui.tab === 'mock' ? 'mock-home' : 'home';
  render();
});

// the study-plan test date
mainEl.addEventListener('change', (e) => {
  const t = e.target.closest('[data-action="set-test-date"]');
  if (!t) return;
  store.testDate = t.value || null;
  saveStore();
  render();
});

mainEl.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;

  switch (a) {
    case 'filter':
      ui.filters[t.dataset.key] = t.dataset.val;
      render();
      break;
    case 'filter-toggle':
      ui.filters[t.dataset.key] = t.checked;
      render();
      break;
    case 'start-cat':
      startPractice({ catId: t.dataset.cat });
      break;
    case 'start-cats':
      startPractice({ catId: (t.dataset.cats || '').split(',').filter(Boolean) });
      break;
    case 'start-all':
      startPractice({ catId: null, title: 'All questions' });
      break;
    case 'cheat-open':
      ui.cheat = { ch: t.dataset.ch || null };
      ui.screen = 'home';
      setTab('cheat');
      render();
      break;
    case 'start-quick':
      startPractice({ catId: null, title: 'Quick 10', limit: 10 });
      break;
    case 'start-wrong': {
      const ids = Object.keys(store.wrong);
      startPractice({ ids, title: 'Retry wrong' });
      break;
    }
    case 'toggle-flag':
      toggleFlag();
      break;
    case 'review-open':
      openReview(t.dataset.list);
      break;
    case 'review-prev':
      if (ui.review && ui.review.i > 0) {
        ui.review.i--;
        render();
      }
      break;
    case 'review-next':
      if (ui.review && ui.review.i < reviewIds(ui.review.kind).length - 1) {
        ui.review.i++;
        render();
      }
      break;
    case 'review-practise':
      if (ui.review) {
        const kind = ui.review.kind;
        const ids = reviewIds(kind);
        ui.review = null;
        startPractice({ ids, title: REVIEW_TITLES[kind] || 'Review' });
      }
      break;
    case 'review-remove': {
      if (!ui.review) break;
      const ids = reviewIds(ui.review.kind);
      const id = ids[ui.review.i];
      if (!id) break;
      if (ui.review.kind === 'flags') delete store.flags[id];
      else delete store.wrong[id];
      saveStore();
      render();
      break;
    }
    case 'pick': {
      const item = currentItem();
      if (!item || item.revealed) break;
      const idx = Number(t.dataset.idx);
      const need = item.answer.length;
      if (need === 2) {
        if (item.selected.has(idx)) item.selected.delete(idx);
        else if (item.selected.size < 2) item.selected.add(idx);
        else {
          toast('Choose only two options');
          break;
        }
      } else {
        item.selected.clear();
        item.selected.add(idx);
      }
      if (ui.screen === 'mock') saveActiveMock();
      render();
      break;
    }
    case 'check':
      checkAnswer();
      break;
    case 'next':
      nextQuestion();
      break;
    case 'prev':
      prevQuestion();
      break;

    case 'save-user': {
      const el = document.getElementById('userName');
      renameUser(el ? el.value : '');
      break;
    }

    case 'add-user': {
      const el = document.getElementById('userNew');
      addUser(el ? el.value : '');
      break;
    }

    case 'switch-user':
      switchUser(t.dataset.id);
      break;

    case 'delete-user': {
      const u = activeUser();
      if (u && confirm('Remove ' + u.name + ' and their progress from this device?')) removeUser(u.id);
      break;
    }

    case 'start-new':
      startPractice({ ids: DATA.batchNew.map((q) => q.id), title: 'New questions' });
      break;
    case 'set-plan': {
      const id = t.dataset.plan;
      if (!PLANS[id]) break;
      store.planId = id;
      saveStore();
      render();
      toast(PLANS[id].name + ' selected');
      break;
    }
    case 'plan-toggle': {
      const d = Number(t.dataset.day);
      const done = planDoneMap();
      if (done[d]) delete done[d];
      else done[d] = 1;
      saveStore();
      render();
      break;
    }
    case 'reset-plan': {
      const plan = currentPlan();
      if (confirm(`Clear the ${plan.name}'s ticks and test date?`)) {
        store.plan[plan.id] = {};
        store.testDate = null;
        saveStore();
        render();
      }
      break;
    }
    case 'go-tab': {
      const tab = t.dataset.tab;
      if (ui.screen === 'mock' && ui.tab !== tab) {
        saveActiveMock();
        stopTimer();
      }
      setTab(tab);
      ui.screen = tab === 'mock' ? 'mock-home' : 'home';
      render();
      break;
    }

    case 'start-mock':
      startMock();
      break;
    case 'resume-mock':
      resumeMock();
      break;
    case 'discard-mock':
      clearActiveMock();
      render();
      break;
    case 'mock-prev':
      ui.mock.i = Math.max(0, ui.mock.i - 1);
      saveActiveMock();
      render();
      break;
    case 'mock-next':
      ui.mock.i = Math.min(ui.mock.items.length - 1, ui.mock.i + 1);
      saveActiveMock();
      render();
      break;
    case 'mock-flag':
      toggleFlag();
      break;
    case 'mock-goto':
      mockGoto(Number(t.dataset.idx));
      break;
    case 'submit-mock':
      if (confirm('Submit your test now?')) submitMock(false);
      break;
    case 'home':
      ui.screen = 'mock-home';
      ui.tab = 'mock';
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('is-active', x.dataset.tab === 'mock'));
      render();
      break;
    case 'reset-stats': {
      const u = activeUser();
      const msg = u
        ? `Reset ${u.name}'s progress and history? Other people on this device are not affected. This cannot be undone.`
        : 'Reset all progress and history? This cannot be undone.';
      if (confirm(msg)) {
        store = defaultStore();
        saveStore();
        clearActiveMock();
        render();
      }
      break;
    }
  }
});

// keyboard shortcuts for desktop users
document.addEventListener('keydown', (e) => {
  if (ui.screen !== 'session' && ui.screen !== 'mock') return;
  const item = currentItem();
  if (!item) return;
  const k = e.key.toUpperCase();
  if (/^[1-8]$/.test(k)) {
    const idx = Number(k) - 1;
    if (idx >= item.options.length) return;
    if (ui.screen === 'session' && item.revealed) return;
    const need = item.answer.length;
    if (need === 2) {
      if (item.selected.has(idx)) item.selected.delete(idx);
      else if (item.selected.size < 2) item.selected.add(idx);
      else toast('Choose only two options');
    } else {
      item.selected.clear();
      item.selected.add(idx);
    }
    if (ui.screen === 'mock') saveActiveMock();
    render();
  } else if (e.key === 'Enter') {
    if (ui.screen === 'session' && !item.revealed) checkAnswer();
    else if (ui.screen === 'session') nextQuestion();
  }
});

/* =========================================================================
 * GitHub link + star count
 *
 * This is the only part of the app that ever touches the network: an
 * optional, cached, best-effort read of the repo's public star count. With no
 * connection the count is simply hidden and the links still work.
 * ========================================================================= */

const GH_REPO = 'imnelsonchan-code/life-in-the-uk-test';
const GH = {
  repo: GH_REPO,
  url: 'https://github.com/' + GH_REPO,
  key: 'liuk_gh_stars_v1',
  ttlMs: 6 * 60 * 60 * 1000, // don't ask GitHub more than once every 6 hours
  stars: null,
};

const GH_ICON =
  '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>' +
  '</svg>';

/** 1234 -> "1.2k". */
function fmtCount(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
}

function ghStarsText() {
  if (GH.stars == null) return 'Star the project';
  return '★ ' + fmtCount(GH.stars) + (GH.stars === 1 ? ' star' : ' stars');
}

/** Paint the star count into every place that shows it (header + home tile). */
function applyStars(n) {
  GH.stars = n;
  const head = document.getElementById('ghCount');
  if (head) {
    head.textContent = n == null ? '' : '★ ' + fmtCount(n);
    head.hidden = n == null;
  }
  const tile = document.getElementById('ghTileStars');
  if (tile) tile.textContent = ghStarsText();
}

function readStarCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(GH.key) || 'null');
    if (raw && typeof raw.n === 'number' && typeof raw.t === 'number') return raw;
  } catch (e) {
    /* corrupt cache — treat as empty */
  }
  return null;
}

function initGithub() {
  const btn = document.getElementById('ghBtn');
  if (btn) {
    btn.href = GH.url;
    const ico = btn.querySelector('.gh-ico');
    if (ico && !ico.firstChild) ico.innerHTML = GH_ICON;
  }

  const cached = readStarCache();
  if (cached) applyStars(cached.n);
  if (cached && Date.now() - cached.t < GH.ttlMs) return;
  if (navigator.onLine === false) return;

  fetch('https://api.github.com/repos/' + GH.repo, {
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j || typeof j.stargazers_count !== 'number') return;
      try {
        localStorage.setItem(GH.key, JSON.stringify({ n: j.stargazers_count, t: Date.now() }));
      } catch (e) {
        /* storage full or blocked — the count just won't be cached */
      }
      applyStars(j.stargazers_count);
    })
    .catch(() => {
      /* offline or rate-limited: leave the count hidden, nothing else changes */
    });
}

/* =========================================================================
 * Install — "Add to Home Screen"
 *
 * The header button shows unless the app is already running as an installed
 * app. On Chromium it fires the browser's own install prompt; elsewhere it
 * explains the menu route, because iOS Safari and Firefox give the page no
 * install API at all.
 * ========================================================================= */

const INSTALL = { prompt: null, done: false, btn: null };

function isStandalone() {
  return (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ claims to be a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function refreshInstallButton() {
  if (!INSTALL.btn) return;
  INSTALL.btn.hidden = INSTALL.done || isStandalone();
}

function installHint() {
  if (isIos()) return 'Tap Share, then "Add to Home Screen"';
  return 'Open your browser menu and choose "Install app" or "Add to Home screen"';
}

function installNow() {
  const p = INSTALL.prompt;
  INSTALL.prompt = null; // a captured prompt can only be spent once
  if (!p) {
    toast(installHint(), 6000);
    return;
  }
  let choice = null;
  try {
    p.prompt();
    choice = p.userChoice;
  } catch (e) {
    // A few browsers expose the event but refuse the call (no user gesture);
    // fall back to telling the user where the menu entry lives.
    toast(installHint(), 6000);
    return;
  }
  Promise.resolve(choice)
    .then((c) => {
      if (c && c.outcome === 'accepted') {
        INSTALL.done = true;
        toast('Installed — open it from your home screen');
      }
    })
    .catch(() => {})
    .then(refreshInstallButton);
}

function initInstall() {
  INSTALL.btn = document.getElementById('installBtn');
  if (!INSTALL.btn) return;
  INSTALL.btn.addEventListener('click', installNow);
  refreshInstallButton();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep the prompt back for our own button
    INSTALL.prompt = e;
    refreshInstallButton();
  });
  window.addEventListener('appinstalled', () => {
    INSTALL.done = true;
    INSTALL.prompt = null;
    refreshInstallButton();
    toast('Installed — open it from your home screen');
  });
}

/* Offline: a service worker that serves the app from cache when the network is
 * gone. Registered over https/localhost only, and only where supported. The
 * `?v=` on our own <script> names the cache, so each deploy (which rewrites it
 * to the commit) starts a fresh one and the old cache is dropped. */
function assetVersion() {
  const tag = document.querySelector('script[src*="app.js"]');
  const m = tag && /[?&]v=([^&"]+)/.exec(tag.getAttribute('src') || '');
  return m ? m[1] : 'dev';
}

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (location.protocol !== 'https:' && !local) return;
  const start = () =>
    navigator.serviceWorker.register('sw.js?v=' + assetVersion()).catch(() => {
      /* no offline copy this time; the app itself is unaffected */
    });
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

/* =========================================================================
 * Boot
 * ========================================================================= */

(async function boot() {
  try {
    await loadData();
    render();
    initGithub();
    initInstall();
    initServiceWorker();
  } catch (err) {
    mainEl.innerHTML = `
      <div class="card">
        <h2>Could not load the question pool</h2>
        <p class="small muted">${esc(err.message)}</p>
        <p class="small muted">Make sure the app is served over http (e.g. via Docker) rather than opened as a local file.</p>
      </div>`;
  }
})();
