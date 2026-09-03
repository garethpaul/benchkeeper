# Research and selection

Research pass: 2026-09-03, beginning 04:22 UTC. New independent project. The user subsequently approved **Benchkeeper** as the project name.

## Competition facts

The official rules give four equally weighted criteria. We map each to 25 points: WebMCP Leverage, Execution, Potential Impact, Creativity & Ambition. Registration and submission close September 3, 2026 at 13:00 Pacific / 20:00 UTC. Eligibility includes age, residence, affiliation/conflict, ownership and funding restrictions; user status is unknown. Registration requires the user's Devpost account and consent. [Rules](https://webmcp.devpost.com/rules)

Required publishing artifacts are a working hosted URL, a public repository with an open-source license, an English description and a publicly visible narrated YouTube demonstration shorter than three minutes. These are deliberately not being published in this phase. [Overview](https://webmcp.devpost.com/)

The resource page advises entrants to choose their own name and warns against overstating implementation. It says submitted artifacts should remain unchanged after the deadline through judging/winner announcement; preserve an immutable submitted release if the user later publishes. [Resources](https://webmcp.devpost.com/resources)

OpenAI frames the challenge around people and agents using the same app, not simply adding a chatbot. Its deadline agrees with Devpost; the opening time differs by one hour, irrelevant now. [OpenAI challenge](https://openai.com/webmcp-challenge/)

## Technology findings

The September 2 draft places `modelContext` on **Document**, not Navigator. Registration is asynchronous; AbortSignal manages registration lifetime. `getTools` / `executeTool` are in the current draft. The draft is not a W3C Standard. Local Chrome 152 confirmed this location but **requires JSON-string execution input**, whereas the draft describes an object. A read-only probe verifies both shapes before the rehearsal chooses one. No mutation is retried. [Specification](https://webmachinelearning.github.io/webmcp/)

Chrome documents local testing via `chrome://flags/#enable-webmcp-testing`, an origin trial beginning with Chrome 149, origin isolation, and the `tools` Permissions Policy. [Chrome overview](https://developer.chrome.com/docs/ai/webmcp) · [Origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial)

Current imperative examples use `document.modelContext.registerTool`; cleanup semantics have changed across versions. Our callbacks will validate inputs independently, return structured strings, and avoid depending on draft-only approval facilities. [Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)

Chrome's security advice treats tool hints as signals, not authorization. Tool output may be untrusted. Cross-origin exposure must be deliberate. A same-page confirmation is not protection from an agent or extension with arbitrary DOM/JavaScript access. The product will have no network-side execution, payments, messages or physical repair instructions. [Tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)

Deterministic tool tests do not establish an LLM's ability to select correct tools. Evaluation must separately measure intent, ordering, arguments and whole journeys. Native registration/calls and scripted replay will be labelled separately from agent evaluation. [Evals](https://developer.chrome.com/docs/ai/webmcp/evals) · [DevTools testing](https://developer.chrome.com/docs/devtools/application/webmcp)

The supplied OpenAI MCP guide describes **remote servers**, including a FastMCP search/fetch example. It is not the browser API and will not be used as our WebMCP implementation. [API MCP server guide](https://developers.openai.com/api/docs/mcp)

Cloudflare's React template uses shared page-local state, localStorage, lifecycle cleanup, validation and an unsupported-browser notice. We read its README, package manifest, App and Wrangler config. Our smaller original app will use Vite plus a static-assets Worker, not its todo implementation or remote MCP bridge. [Template](https://github.com/cloudflare/agents/tree/main/examples/webmcp-react) · [Browser Run WebMCP](https://developers.cloudflare.com/browser-run/features/webmcp/)


## Candidate comparison

Scores below are **prospective design estimates**, conditional on a complete verified build. They are not achieved scores, judge predictions or probabilities of winning. In each row: WebMCP / Execution / Impact / Creativity, each out of 25.

| Candidate | Specific product and agent contribution | Precedent and critical weakness | Prospective score |
|---|---|---|---|
| Repair-event recovery desk | Organizer protects promised appointments; agent compares feasible schedules after a volunteer cancellation, missing part or uncertain duration. Shared timeline, explainable exclusions, human-approved diff. | RepairManager already handles live queues; novelty must be counterfactual recovery and promise preservation, not queue CRUD. No organizer interview yet. | **24 / 23 / 22 / 22 = 91** |
| Library-of-things substitution desk | Borrower gives a project; agent builds available equipment bundles across dates, substitutes alternatives, leaves reservations for approval. | myTurn already supports inventory, reservations and locations. Compatibility of tool substitutes would require trusted domain data. | 22 / 23 / 21 / 20 = 86 |
| Accessible event rehearsal | Organizer and agent walk an event itinerary against individual access preferences; expose missing evidence instead of claiming universal accessibility. | AccessNow covers accessibility discovery and mapping; meaningful validation needs disabled users and venue evidence. Cannot safely invent access facts. | 23 / 21 / 23 / 22 = 89 |
| Food-rescue disruption desk | Dispatcher compares volunteer/destination reallocations when pickups change, with visible need and timing constraints. | Food Rescue Hero has mature scheduling, dispatch and safety flags. Live inventory, routing, partner data and food-safety boundaries make a short build less credible. | 23 / 20 / 24 / 20 = 87 |
| Repair-parts pooling board | Nearby events co-plan shared parts, consolidate needs and propose transfers without automatic purchases. | RepairMonitor documents parts barriers, but part compatibility and local inventory are the hard problem; a synthetic catalog risks a shallow demonstration. | 21 / 21 / 22 / 22 = 86 |
| Shared evidence editor for local grants | Agent maps draft claims to source excerpts, marks unsupported claims, preserves human commitments and creates review bundles. | OpenAI Margin Editor already demonstrates shared-document comments and agent identity. Reliable grant requirements add legal/factual risks and an overcrowded document-tool category. | 21 / 23 / 20 / 18 = 82 |

### Primary evidence and precedents actually examined

- Repair Café's July 2026 survey summary reports 946 responses across 30 countries; 31% cited finding suitable volunteers and 17% too many items as concerns. More than 80% record event details on paper. This supports a capacity-coordination problem, **not** demonstrated demand for this exact app. [Survey](https://www.repaircafe.org/en/repair-cafes-attract-1-5-million-visitors-every-year/)
- Repair Café's own house rules address waiting and limit repeat queue entries. The proposed planner estimates examination appointments, not successful repairs or equipment safety. [House rules](https://www.repaircafe.org/en/house-rules/)
- RepairManager offers registration, queue tracking, testing records and updates. Circularity offers self-check-in and a live repair queue. We do not claim to invent repair-event software. [RepairManager](https://landing.repairmanager.co.uk/) · [Circularity source](https://github.com/Zesty0wl/circularity-repair-cafe-hub)
- Restarters' event kit and Fixometer cover running events and recording outcomes. The proposed work is a planning layer before/while allocations change, not a substitute for those records. [Restart Party Kit](https://talk.restarters.net/t/how-to-run-a-repair-event-the-restart-party-kit/324)
- RepairMonitor identifies parts as a repair barrier. Do not turn estimated slots into claims about objects saved, avoided emissions or completed repairs. [2024 factsheet](https://www.repaircafe.org/wp-content/uploads/2025/04/Factsheet_RepairMonitor_2024_EN.pdf)
- myTurn offers asset management, reservations, reminders and multi-location lending. [Product](https://myturn.com/home/)
- AccessNow supports finding and reviewing locations by accessibility features; experiences are person-specific. [Product](https://accessnow.com/) · [Mapping guide](https://accessnow.com/mapmissionguide/)
- Food Rescue Hero combines dispatch, volunteer coordination and operational tracking. A generic rescue optimizer would duplicate a mature product. [Product](https://foodrescuehero.org/our-product/)
- OpenAI's Margin Editor keeps agent comments attached to documents; WanderNote keeps edits/comments tied to an itinerary and map. These establish a useful collaboration pattern but make another generic planner less distinctive. [Margin Editor](https://developers.openai.com/showcase/margin-editor) · [WanderNote](https://developers.openai.com/showcase/wandernote)

## Decision and falsifiable quality bar

Build ONE repair-event recovery desk. Its distinctive interaction is: **a human protects a promise; an agent explores a disruption; both inspect exactly who moves and who still cannot fit; only the human applies a chosen plan.** A cancellation that invalidates a protected appointment must produce an explicit conflict, never silently unlock it. An agent gets structured capacity reasons rather than reading colored pixels.

The 91-point prospective estimate is credible only if native tools, complete custom-data flows, diff/approval/staleness protections, bounded scheduling with honest limitations, accessible UI, and a two-minute useful story are demonstrated. Without these, reduce the score. Real organizer feedback and natural-language agent evaluation are significant remaining gaps. No invented testimonials or adoption statistics.

## Assumption ledger

| Claim | Kind / confidence | Status and consequence |
|---|---|---|
| Current document API | Primary technical / high | Read current draft + Chrome docs; native Document registration/calls now verified in Chrome 151/152. API drift remains a compatibility risk. |
| Volunteer scarcity and event congestion | Primary survey / high | Documented; does not validate this workflow's usability. |
| Promise-preserving recovery is meaningfully different | Inference / medium | Compared public feature descriptions, not exhaustive market search. Must show counterfactuals clearly. |
| A small local-only planner is useful | Product hypothesis / medium | Needs custom intake, backup/export and organizer feedback. |
| Synthetic durations predict real repairs | Unsupported / low | Rejected. They are organizer estimates; expose uncertainty and never claim repair outcomes. |
| 90+ achieved | Internal estimate, not independently validated | Current demonstrated-build estimate90; selected concept's91 remains prospective. See `rubric-review.md` for evidence and deductions. |
| User eligibility | Unknown | User must review official requirements and make attestations. |
| Native tool calls imply agent success | False | Keep deterministic browser evidence separate from LLM journey evals. |

## First build scope

Deterministic example event, editable intake, volunteer availability, protected assignments, a bounded deterministic schedule search, visible scenario assumptions, exclusion reasons, proposed-versus-current comparison, human approval/rejection, stale-plan detection, audit history, backup/import, reset, native WebMCP with honest fallback, unit and browser tests, loopback-only Vite and local workerd. No remote MCP server or model API is needed inside the app; the user's browser agent supplies intelligence.


## Follow-up workflow evidence (September 3, 2026)

The target is more specific than “all repair cafés”: small **pre-booked or hybrid walk-in/appointment events** whose organizers already allocate repairer time. Repair Café International says most events do not require advance registration, so a rigid appointment planner is not universally appropriate. [Visitor FAQ](https://www.repaircafe.org/en/faq/)

The Restart Project's April 2026 guide shows a reception/triage desk using paper or a spreadsheet, repairer recording sheets, and a separate waiting area. It also treats volunteers' availability and different skills as organizer responsibilities. This supports a human-led planning desk and a future paper-friendly output, not replacing repairers' judgment. [2026 event guide](https://therestartproject.org/wp-content/uploads/2026/04/Restarts-Guide-to-Community-Repair-Events-April-2026.pdf)

The capacity implementation now enumerates all eligible discrete starts for an excluded request. It identifies the smallest count of unprotected appointments overlapping a potential slot, then offers a separate full priority preview. The local witness is exact within the recorded grid; the full replan remains a bounded search. This distinction prevents an “opening” from masquerading as a complete plan for displaced visitors.


Cambridge Carbon Footprint's organizer handbook describes booking and walk-in variants, skill-based job allocation, and a shared registration sheet with unique item IDs. It recommends keeping a portion of a three-hour event available for walk-ins. We therefore added explicit reserved-time blocks for walk-ins and repairer breaks, rather than treating every unassigned minute as freely bookable. Its other operational and insurance policies are not implemented or replaced by this planner. [Organizer handbook, sections 10 and 12](https://cambridgecarbonfootprint.org/wp-content/uploads/2025/07/0.-Repair-Cafe-handbook.pdf)


## Later primary-source critique

RepairManager already offers pre-registration, allocation tracking, status displays, audit trails and multi-café roles. Benchkeeper should not claim to replace that operational breadth. Its narrower proposed contribution is a temporary, shared disruption-planning workspace with protected promises and explicit trade-offs, followed by a paper handoff. Lack of integration with existing intake systems remains an adoption cost. [RepairManager product page](https://landing.repairmanager.co.uk/)

Repair Café's July 2026 interview with Ochtrup organizers reports practical AI experimentation but also hallucinations and the continuing need for human expertise. It is an anecdotal primary account, not evidence for Benchkeeper or a controlled productivity estimate. It reinforces keeping this product out of repair diagnosis and safety advice. [Organizer interview](https://www.repaircafe.org/en/how-can-ai-benefit-repair-cafes/)

Two product deductions from this critique are now implemented: tab-local app storage does not imply that an external browser agent keeps tool data on-device (disclosed in UI/docs); and a configurable start time avoids unnecessarily excluding otherwise suitable three-hour events. Start time locks after intake/roster creation so existing clock constraints and appointments cannot silently shift.

The 08:10 [critical rubric review](rubric-review.md) estimates90/100 for the demonstrated local build, separately from the selected concept's prospective91. The one-point change from89 is tied to verified spreadsheet intake addressing a previously recorded setup deduction. It is not an independent score, proof of organizer usefulness or a prediction of the result.


## Workflow fit and precedent check, 09:59 UTC

A second pass checked concrete organizer workflows, not just the general need for repair events. These sources describe their own services; none is a Benchkeeper user study or endorsement.

| Primary example | What the source establishes | Fit or mismatch with this build |
|---|---|---|
| [HRRA regional event](https://hrra.org/repaircafe/) | Registered visitors receive 30-minute appointments; walk-ins join a first-come queue. Visitors stay at the fixing station, and multiple items return to the queue after the first repair. | Supports a hybrid appointment/reserve workflow. Benchkeeper does not operate that live queue or enforce one-person/multiple-item attendance conflicts. Labels are not unique person identities. |
| [REMO organizer ticket page](https://events.humanitix.com/remo-repair-cafe-september-2026/tickets) | Ticket descriptions offer 45-minute repairer slots at successive times. | A second concrete appointment format fits the recorded 15-minute grid. This says nothing about this organizer's demand for replanning software. The page header and ticket descriptions disagree about the event's starting meridiem; no schedule recommendation is inferred. |
| [Salisbury pre-event manual](https://sites.google.com/salisburyrepaircafe.org/src-manual/03-operations/Pre-Cafe-Admin) | The 2022 manual derives capacity from volunteer availability, maintains booking spreadsheets, configures SimplyBook.me and prints booking lists. It also describes five-minute arrival slots and pooled repair-team capacity. | Supports the preparation and paper-handoff problem, but its team/arrival-slot model cannot be imported directly into this one-repairer-at-a-time, 15-minute planner. Historical instructions are not proof of its current operation. |

[RepairManager](https://landing.repairmanager.co.uk/) already advertises pre-registration, allocation/repair/testing stages, audit trails and live displays. [Circularity's event guide](https://github.com/Zesty0wl/circularity-repair-cafe-hub/blob/main/docs/05-running-an-event.md) and [repairer guide](https://github.com/Zesty0wl/circularity-repair-cafe-hub/blob/main/docs/repairer-guide.md) cover check-in, a shared live queue, accepting work and recording outcomes. These are broader operational systems; Benchkeeper should not claim those capabilities or imply they lack unadvertised planning features.

The adjacent commercial product [BenchKey advertises appointments](https://benchkey.com/features/appointments) and an [AI setup assistant](https://benchkey.com/features/ai-assistant). That further weakens any generic “AI for repair scheduling” novelty claim. The demonstrated distinction must remain the shared disruption comparison, source-bound review and exact local displacement explanation. The user has approved the name **Benchkeeper**. The adjacent name remains a research observation, not a name-availability or trademark-clearance claim.

No source here establishes that organizers want another separate app, will prepare the required columns, or can use the 24-request ceiling. The internal 90-point estimate remains uncertain and unchanged; additional citations do not earn points. No booking, account login, contact, survey response or external-system mutation was performed.

## Historical API check, September 3, 15:45 UTC

A real Chrome 146 build exposes the older Navigator API, while the current tested 151/152/155 builds expose Document. The historical native read/rehearsal and registration-lifecycle checks are now recorded in [verification](verification.md#native-registration-lifetime-across-api-generations). They revealed a cleanup difference; no older-browser recommendation or broader compatibility guarantee follows. This does not change the published-criteria score.
