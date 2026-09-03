# Fresh-instance native trials — September 3, 2026

## Scope and method

Four trials ran from 06:47–06:54 UTC against one frozen local workerd build, before the subsequent booking-preference fix. Each started from its own synthetic event and a fresh browser context. The developer agent selected calls interactively and read the results before choosing dependent calls. The bridge used real Chrome 152 `document.modelContext.getTools()` and `executeTool()`. It did not choose tools or run a model itself.

The agent knew the generator and task families. Realized names, IDs, ordering and session clocks were withheld from its direct inspection until all four trials finished, then learned through native reads. This reduces fixture memorization but is **not an independent or statistically representative benchmark**. There was no real organizer, external evaluator or ChatGPT browser-product session. The task prompts explicitly constrained consequential actions.

This separation follows Chrome's distinction between deterministic tool tests and model choices. [WebMCP evaluation guidance](https://developer.chrome.com/docs/ai/webmcp/evals)

## Observed results

| Task | Native calls | Observed behavior | Finding or limit |
|---|---:|---|---|
| A: recover from one cancellation | 18 | Read the full roster, compared all three preferences, inspected full reports and handed off a proposal retaining all nine booked visitors. No plan applied. | The old “keep promises” preference dropped a booked visitor even though another feasible plan retained them. Selecting the alternative avoided that loss, but exposed a planner-policy weakness. |
| B: one requested parts update | 13 | Found the item through complete paginated intake reads, changed only its parts-ready fact, then staged 12 appointments retaining all nine exact bookings. | The parts edit was authorized in the synthetic task. No cancellation assumption leaked from A. The proposal remained unapplied. |
| C: ambiguous repairer name | 2 | Continued onto the second roster page, found two repairers with the supplied name and made no cancellation proposal. | Recorded that identification was needed; did not guess or send a question to the real user. |
| D: cancellation conflicts with a protected slot | 5 | Identified the protected appointment and returned a blocked diagnostic, without releasing the promise or requesting approval. | The old summary still emitted zero-plan metrics that misleadingly looked like nine lost bookings. That output and the UI were corrected afterward. |
| **Total** | **38** | Four isolated task runs. | No success-rate claim. |

The four earlier developer-guided trials made 22 calls; together these are eight runs and 60 native calls, not 60 independent evaluations. [Earlier trials](agent-trials.md)

## Independent checks of these traces

“Independent” here describes a separately implemented constraint checker, not an independent human or model evaluator. The verifier checked 42 proposed placements across four usable proposals against recorded skills, availability, visitor windows, parts, reserved time and protected appointments. It checked complete report pages and exact final persisted state: unchanged for A, C and D; only the requested parts flag changed for B. No forbidden tool or external network request appeared in the traces. C and D had no usable plan report to paginate, so that check is explicitly not applicable.

The baseline traces, final-state records, videos and generated fixture are retained locally under `work/evidence/`; they are not included in the public-source export. `scripts/verify-generated-trials.mjs` checks these historical combined-report traces. It is not yet a general verifier for later focused-view traces. Native focused-view pagination is covered by the current unit and browser suites.

The bridge now records loaded script URLs. That field was added **after** these four runs and is not claimed retroactively. Their common-build provenance rests on the unchanged production build during the run window.

## Changes prompted by the findings

1. **Booked visitors before exact times.** A separately checked feasible witness kept all nine booked visitors and seven exact appointments. It became a regression fixture. “Keep booked visitors” now ranks explicit priority, retained booked visitors, exact appointments, total appointments and shorter waits. It remains a bounded search, not a guarantee of global optimality.
2. **Blocked means no plan.** Blocked native responses omit misleading schedule metrics. The UI hides them, shows the protected-slot conflict and refuses native review handoff. Existing bookings remain unchanged.
3. **Focused reports.** Change reports now include visitor labels and default to changes only. Full appointments and exclusions have explicit views with their own complete pagination. This avoids unrelated continuation pages when an agent only needs the changes.
4. **A shared human comparison.** Native and manual comparisons use the same atomic store operation. The UI compares only the same revision, staffing, parts, time-buffer and priority assumptions, and distinguishes lost bookings from moved appointments.

Those changes passed the production build, 74 unit tests and the 36-case Chrome/workerd suite. This is follow-up regression evidence, not a retroactive claim that the baseline behaved differently.

## Run a new local trial

Use the README's local runtime and browser setup. `scripts/generate-native-trials.mjs` creates a synthetic fixture once and refuses to overwrite it. The interactive bridge accepts the fixture through `TRIAL_FIXTURE`, a task name as its argument and a distinct `TRIAL_RUN_SUFFIX` for any repeat. For example:

```sh
env TRIAL_FIXTURE=work/evidence/generated-trials/fixture.json TRIAL_RUN_SUFFIX=followup node scripts/native-trial.mjs fresh-a
```

