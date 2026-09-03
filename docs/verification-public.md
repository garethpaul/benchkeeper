# Verification summary

The product is live at [benchkeeper.gpj.workers.dev](https://benchkeeper.gpj.workers.dev), but has not been submitted to the challenge. Source is maintained in a private repository. This summary includes the September 3 local checks, refreshed media review and 17:19 UTC live-origin acceptance. The tested environment used Linux, with Node 24.13.1 plus isolated current Node 24.20.0 and 26.8.1 checks. Browser automation ran without the browser’s OS sandbox; that is a test-environment limitation, not an end-user recommendation.

## Latest complete local check

A fresh-source run completed at 16:43 UTC. The matching root build passed the full suite again at 17:15 immediately before deployment. The table describes local runtime checks; separate hosted-origin acceptance is recorded below.

| Check                              | Result                                                  |
| ---------------------------------- | ------------------------------------------------------- |
| Unit/integration                   | 110 passed                                              |
| Chrome 152                         | 70 passed: 52 native-enabled and 18 manual-only cases   |
| Firefox 153                        | 18 manual-only cases passed                             |
| Linux WebKit 26.5                  | 18 manual-only cases passed                             |
| Browser skips / unexpected / flaky | 0 / 0 / 0                                               |
| Served assets                      | All 21 match the built snapshot                         |
| Runtime, dry-run and cleanup       | Passed; source stayed unchanged; temporary ports closed |

**Hosted access is available.** The SSH forwarding restriction remains unchanged, but is not needed for the public hosted URL. At 17:19, six live HTTP/header cases and all 21 live asset hashes passed. Ordinary Chrome 152 completed manual planning at 320 px; separately enabled Chrome 152 registered ten real Document WebMCP tools and completed read, preview, change inspection and human-approval flows. Backup, reload, print preview and reset passed. No mock/polyfill or origin-trial token was used. See [deployment and live evidence](deployment-readiness.md).

## Detailed evidence and limits

### Build and reproducibility

**Production build.** TypeScript checks client, Worker and tests; Vite builds static assets. The Worker runs locally under Wrangler/workerd. No remote deployment was performed.

**Frozen runtime check.** The local verification runner builds a snapshot, matches every served asset to its hash, runs the suites and five runtime checks against its own loopback workerd, then performs a dry-run bundle. The latest complete run passed with no skips or flaky retries, confirmed source stability and closed both temporary ports. Per-run reports, screenshots, PDFs and failure traces are retained; an intentional failure/then-success control verified they are not overwritten. No deployment. [Runner](../scripts/verify-local.mjs)

**Clean-source handoff.** A fresh 96-file copy of the current source passed installation and the complete frozen check under Node 24.20.0 / npm 11.19.0: 110 unit, 70 Chrome, 18 Firefox and 18 Linux WebKit cases, with no skipped, flaky or unexpected results. All 21 assets match the 16:41 root build; all 95 source-file hashes survived testing and a self-export. Export provenance flags correctly change when already-redacted documents are exported again; their content remains identical. npm reported 102 packages added, 103 audited and zero known vulnerabilities, without changing pending install-script approvals. Earlier 94-file copies also passed on Node 24.20.0 and 26.8.1, but those are historical compatibility checks, not the latest source. All share this host and its browser prerequisites, not a second machine.

**Unit/integration suite.** 110 tests pass: app input validation, atomic writes/comparisons, revisions, recovery, capacity, intake and scheduling, plus ten media-utility cases for disclosure provenance and local artifact replacement/rollback. All 110 passed in the 16:41 root frozen-runtime run, together with 70 Chrome and eighteen each Firefox/WebKit cases. Tests include all 85 supported session-start clocks and an independent prior-booking oracle. [Planner](../tests/planner.test.ts), [intake](../tests/intake.test.ts), [oracles](../tests/planner-benchmark.test.ts), [media utility tests](../tests/demo-provenance.test.ts).

**Source instructions.** An export redaction bug changed the documented npm development command. The broad word replacement was narrowed to SSH commands after a failing export assertion and unit regression; npm/Wrangler commands and private-section removal are checked. Earlier source exports must not be used for handoff.

**Dependencies.** The current lockfile reports zero known advisories from npm audit. This does not prove supply-chain safety. All eight installed production packages have byte-matching shipped license texts; scheduler shares React’s identical text. The inventory is not a legal opinion.

### Browser and WebMCP behavior

**Native Chrome 152.** All 70 browser cases passed in the current stable 152.0.7977.75 workerd run, including the short-queue/protected-prefix CPU case and backup-file lifecycle checks. They use actual `document.modelContext` registration/discovery/execution, plus a separate disabled-WebMCP browser project. They include usable and blocked mobile comparisons, colliding request labels and an unfinished human scenario draft surviving agent activity. No WebMCP polyfill. [Browser flows](../tests/e2e/desk.spec.ts)

**Chrome 151.** Playwright's pinned Chrome Headless Shell 151.0.7922.34 passed the 46-case frozen-runtime suite at 10:03, including adaptive search breadth, backup-file recovery and native registration/probe recovery. The Document API works in both 151 and 152. Version 151 also exposes a Navigator property; the legacy adapter was not exercised.

**Canary 155.** The isolated155.0.8039.0 build passed88units/46browser cases plus the frozen asset/runtime/dry-run checks. Actual tools still require JSON-string execution, not the draft object signature. Separate unflagged stable152.75 and Canary155 probes found no API and verified manual planning. No origin-trial or default hosted support is claimed.

**Firefox 153.** Eighteen manual-only end-to-end flows pass, including custom clock, comparison, planning, unreadable-save recovery, print preview, spreadsheet intake and backup-file ordering/error recovery. No native WebMCP was present. [Manual tests](../tests/e2e/fallback.spec.ts)

**WebKit 26.5.** Eighteen manual flows pass in real Playwright WebKit on Linux, with no WebMCP API or polyfill. Project-local extracted libraries and a custom launcher were used; default host dependency preflight is not claimed. This is not Safari/Apple-device testing. Native menu clipping and narrow selected-value truncation were repaired; 12 final desktop/narrow captures across three engines were inspected. [Manual tests](../tests/e2e/fallback.spec.ts), [WebKit scope](https://playwright.dev/docs/browsers#webkit).

**Native failure recovery.** A real duplicate-name collision verifies partial AbortSignal cleanup without removing a test-owned tool. Failed registration now disables rehearsal and explains manual use/reload. A separate explicitly injected read-only execution failure exposed permanently cached rejection; a later explicit retry now recovers through actual native calls, without replaying a mutation.

**Browser history.** Chrome152 actually restored the page from back-forward cache twice (`pageshow.persisted` true), retaining native tools, the proposal and the unfinished human scenario draft. Headless Shell151 instead reloaded: native tools and saved facts returned, while old proposals correctly expired. Its browser reason was masked; no cause is inferred. The test checks both contracts and records the path used.

**Developer-agent trials.** Twelve guided runs made 95 actual native tool executions. Fresh-instance trials exposed defects later preserved as regressions. Not an independent model benchmark. [Methods and findings](fresh-trials.md)

**Security boundaries.** Actual native origin-exposure tests and production framing denial pass. Imported text is not interpreted as HTML or spreadsheet formulas. The existing native-input regression now rejects array, extra-field and prototype-key inputs across all ten tools, preserving event/storage and dialog/proposal state; it passed in the latest full run. A separate 252-case development-path audit found no literal or encoded content from harmless work/environment-file canaries; 200 responses were app-shell fallbacks, not file content. Canaries were removed. This is not a universal security proof. Same-page approval does not defend against arbitrary DOM/extension privileges.

### Shared state and recovery

**Independent browser tabs.** A separate native Chrome flow opens a real same-origin auxiliary window and a fresh page. The auxiliary window copies the initial save, then UI edits diverge; each survives its own reload. Cross-window proposal IDs are rejected. Tabs are not synchronized, even at equal revision numbers. This does not drive the browser’s Duplicate Tab menu or test session restoration after browser restart.

**Same-tab history conflict.** A real Chrome back-forward-cache reproduction showed an older document overwriting a newer saved event. The store now compares the exact saved content before tool reads and edits, and checks it when a cached page returns. A conflict invalidates proposals and prevents applying or printing a stale plan. The organizer can download the cached event and explicitly reload the newer save; unsaved form drafts are not in that backup. Eight unit regressions cover changed/equal-revision, removed and unreadable saves plus read failures. Four Chrome cases actually used the cache, including an already-checked approval, an open print packet and an unfinished request note. The note remains visible after a rejected Save but is correctly excluded from the cached-event backup. Firefox and WebKit used the fresh-document path; neither is claimed as a cache hit. Read failures leave the document memory-only until reload, without overwriting unknown saved data. This is not cross-tab synchronization or an authorization boundary against arbitrary same-origin code.

**Concurrency.** A regression first demonstrated a revision reset across reload. Revisions now persist with the tab's event; stale agent writes stay rejected after reload. Paginated event/queue reads can require the first page's revision. Human approval is bound to a captured proposal, not a later selected replacement.

**Unsaved request edits.** A browser regression and actual click reproduced capacity preview closing the editor and losing an unsaved note. The action now blocks dirty/stale request details; save, re-preview and priority handoff pass in the current native suite.

**Approved time allowances.** A failing unit and browser regression reproduced an approved 45-minute slot shrinking to 30 minutes in a later keep-bookings preview. Valid longer existing slots are now candidates, while changed constraints can rule them out and count-first planning can still shorten unprotected slots. The complete approve/re-preview/backup/restore flow passes in Chrome and Firefox.

**Refused storage writes.** Explicit browser fault injection simulates a quota failure; native WebMCP and app handlers remain real. Both UI and tools warn about memory-only state. Backup contains the new edit, reload returns the older saved state, and importing the backup recovers the edit. No application fix was needed.

**Backup-file lifecycle.** A failing browser reproduction showed a slow first file overwriting a newer choice. Dialog-local drafts now ignore late/superseded reads, disable applying pending/empty text and allow retrying failures. Chrome/Firefox tests cover choices, edits, cancel/reopen and recovery. File-read delay/error injection is explicit, not an actual disk failure.

**Download safety messages.** Actual Chrome download-policy denial canceled both ordinary and unreadable-save downloads. A failing regression caught the former false “downloaded” notices. Both now say “download requested” and ask users to check their downloads; saved state remains unchanged. Normal downloads/restores and 320px status layout pass. No browser completion callback or full-disk test is claimed.

**Canonical text.** Composed/decomposed accented labels previously bypassed duplicate detection and search. Shared NFC/lowercase comparison keys now reveal stable IDs and match both query forms, without rewriting stored text or merging records. Unit and corrected old/new native-browser checks pass; this is not homoglyph detection.

**Form validation.** A real browser failure showed raw schema diagnostics instead of a correction. Human forms now show issue messages and useful backup field paths. Chrome and Firefox reject invalid request times, repairer windows and duplicate backup IDs without losing drafts or changing saved state, then recover after correction. Both narrow-screen error views were inspected. Native error contracts and validation rules are unchanged.

### Planning and capacity

**Planning scope.** The UI and native tool context explicitly say to plan the whole session before it starts. Elapsed time, in-progress work and completed repairs are not tracked. This is disclosure, not automatic time enforcement. Requests are planned independently; shared-person overlaps across items and pooled teams are not modeled.

**Scheduling.** An independent exact oracle found two earlier small-case misses, preserved as fixtures. Occupancy-dominance pruning corrected them. All 2,000 fixed-seed small cases now match maximum cardinality, and 80 supported-limit cases are feasible. A separate 4,000-case audit includes 15,974 prior bookings, 3,704 padded bookings and 1,958 cancellation scenarios. A new counterexample led to more breadth for shorter decision queues within a nominal 2,304-state-step budget and a 384-state cap. All five preference components now match in that corpus, including the previously missed 15 waiting minutes. Old failures and fixtures are retained. Maximum-count ties favor existing bookings; genuine count gains still take priority. Throttled browser checks include 24 requests and a short queue with 18 protected slots. This is not a proof of universal optimality. [Independent oracle](../tests/scheduling-oracle.ts)

**Capacity explanation counts.** Unit and native/UI regressions reproduced a start crossing reserved time and a protected appointment being counted only once. Both blocker counts now include it, with an overlap note. A 5,000-case independent local-slot audit found 155 pre-repair mismatches and none after repair; it checks local displacement, not complete-replan optimality. Mobile reflow and axe checks pass.

### Accessibility and layout

**Accessibility.** Automated axe checks, keyboard journeys, modal focus return and 320px reflow checks pass. Intake and comparison use labelled cards on narrow screens. WCAG 2.2 AA tags and the explicitly enabled target-size rule pass on audited screens; skip-link activation is tested. An additional fail/pass-controlled spacing audit covered 24 desktop/touch-emulated states with no violations or incomplete results; comparison checks now explicitly include the rule. No claim of a complete screen-reader or disabled-user audit.

**Enlarged windows.** Actual native browser zoom exposed inaccessible/clipped sidebar actions. Scrollable navigation and explicit nearest scrolling on focus fixed pointer and keyboard access; the 360×228 regression passes in Chrome and Firefox without moving the main page. Separate 200%/400% scripted journeys cover editing, native planning, approval, print and backup recovery,15 native calls each. Eight screens were inspected; geometry permits at most 0.5 CSS pixels of edge rounding. Not a full WCAG or independent-user study. [Resize-text guidance](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)

**Visible scrollbars.** Chrome’s default test scrollbar hiding was disabled. A real 15px gutter preserved all five sidebar actions and icons; the full 50-case Chrome suite passed again. Actual 200%/400% journeys with the current stacked forms also passed (15 scripted native calls each; four captures inspected). These are browser checks, not a Windows or independent-user study.

**Forced colors.** A real Chrome rendering defect erased selected navigation and schedule-view states. System-color selection outlines now remain distinct from keyboard focus; recent proposals expose their selected state. A failing-before native test passes in light/dark Chrome palettes. Manual approval/undo flows passed in Chrome and Firefox; Firefox retained a light palette despite a dark media preference. Twelve desktop and two narrow captures were inspected. Emulation, not a Windows/AT-user study.

### Paper and media

**Paper handoff.** Browser PDFs were extracted and visually checked: five-page normal packet, one-page stale refusal, 17-page maximum long-text packet, and a custom-clock packet. All 24 maximum-fixture IDs and complete note endings were found. A separate actual BFCache conflict produced only a one-page refusal PDF, verified by text extraction and image inspection; no stale appointments printed. No physical printer was tested. [PDF verifier](../scripts/verify-packet-pdf.py)

**Demo.** The selected current-build 120-second recording uses 14 actual native calls supplied by the developer agent in phases, with disclosed automated organizer clicks and synthetic narration/data. This familiar case is not an independent benchmark. Nineteen decoded frames were checked (fifteen byte-identical to already-inspected frames, four closing frames inspected directly), including unchanged current appointments, both trade-offs, unchecked/checked confirmation, applied availability and the current packet. Chrome played to completion with 3,000 frames and no reported drops/errors; Firefox passed three seek/play samples with 39 frames. Temporary ports closed. Final encoded-movie ASR made 11 edits over 222 tokens; full human listening and YouTube review remain. Fixed-script and neural-voice alternatives are separate. [Media record](demo.md)

Raw development logs, private workspace material and recordings are deliberately not included in this source export. The tests and verification scripts above are included so the checks can be rerun. [README commands](../README.md#verify)

## Not established

No independent browser-agent benchmark, real organizer study, adoption estimate, task-time saving, completed-repair measurement or environmental-impact claim. No comprehensive older-browser matrix or unflagged production-origin test. This work has not published a hosted URL, repository or video, registered the user, or submitted an entry. The user's existing registration status is unknown.

The [rubric review](rubric-review.md) distinguishes the selected concept's prospective 91 from the current internal demonstrated-build estimate of 90. New features are not automatically points, and there is no guarantee of winning.

### Completed-workflow keyboard recovery

Successful plan application removed its dialog launcher and left focus on the page body. The repaired dialog restores a surviving launcher or focuses the resulting workflow heading. Applying a plan now focuses the current workbench; removing a request returns to the queue heading. Keyboard journeys at 09:15 and 21:00 pass across Chrome, Firefox and Linux WebKit, including exact visible-heading/context checks. Final screenshots were inspected. Actual 200% and 400% zoom journeys on Chrome 151 also pass editing, native review, UI approval, backup/recovery and cancellation. This is browser evidence, not assistive-technology or user-study coverage. [WAI-ARIA dialog focus guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

### User text-spacing recovery

User-defined letter, word, line and paragraph spacing exposed narrow control overflow and an overlapping session-stamp caption. The repaired layout wraps view/filter controls, stacks narrow comparison metrics and lets the stamp grow. Two new 320px/1440px regressions pass in all three engines; the broader 48-state audit finds no page overflow after repair. Four corrected screenshots were inspected. Normal first-viewport pixels are unchanged at 1440, 1200, 760 and 480 pixels; this does not compare every app state or establish full WCAG conformance. [Text-spacing guidance](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)

The follow-up also found vertically compressed timeline labels under increased spacing. Cards now grow within their tracks; the strengthened regressions pass in all three engines. The final 48-state audit has no page overflow or vertical clipping candidates except deliberately hidden accessible labels. Separate click/focus checks expose full item and reserve values in their editors at 320px; six screenshots were inspected. This is a bounded layout and interaction check, not a user study.

### Current Node toolchains

The official release registry listed Node 24.20.0 LTS and 26.8.1 Current on September 3. Both Linux binaries were downloaded under project work, matched the published HTTPS checksums and ran complete checks on the 14:55 source export; no OpenPGP verification or host-wide tool change is claimed. The host remains Node 24.13.1/npm 11.8.0. npm 11.19 left `esbuild` and `workerd` install scripts pending, and no approval or policy override was needed for these Linux builds. This does not establish compatibility on every operating system. [Node releases](https://nodejs.org/en/about/previous-releases), [npm install-script controls](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/)

### Remote-client access is blocked

The parent task confirmed the server’s local health endpoint, but the user’s current SSH route rejects forwarded connections with `administratively prohibited`. A bound local listener was not sufficient; the failed forward was closed. The client’s port 8787 is an unrelated service. No alternative tunnel, access-control change or deployment was made. Generic forwarding examples are conditional instructions, not evidence of working access in this environment. This does not invalidate the server-side native browser tests, but it remains a handoff gap.

### Unicode initials

An actual browser rename exposed a sliced surrogate pair in an emoji avatar and a dropped combining accent. Both roster and timeline now use complete graphemes through `Intl.Segmenter`, with an explicit NFC code-point fallback when it is absent. Avatars are decorative; full names remain in the accessible interface. Two unit checks and rename/save/reload journeys in Chrome, Firefox and Linux WebKit verify initials, unchanged IDs and unchanged appointments. Feature absence is injected explicitly, not a claim of testing an older browser. [ECMA-402 segmentation](https://tc39.es/ecma402/#sec-intl-segmenter-constructor)

Accented and emoji initials were visually inspected in all three engines, plus the Chrome fallback. Chinese text is preserved, but this minimal Linux environment displays a missing-glyph box for the sampled CJK character. The app bundles Latin font subsets and otherwise relies on system fallback; complete multilingual font coverage is not established. No extra font service or dependency was added.

### Accepted long-text boundaries

A valid 80-character label without spaces exposed limits that the earlier space-separated maximum fixture missed. It pushed the narrow roster beyond the viewport, hid its edit control and crossed timeline appointments. Wrapped labels, fixed-size avatars and a full-width narrow heading corrected those cases. The broader fixture then exposed reserved labels, scenario assumptions, story text and current-appointment details that could also overflow. An inherited overflow-wrapping rule preserves the supplied text while allowing it to fit. The CSS draft distinguishes these wrap opportunities from truncation and includes them in minimum intrinsic sizing. [CSS Text draft](https://drafts.csswg.org/css-text-3/#overflow-wrap-property)

Four 320px/1440px regression journeys pass in Chrome, Firefox and Linux WebKit. The saved event is compared field-for-field with the imported fixture after review and cancellation; this is not a file-byte checksum. A separate 18-state Chrome audit finds no page/dialog overflow or text-overflow candidates. Visual review also caught a short “No appointment” result compressed beside a long source value; equal before/after columns and a strengthened regression preserve its readability. Corrected comparison screens were inspected across the engines, together with default, reserved-time and story views.

This is bounded layout validation, not a guarantee that every script, font, assistive technology or possible string has been tested. Long names can make rows taller; fields and table timelines retain their normal scrolling behavior.

### Native registration lifetime across API generations

An isolated official Chrome for Testing 146.0.7680.165 build exposed the actual older Navigator API. Ten tools registered, a native read returned the example, and the native scripted rehearsal reached shared review without changing the saved event. This is limited historical coverage, not a recommendation to browse with an outdated version. Chrome 152 remains the main current-browser baseline. [Official browser availability](https://googlechromelabs.github.io/chrome-for-testing/)

The older implementation ignores registration abort signals. A real duplicate-name collision left three app tools registered after failure. Cleanup now tracks successful registrations and removes only those names on the legacy path, preserving the pre-existing collision owner. A second native reproduction removed one owned tool early; cleanup previously threw and left nine others. It now handles that known already-removed error and continues. The current Document path retains its abort-signal cleanup. The API moved to Document in May; name-based unregistration was already recognized as a source of accidental cross-script interference. [Migration](https://github.com/webmachinelearning/webmcp/pull/184), [unregistration issue](https://github.com/webmachinelearning/webmcp/issues/129)

The existing full-app collision/manual-recovery/reload regression passes on Chrome 146. Four new lifecycle cases pass on both 146 and 152: normal and development StrictMode mounting/unmounting, successful and failed registration, callable unrelated owners, and an explicitly removed legacy tool. The lifecycle cases bundle the real hook with the existing Vite dependency and intercept a fixture HTML response; **the native API is not mocked or polyfilled**, but this fixture is not the product UI. No new dependency or production asset is added. [Lifecycle tests](../tests/e2e/registration.spec.ts)

These checks do not establish every intermediate Chrome version or prevent a script with arbitrary same-page privileges from replacing tools. They are not new language-model benchmark trials.

### Current availability is not an unapplied scenario

A final visual review found that an unavailable repairer still said “in this scenario” after the plan was applied. Current timelines now say “for this session”; proposed timelines retain scenario wording. The existing native approval journey checks the distinction through apply, undo, redo and reload. The two text-spacing journeys also check it in manual Chrome, Firefox and Linux WebKit. The then-current 102/66/17/17 local-runtime suite passed without adding redundant test cases. This is a presentation correction, not a change to scheduling or stored data.

### Current documentation images

The README images were refreshed from the current loopback production build. The proposal image follows actual native preview, complete change-report and review calls; a final read verifies the saved event remains at revision 0 with nine appointments. These are scripted documentation captures, not new agent trials. Both PNGs were inspected and their lossless WebP copies have identical decoded RGBA pixels. The heading focus ring is the real interface state, not an added annotation.

### Chrome settings-page enablement

The main suite uses explicit command-line switches. A separate Chrome 152 check used its actual `chrome://flags/#enable-webmcp-testing` setting in an isolated profile: Default had no API; selecting Enabled and completely restarting exposed the Document API, registered ten tools and completed native read/preview/full-change-report/read calls without changing current appointments. Restoring Default and restarting removed the API and restored the manual status. Three resulting screenshots were inspected. The restart was a controlled browser close/reopen, not a click on Chrome’s Relaunch button; no personal browser profile or user-machine setting was changed. This remains an opt-in experimental configuration, not default or production-origin availability. [Chrome local-testing instructions](https://developer.chrome.com/docs/ai/webmcp#local-webmcp)

### Recovery accessibility and semantic checks

The new conflict controls passed automated axe checks at 320px and 1440px after real page animations and fonts settled. Keyboard Tab/Enter reached reload and preserved the newer save. A separate CDP accessibility-tree audit checked seven workflow states, complete long appointment labels, modal background isolation and approval/focus states. These are browser semantics and automated checks, not a screen-reader session or an assistive-technology user study.

### Approved project name

After the user approved Benchkeeper, the pending-name sidebar label and its unused styles were removed. The naming-only update passed a fresh build, 110 unit tests and 70 Chrome cases, plus runtime and dry-run checks. Live verification confirmed zero pending-name labels, all 21 served asset hashes, manual and real native-enabled browser flows, and all ten registered tools. Current version and release details are in the [deployment handoff](deployment-readiness.md). Earlier recorded screenshots and footage predate this text-only change.
