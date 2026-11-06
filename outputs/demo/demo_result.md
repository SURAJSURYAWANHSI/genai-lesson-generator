# Assessment demonstration result

- Run ID: `091e79a9-17d1-40ab-96b9-636f2d8aa31c`
- Provider: mock (mock-rule-based-v1)
- Mock mode: True
- Status: PASS after 2 generations
- Injection: missing_practical_example, detected True, corrected True

| # | Step | Result | Detail |
|---|---|---|---|
| 1 | Generate initial lesson | OK | version 1 from mock |
| 2 | Inject the deliberate error | OK | missing_practical_example |
| 3 | Evaluator identifies Q07 failure | OK | failed: ['Q07'] |
| 4 | Lesson receives FAIL status | OK | FAIL |
| 5 | Rejection log records evidence | OK | Deterministic validator: The 'example_walkthrough' section is empty. The practical example |
| 6 | Retry agent generates correction feedback | OK | revise: ['practical_example', 'example_walkthrough'] |
| 7 | Generator creates revised lesson | OK | changed: ['practical_example', 'example_walkthrough'] |
| 8 | Evaluator checks revised lesson | OK | 2 evaluations |
| 9 | Lesson passes all criteria | OK | 10/10 PASS |
| 10 | Final lesson is published | OK | status PASS, version 2 |
| 11 | Rejection log remains accessible | OK | 1 entries at /lessons/091e79a9-17d1-40ab-96b9-636f2d8aa31c/rejections |
| 12 | Memory records the correction strategy | OK | Q07 strategy from this run |
