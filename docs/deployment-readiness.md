# Cloudflare deployment and release handoff

**Live: [Benchkeeper](https://benchkeeper.gpj.workers.dev).** **Public source: [garethpaul/benchkeeper](https://github.com/garethpaul/benchkeeper).**

The sections below are historical deployment records from September 3, 2026. References to private source visibility describe the state at those earlier checkpoints. The source is now public; video publication and competition submission remain separate steps.

## Initial deployed release

- Worker: `benchkeeper`; version `046fd511-6f58-43ec-9053-7e3e7991eda3`.
- Deployed September 3, 2026, approximately 17:17 UTC. Live acceptance passed at 17:19 UTC.
- Used the existing `cloudflare-personal` dotfiles wrapper. It selects the isolated personal OAuth store and clears ambient credential overrides. Account inspection returned one personal account; the release configuration pins it. The target Worker did not exist before deployment, so no existing app was overwritten.
- The release contains the verified static assets and a small Worker. No database, secret binding, model API, custom domain, DNS change, migration, cron job or tunnel was created. Event data remains in each visitor’s browser tab; local events were not transferred.
- The release copy explicitly enables `workers_dev`, disables preview URLs and source-map upload, and preserves Worker-first asset routing, the compatibility date and the security headers. The checked-in configuration remains local-only.
- Only built assets and the Worker were uploaded. Private work, credentials, internal notes, development Git history, source archives and recordings were excluded. A private release gate found no confidential model identifier in the exact deployment files; all 21 assets matched the frozen local build.

The initial check of default Wrangler authentication missed the already configured personal wrapper. A redundant device login was cancelled before using the existing personal session. No new login or copied credentials were needed.

## Verification performed on the actual HTTPS origin

The full local preflight immediately before deployment passed build, 110 unit tests, 70 Chrome tests, 18 Firefox tests, 18 Linux WebKit tests, five runtime cases and the dry-run bundle. There were no skips, flaky retries or unexpected failures. All 21 served assets matched; source stability and temporary-server cleanup passed.

A separate live checker kept the ordinary local test commands restricted to loopback. It verified:

| Check | Observed result |
| --- | --- |
| HTTP and headers | Six cases passed: app, health, unknown API, rejected POST, blocked work path and blocked Git path. CSP/framing denial, same-origin tools policy, no-referrer and nosniff verified. |
| Asset identity | All 21 live files match the pre-upload SHA-256 manifest. |
| Ordinary Chrome 152.0.7977.75 | No WebMCP flags or native API. Manual cancellation preview, human approval, backup, reload, print preview and reset passed at 320 px. |
| Native-enabled Chrome 152.0.7977.75 | Real `document.modelContext`, ten registered tools and actual native read/preview/change-inspection/review calls. No mock or polyfill. |
| Shared state and approval | Previews left revision zero unchanged. A fresh proposal reached the UI; Apply stayed disabled until the organizer checkbox was checked. Final revision one had nine appointments, Sam unavailable, the protected lamp unchanged and the fan assigned to Ada. |
| Recovery | Downloaded backup matched the approved state; reload retained it; reset restored the example. |
| Accessibility and requests | Zero axe violations in the checked desktop/mobile states, no page errors and no unexpected external app requests. Desktop and narrow screenshots were inspected. |

Native verification explicitly enabled `--enable-blink-features=WebMCP` and `--enable-features=WebMCPTesting`. It does **not** establish unflagged browser support or origin-trial enrollment. The ordinary-browser fallback was tested separately, without suppressing the API artificially. Browser automation ran without the OS sandbox in the test environment; that is not an end-user recommendation. This live check is a scripted acceptance journey, not an independent-agent or organizer study.

An initial Python health request returned HTTP 403 immediately after deployment. Subsequent curl, Node and actual-browser checks succeeded; the first response’s cause was not established. The completed six-case suite and asset checks passed without an access login.

## Access and remaining decisions

The hosted URL provides access without SSH forwarding. The prior client forwarding restriction remains unchanged: the SSH server rejects forwarded channels and client port 8787 belongs to an unrelated service. No network or administrator controls were altered.

The user has approved Benchkeeper as the project name. The user subsequently authorized the private [source repository](https://github.com/garethpaul/benchkeeper), starting from a sanitized snapshot with fresh history. This naming approval does not authorize public source visibility, a public video or a Devpost submission. The [submission checklist](submission.md#registration-and-publishing-checklist) records these remaining steps and the deadline.

To enable native tools in a supported local Chrome build, follow the browser guidance in [README](../README.md). Any later origin-trial enrollment must use the actual origin and satisfy its enrollment requirements; no token has been invented or added. [Chrome origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial)

## Future updates and recovery

Use `cloudflare-personal`, not bare Wrangler or a work-profile credential, for authorized changes to this app. Verify the selected account and current target version before another mutation. Do not run a scaffold or allow automatic configuration to choose another destination. The isolated release was dry-run checked before an actual `deploy --strict --no-autoconfig`.

Keep `assets.run_worker_first: true`: the Worker supplies the response security headers. Uploading only `dist` to a different hosting product would not reproduce them automatically. Account IDs and credentials do not belong in public source.

Before any future publication, rebuild and rerun the private privacy gate on the exact artifacts. For repository publication, use the allowlisted source exporter, audit the new archive, and create a clean repository only after authorization. Do not publish the original development Git history. Source exports remain local and do not include the private release configuration.

The current naming update can be rolled back to the initial version listed above. Preserve both known-good versions and their asset manifests. Any later rollback, replacement or disabling of the public route must stay within the user’s authorization; do not affect unrelated resources. [Wrangler Worker commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)

Keep the submitted hosted build, source revision and video aligned through judging. Hosting alone does not register or submit the entry.

## Approved-name update

The user approved Benchkeeper. The pending-name sidebar label and its unused styles were removed; current naming docs and the submission checklist now record that approval. Cloudflare version `a019d79f-494c-4366-af9a-25129307910e` serves this update.

Build, 110 unit tests, 70 Chrome cases, local runtime and dry-run checks passed. The actual hosted label check changed from one pending-name label before the update to zero afterward. The hosted manual and native-enabled Chrome journeys, six HTTP/header cases and all 21 asset hashes passed again; all ten native tools remain registered. No scheduling, storage or approval behavior changed. Source remains private, and its complete clean Git history is scanned before each push. Existing local demo footage predates this label-only change.

## Workshop-ledger visual refresh

Cloudflare version `70ce3422-a1d3-4f8a-901f-fdcc547be555` serves the refreshed design: ink navigation, warm paper, cobalt controls, an orange session ticket, ruled statistics and clearer schedule boundaries. Existing self-hosted typefaces and dependencies are unchanged. The Agent tools page now has a proper top-level heading and ordered section headings. Scheduling, storage and native tool handlers are unchanged.

The frozen local run passed 110 unit tests, 70 Chrome cases, 18 Firefox cases and 18 Linux WebKit cases, plus runtime, asset-identity and dry-run checks. All seven inspected live visual states passed automated accessibility checks, including narrow 320/390-pixel layouts, proposals, approval, roster and tools. The first live asset request briefly returned the prior favicon; a subsequent ordinary request returned the new bytes. No cache or infrastructure setting was changed. Repository screenshots now show the hosted design. The local demo movie is still the earlier design and must be refreshed before publication.

The completed live acceptance run also passed six HTTP/security-header cases, exact hashes for all 21 assets, ordinary manual mode and real native-enabled Chrome read, preview, review, apply, reload, backup and reset flows. All ten tools are registered. No origin-trial token or polyfill was added. The repository remains private.