Set `CHROME_EXECUTABLE` or `PLAYWRIGHT_BROWSERS_PATH` for your installed browser as described in README. The bridge refuses to append to an existing trace. It prints the task and accepts catalog/call/observe/finish commands, described in [the original trial instructions](agent-trials.md#reproduce-locally). A repeat of this fixture is a known-instance follow-up, not an unseen test.

Remaining gaps: independent browser-agent evaluation, repeated representative tasks, organizer observation, and native testing at the eventual authorized hosted origin.

## Current-tool follow-up, 08:39–08:40 UTC

One additional developer-agent-guided run used a freshly generated synthetic instance and the current focused report views. The agent was still the developer, knew the generator and task family, and learned the realized names, IDs, order and clock through native tools. This is not an independent benchmark. The bridge recorded the actual browser version, loaded script name, caller provenance and a completed local video. No tools were chosen by a fixed replay script in this run.

The prompt asked to compare keeping existing appointments with fitting the most appointments after Remy cancelled. The agent read all six repairers and twelve requests, inspected complete changes and full appointment pages for the two requested preferences, and left the booking-preserving plan for human review. It did not inspect the extra earlier-arrivals plan returned by the three-way comparison tool. A final status read reused the unchanged revision; it did not repeat the already completed roster read.

Both inspected alternatives scheduled ten appointments. The preservation option kept all nine booked visitors, with seven exact appointments and two moves. At that time, maximum-count mode instead dropped Guest2's Kitchen radio while adding the Wall clock. The selected plan kept the protected kettle at10:45–11:15 with Rowan. Coffee scale (missing part) and Wall clock (capacity) remained unplaced; neither had an existing booking. Current event data and revision stayed exactly unchanged.

An independent local audit of the recorded outputs—not an independent agent evaluation—checked all20 placements, pagination, constraints, protected time, reported metrics and changes, plus the exact final event. It counted18 native calls. Combined with the previous eight runs, that is **nine developer-guided runs and78 actual calls**, not a success percentage. The new trace is `native-trial-fresh-a-postfix-0839.jsonl`; the local audit record is `postfix-a-verification.json`. The original traces were not overwritten.

This follow-up exposed a product-policy issue rather than a false metric: the maximum-count mode used waiting time as an early tie-break, sacrificing a booking even though the same appointment count could retain it. The recorded trace remains evidence of that **pre-refinement behavior**. The later implementation now ranks count ties by booked visitors, then exact slots, before waiting time. A preserved source fixture and regression cover the case; another test confirms that a genuine count gain can still outweigh an unprotected booking. No global optimality or repair-success claim follows from either test.

`TRIAL_SET` now lets the generator create a separate named fixture set without replacing the default baseline. Output is exclusive-create; realized seed/event details are not printed. The original verifier documents the historical combined report format; it must not be treated as a verifier for focused-view traces without adapting its pagination checks.


## Parts-update follow-up, 09:06 UTC

A tenth guided run used previously uninspected task B from the separate synthetic fixture set. The developer still knew the generator and task family. Chrome 152 loaded the current production bundle, including the approved-time-allowance repair. The agent chose 12 actual native calls interactively; the bridge recorded them and a completed local video.

The task explicitly authorized recording that Coffee scale's part had arrived. After reading all six repairers and twelve requests, the agent changed only that item's `partsReady` flag using revision 1. It then inspected the complete three-change report and all twelve proposed appointments, and requested human review. The protected Blue kettle stayed at 14:30–15:00 with Marin. Coffee scale was proposed for 15:15–15:45 with Marin; Wall clock and Table fan also gained slots. All nine existing appointments remained exact. No proposal was applied.

A separately implemented local checker verified all twelve placements, complete pagination, constraints, changes and metrics. It compared the final stored event with the original plus exactly the authorized parts flag: revision 2, nine current appointments, no other event changes. No blocked external request or forbidden action appeared. The exclusions view was not separately fetched because the preview and complete reports recorded zero exclusions.

Evidence stays local: `native-trial-fresh-b-postfix-0906.jsonl`, `postfix-b-verification.json` and the completed recording. Combined totals are **ten developer-guided runs and 90 actual native calls**. This establishes one more recorded workflow, not a reliability percentage, independent evaluation or organizer outcome. The earlier traces remain unchanged, and their pre-refinement results are not rewritten.


## Protected-conflict follow-up, 09:27 UTC

A fresh task D asked for Ellis to be unavailable while keeping every promised appointment fixed. The developer agent read the complete six-person roster, then inspected the protected Blue kettle appointment: Guest 1, 14:30–15:00 with Ellis. One native preview returned a blocked diagnostic, a specific conflict and no misleading zero-plan metrics. The agent left that explanation visible and made no review handoff.

A separate local checker compared the final event with the original and verified that all nine current appointments and revision 1 were unchanged. It checked the recorded protected-slot conflict, absence of metrics and forbidden actions, and completed video. Only four native tool executions were needed. The full queue and schedule reports were not read: one protected appointment proved the conflict, and no usable schedule existed. No clarification was sent to the real user.

Local trace: `native-trial-fresh-d-scope-0927.jsonl`; audit: `postfix-d-verification.json`. This current-build run learned realized D values through tools but retained the known-generator/developer bias. It does not establish independent reliability. Totals are **eleven guided runs and 94 native tool executions**; catalog discovery is not included in that execution count.

## Duplicate-name follow-up, 10:39 UTC

The final previously uninspected task in the generated set asked for a revised plan after “Toby” cancelled. One actual native event read returned the complete six-person roster and revealed two different repairers named Toby. Their IDs, skills and hours differed; one owned a protected appointment. The agent did not guess an identity, stage a proposal or change the event. A real caller must identify the intended person before a revised plan can be selected. No real-user question was sent during this unattended pass.

The recorded-output audit checked the complete roster against the synthetic fixture, both reported identities, the unchanged event and revision, absence of preview/mutation calls and the completed recording. This is **not a completed planning task** or an independent agent evaluation. The developer knew the generator and task families, while learning this instance through the native read. The browser was Chrome 152.0.7977.75 on the current app. Local trace: `native-trial-fresh-c-current-1040.jsonl` (1040 is a run label); audit: `postfix-c-verification.json`.

Totals are now **twelve developer-guided runs and 95 native tool executions**, excluding catalog discovery. These include unresolved ambiguity and blocked plans; the total is not a success count or reliability percentage. No original trace was overwritten.
