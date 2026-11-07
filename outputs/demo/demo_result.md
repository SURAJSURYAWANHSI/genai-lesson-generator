# Assessment demonstration result

- Run ID: `0823a331-ce32-4d60-a0f8-4a889522f6ee`
- Provider: gemini (gemini-3.6-flash)
- Mock mode: False
- Status: PASS after 2 generations
- Injection: missing_practical_example, detected True, corrected True

| # | Step | Result | Detail |
|---|---|---|---|
| 1 | Generate initial lesson | OK | version 1 from gemini |
| 2 | Inject the deliberate error | OK | missing_practical_example |
| 3 | Evaluator identifies Q07 failure | OK | failed: ['Q07'] |
| 4 | Lesson receives FAIL status | OK | FAIL |
| 5 | Rejection log records evidence | OK | Deterministic validator: The 'example_walkthrough' section is empty. The practical example |
| 6 | Retry agent generates correction feedback | OK | revise: ['practical_example', 'example_walkthrough'] |
| 7 | Generator creates revised lesson | OK | changed: ['practical_example', 'example_walkthrough'] |
| 8 | Evaluator checks revised lesson | OK | 2 evaluations |
| 9 | Lesson passes all criteria | OK | 10/10 PASS |
| 10 | Final lesson is published | OK | status PASS, version 2 |
| 11 | Rejection log remains accessible | OK | 1 entries at /lessons/0823a331-ce32-4d60-a0f8-4a889522f6ee/rejections |
| 12 | Memory records the correction strategy | OK | Q07 strategy from this run |
