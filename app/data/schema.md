# Question schema (v1)

Every question lives in `app/data/questions/<category>.json` as a JSON array of
question objects.

## Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | `<prefix>-<4 digits>`, unique across the whole pool |
| `category` | string | yes | one of the 5 category IDs (see below) |
| `subcategory` | string | yes | kebab-case finer topic, e.g. `tudors`, `parliament` |
| `type` | string | yes | `single` \| `truefalse` \| `two` \| `statement` |
| `difficulty` | string | yes | `easy` \| `medium` \| `hard` |
| `question` | string | yes | the question text, no trailing spaces |
| `options` | string[] | yes | see counts below |
| `answer` | number[] | yes | indexes into `options` (0-based) |
| `explanation` | string | yes | shown on the review screen |
| `source` | string | yes | provenance note |
| `batch` | string | no | set to `new` on the most recently added batch, so the app can show those questions as their own section; absent means part of the original pool |

## Categories and ID prefixes

| `category` | `id` prefix | File |
| --- | --- | --- |
| `values_principles` | `val` | `values_principles.json` |
| `what_is_uk` | `uk` | `what_is_uk.json` |
| `history` | `hist` | `history.json` |
| `modern_society` | `soc` | `modern_society.json` |
| `government_law` | `gov` | `government_law.json` |

## Option and answer rules per type

| `type` | `options` length | `answer` length | Shape of question |
| --- | --- | --- | --- |
| `single` | 4 | 1 | "Which ...?" / "What ...?" |
| `truefalse` | 2 (`["True", "False"]`) | 1 | A statement ending in "?" e.g. `Is this statement true? "..."` |
| `two` | 4 or 5 | 2 | Must start with "Which TWO ..." |
| `statement` | 4 | 1 | "Which of these statements is correct?" with 4 candidate statements |

`answer` indexes must be unique and within `[0, options.length)`.

## Example objects

```json
{
  "id": "hist-0007",
  "category": "history",
  "subcategory": "magna-carta",
  "type": "single",
  "difficulty": "easy",
  "question": "In 1215, which king agreed to Magna Carta?",
  "options": ["King John", "Henry VIII", "Richard III", "Charles I"],
  "answer": [0],
  "explanation": "King John agreed to Magna Carta in 1215. It limited the power of the monarch and is seen as an early foundation of the rule of law.",
  "source": "Original practice question based on public handbook facts"
}
```

```json
{
  "id": "gov-0031",
  "category": "government_law",
  "subcategory": "parliament",
  "type": "two",
  "difficulty": "easy",
  "question": "Which TWO bodies make up the UK Parliament?",
  "options": ["The House of Commons", "The Senate", "The House of Lords", "The Supreme Court"],
  "answer": [0, 2],
  "explanation": "Parliament has two Houses: the elected House of Commons and the House of Lords. There is no Senate in the UK.",
  "source": "Original practice question based on public handbook facts"
}
```

## Answer-array awareness in the app

The app must handle `answer` arrays of length 1 or 2. For `two` questions, a response
scores only if the selected set exactly equals the `answer` set.
