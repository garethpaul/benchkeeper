# Intake from an existing sheet

## Why this pass

The organizer handbook describes a shared registration sheet with item IDs, while the initial product only transferred its own JSON backup format. Entering every request again is avoidable setup work. This is an analyst walkthrough based on primary workflow material, **not** an observed usability test or measured time saving. [Organizer handbook](https://cambridgecarbonfootprint.org/wp-content/uploads/2025/07/0.-Repair-Cafe-handbook.pdf)

For each manually entered request, the organizer currently opens a dialog, enters an item and anonymous visitor label, checks skill, duration, arrival/departure and parts status, then saves. Repeating that for a twelve-item sheet requires at least twelve separate save cycles. A paste/review/add operation can remove those cycles without inventing a direct integration with another product. Roster setup remains separate and explicit.

## Decision

| Approach | Benefit | Cost / decision |
|---|---|---|
| Keep individual entry only | Smallest implementation; useful for walk-ins | Retains unnecessary re-entry for pre-booked events. Keep it, but not as the only intake path. |
| Require Benchkeeper JSON | Complete validated event transfer | Useful for backup, unsuitable for an ordinary spreadsheet. Keep its existing role. |
| Paste a small CSV or tab-separated sheet, preview, append | Fits one organizer's existing local workflow; no backend/account/token | **Chosen.** Strict documented columns, explicit parts status, atomic append, no silent updates or scheduling. |
| Integrate with a live repair-management system | Could avoid mapping and re-entry entirely | APIs, authorization, schema and real partner workflow are unverified. Outside this local build. |

The parser uses the maintained `csv-parse` browser synchronous distribution instead of hand-implementing quoting and embedded newlines. Input and supported rows are tightly bounded; streaming is unnecessary. The dependency's Node compatibility shims are unrelated to WebMCP; no WebMCP polyfill is added. [Browser distribution](https://csv.js.org/parse/distributions/browser_esm/) · [Synchronous API](https://csv.js.org/parse/api/sync/)

## Acceptance for the implementation

- Read comma- or tab-separated rows, including quoted commas, quotes and newlines, with an explicit header and no unknown/duplicate columns.
- Require item, anonymous visitor label, skill, estimated minutes, arrival, departure and explicit yes/no parts status. Never infer that a missing part is available. Optional note and stable item ID.
- Interpret times using the actual event clock, reject outside-session or non15-minute values, and keep the existing 24-request total limit.
- Show all parsed rows before changing state. Errors identify a row/field; invalid batches never partly append.
- Append only: no replacement of existing IDs, appointments, protected promises or roster entries. One undo reverses the whole batch.
- Bind review to its event revision. If a native write occurs, keep pasted text but require a fresh validation before adding anything.
- Display imported values as text. Do not execute spreadsheet formulas, follow links or send data to a server. Exports remain JSON, not a spreadsheet formula execution surface.
- Test quoted/Unicode input, duplicate IDs, missing columns, invalid windows/parts flags, size limits, stale review, atomicity, native visibility and manual-only use.

## Implemented and verified

The paste/review/append flow is implemented. Fifteen parser/store tests cover quoted and tab-separated input, Unicode, empty cells, explicit parts status, custom clocks, generated/duplicate IDs, invalid batches and atomic undo. They run inside the 79-test unit suite; the latest addition round-trips generated CSV clocks across all 85 supported event starts. A native browser flow tests stale review after a real tool write, accessibility/reflow, shared-state visibility and unchanged protected appointments. A manual-only flow tests errors, unevaluated formula text, export and keyboard focus. Both pass in the 40-case Chrome/workerd suite; the manual flow also passes in actual Firefox 153.0.

Desktop review uses a table; narrow screens show fully labelled cards so parts status and time windows do not require sideways scrolling. Validation focuses the review heading, and closing the modal returns to the invoking control. This is implementation and test evidence, not an organizer study. There is no automatic column mapping or direct integration with an existing repair-management product.
