# Submission draft — not submitted

## Project name

**Benchkeeper** is the user-approved project name. This draft is not a registration or submission.

## Elevator pitch

Help repair-event volunteers recover from cancellations, protect promised appointments, and review an agent's revised plan before the organizer applies it.

**155 characters**, machine-checked in the pitch-length check; strictly less than 200.

## About the Project

### The problem

A volunteer cancels. Several visitors are already expecting a time. Another item needs a missing part. An organizer must work out what can still fit without quietly breaking promises.

Repair Café's 2026 survey reports volunteer shortages and too many incoming items among organizers' concerns. That supports the problem, not a claim that this product has been adopted or tested with organizers. [Repair Café survey](https://www.repaircafe.org/en/repair%2Dcafes%2Dattract%2D1%2D5%2Dmillion%2Dvisitors%2Devery%2Dyear/)

### What it does

Benchkeeper is a shared planning desk for small pre-booked or hybrid walk-in repair events. The human records requests and protects appointments. Their browser agent can read constraints, compare disruption scenarios, explain excluded requests, and put a proposal on the same screen. The human sees which appointments move, which stay put, and who still has no slot before applying a change.

The example includes a cancellation, a protected desk-lamp appointment, several skill groups and a missing part. Users can start a blank event at their own start time, edit the roster and intake, append a reviewed CSV/spreadsheet batch, reserve walk-in or break time, place appointments manually, undo local changes, and print a current-plan reception/repairer packet. An excluded item has a concrete capacity explanation and a counterfactual preview showing the cost of making room for it. A same-scenario comparison distinguishes booked visitors losing a slot from appointments simply moving. Maximum-count ties favor retaining bookings; genuine count gains can still displace unprotected appointments. All actions are local; no visitor receives a message.

### Why WebMCP fits

The agent needs structured constraints and stable request IDs, not guesses about colored blocks. Ten browser tools read or change the same state the organizer sees. A proposal is a shared artifact: the agent stages it, the human inspects it, and later edits invalidate it. Approval and release of protected appointments are absent from the tool catalog.

This is browser-native WebMCP, not a remote MCP server or an embedded chatbot. The human's browser agent provides the language model. Unsupported browsers retain the manual product, and the fixed rehearsal labels any direct-handler fallback explicitly.

### How it is built

React provides the shared interface. Zod validates tool and import input. A deterministic bounded search considers skill, availability, visitor windows, missing parts and protected slots, and produces an inspectable proposal. Captured proposal snapshots and revision checks reject stale or substituted approvals. Human editor drafts and agent writes also reject stale revisions. Tab-local storage and JSON backup avoid sending event data to a backend. A small Worker serves the production assets with security headers and is deployed on the user’s personal Cloudflare account.

### What we learned

API drift matters: installed Chrome 152 uses `document.modelContext` but expects JSON-string execution arguments, whereas the current draft describes objects. Testing registration alone would have missed that. An independent exhaustive audit found two small cases where our bounded search missed an available appointment. Preserving those counterexamples and pruning equivalent occupied-slot states fixed the misses; the 2,000-case corpus now passes, without claiming universal optimality. A separate 4,000-case recovery corpus exposed a padded-booking miss. Giving shorter queues more bounded search breadth closed that case and an earlier waiting-time gap; all five preference components now match that finite corpus. A developer-guided native trial exposed another distinction: preserving exact times is not the same as retaining booked visitors. The preference, comparison and regression tests now make that explicit. Paper and keyboard testing exposed clipping and focus bugs that a green build alone missed.

### Honest limits

The current planner handles one three-hour session at a chosen local start time; the example uses synthetic estimates. Use it before the session begins: elapsed time, in-progress work and completed repairs are not tracked. Requests are planned independently; same-person attendance conflicts across several items and pooled repair teams are not modeled. It does not diagnose appliances, certify safety, guarantee optimal allocations, measure environmental savings, or promise successful repairs. It has not yet been tested by a real repair-event organizer. The native scripted rehearsal is not proof that an autonomous language-model agent chooses the right tools. Same-page confirmation cannot stop an agent with arbitrary page-control privileges.

## Built With

React; TypeScript; Vite; Zod; csv-parse; Lucide React; IBM Plex Sans; DM Serif Display; native browser WebMCP; sessionStorage; Cloudflare Workers static assets; Wrangler/workerd; Vitest; Playwright; axe-core. Exact versions: `package-lock.json`. No embedded AI model, OpenAI API dependency or remote MCP SDK.

## Two-minute demo script

Times are rounded from the selected recording; the storyboard retains nominal pacing for future takes.

| Time      | Screen and action                                | Narration                                                                                                                                                                                                                                                                     |
| --- | --- | --- |
| 0:00–0:14 | One promise we will not move                     | A volunteer cancels, but a visitor's promised slot must stay. This synthetic example lets an organizer and browser agent inspect the consequences before applying a new plan.                                                                                                 |
| 0:14–0:36 | Real native WebMCP · developer-guided agent      | The agent reads the roster and queue, then previews Sam's cancellation through real browser native Web M C P tools. A developer guided language model chose these calls. The organizer clicks are automated and the voice is synthetic. This is not an independent benchmark. |
| 0:36–0:52 | Current and proposed plans stay separate         | The first preview keeps the lamp fixed. It fits ten appointments, but the fan loses its slot. The current nine appointments are still untouched. The complete change report makes the difference visible.                                                                     |
| 0:52–1:08 | Explain a missing slot, not just a failure       | The fan needs forty five minutes. A native tool finds a local opening that overlaps the kettle and radio. Those visitors have not been replanned. A local opening is not a complete solution.                                                                                 |
| 1:08–1:27 | Make room for one item · inspect the cost        | Now a full preview prioritizes the fan. It moves to Ada, and the kettle keeps its appointment, but the radio loses its slot. The proposal exposes that cost before anything is applied.                                                                                       |
| 1:27–1:44 | Review the exact proposal in the human interface | The review requires a separate confirmation. There is no apply or unlock tool. The confirmed action changes only this local plan and sends no messages.                                                                                                                       |
| 1:44–2:00 | Current-plan handoff · no visitors contacted     | Print a reception sheet and copies for volunteers, or download a backup. The manual interface works with agent tools turned off. These are planning estimates. Repairs are never guaranteed.                                                                                  |

The current 120-second draft records 14 actual native calls chosen by a developer-guided language model on a familiar synthetic case. Organizer clicks are automated and narration is synthetic; both are disclosed. A no-caption master and SRT are retained. This is not an independent or autonomous-agent evaluation, and nothing is uploaded. See [demo production and remaining review](demo.md).

Record only verified behavior. Keep developer-agent selection, fixed-script rehearsals and independent evaluations distinct. Use original narration; no unlicensed music or third-party marks. Final public video must be shorter than three minutes. [Submission requirements](https://webmcp.devpost.com/)

## Hosted and local testing instructions

**Public try-it URL: [benchkeeper.gpj.workers.dev](https://benchkeeper.gpj.workers.dev).** No app login is required. The hosted origin passed manual and real native-enabled Chrome flows; unflagged Chrome uses manual mode. See the [release evidence](deployment-readiness.md).

Start with README instructions. Local Vite URL: `http://127.0.0.1:5173/`. Local production-runtime URL: `http://127.0.0.1:8787/` while Wrangler is running. These addresses work only on the machine running the app. Access from the user’s current client is **blocked**: the SSH server rejects forwarded connections, and the client’s port 8787 is occupied by an unrelated service. The hosted URL now provides an authorized access path; no alternative tunnel or access-control change was made. **Neither is a public try-it URL.** No login is required for this local app. Browser tab data is isolated; reset gives deterministic example data.

## Registration and publishing checklist

- [ ] **User action:** review age, residence, employment/affiliation/conflict, project ownership and funding restrictions in the [official rules](https://webmcp.devpost.com/rules). We do not know or attest eligibility.
- [ ] **User action:** open the [challenge](https://webmcp.devpost.com/), choose **Join hackathon**, then sign into an existing Devpost account or create one. Read and accept terms yourself. **This work did not register you.** Your existing account or registration status is unknown; check it before creating a duplicate.
- [x] **User approved:** Benchkeeper is the project name.
- [x] Provide an authorized hosted access path. Local SSH forwarding remains blocked and was not changed.
- [x] Complete local acceptance and record achieved rubric evidence and gaps. User review of the final submission remains outstanding.
- [x] **Authorized and completed:** deploy to the personal Cloudflare account and verify the real hosted URL, manual flows and native WebMCP in enabled Chrome. No origin-trial enrollment was performed; unflagged Chrome remains manual.
- [x] Publish the [public source repository](https://github.com/garethpaul/benchkeeper) with its MIT license, source, setup instructions and dependency notices. Development notes, recordings and caches are excluded.
- [ ] **User-controlled:** review or replace the local narrated draft, then publish the final YouTube demo under three minutes. Do not present screenshots alone as a functioning demo.
- [ ] Enter the name, checked pitch, About text, actual Built With list, hosted URL, public source URL, video URL and testing instructions in Devpost. Include all team members accurately.
- [ ] Review and submit before **September 3, 2026, 13:00 Pacific / 20:00 UTC**. This phase does not submit anything.
- [ ] Keep judge access free and usable through September 21 at 17:00 Pacific; freeze the submitted artifacts after the deadline as directed by the [resources FAQ](https://webmcp.devpost.com/resources). Continue development in a separate copy if needed.

The hosted URL above is live, and the [source repository](https://github.com/garethpaul/benchkeeper) is public. This document remains a submission draft; publishing source does not publish a video, register an entrant or submit the project.
