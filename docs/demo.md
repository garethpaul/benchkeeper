# Local two-minute demo

## Current artifacts

The selected local draft is `work/demo/agent-render/benchkeeper-local-demo.mp4`: a **120-second real screen recording** of the planning flow, with captions and synthetic narration. The same directory contains a no-caption master, SRT, narration, native trace and render metadata. None is a public video URL.

A developer-guided language model supplied phase-based sequences of **14 actual browser-native WebMCP calls**, inspected outputs between phases, and carried fresh proposal IDs into complete change reports. The public recorder does not implement a model or select native calls. It separately automates organizer clicks for filming. Synthetic data, narration and organizer automation are disclosed on screen and in speech. This familiar case is **not an independent or autonomous-agent evaluation**. [Separate trial methods](fresh-trials.md)

The take reads the full roster and all three queue pages, focuses the protected lamp, previews Sam's absence, inspects every change, explains the fan's missing slot, then previews prioritizing it. The proposals contain ten and nine appointments. The second keeps the lamp and kettle unchanged, moves the fan to Ada and leaves the radio unplaced. Only the separately automated review checkbox and apply button change the saved plan. A final native read and saved-state audit verify revision 1 and the reviewed result.

The selected recording uses the current production build, including the completed-workflow focus, text-spacing, Unicode-initial, long-label, current-availability wording and same-tab saved-event recovery repairs. Its native trace identifies that build. The clean source produces matching assets. This does not claim pixel-equivalence with earlier versions or testing of every possible state.

The story ends with the current-plan paper packet. It does not claim successful repairs, visitor contact or field effectiveness. Exact narration: [agent storyboard](demo-agent-storyboard.json), [submission draft](submission.md).

## What was checked

| Check              | Result and limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File               | 120.000 seconds, 1440×1024, H.264 at 25 fps with 48 kHz mono AAC; 6,817,448 bytes. Assembly ID: `2026-09-03T16-33-07-049Z`. The video track begins at 0 seconds and contains 3,000 frames.                                                                                                                                                                                                                                                                                             |
| Picture            | The original 1440×960 picture is not scaled. A 64-pixel bottom margin separates the disclosure from player controls. The original disclosure strip is redrawn so dialog blur cannot hide it. App actions, order and speed are unchanged.                                                                                                                                                                                                                                               |
| Captions and sound | 26 cues, at most two lines and 42 characters per line; peak reading rate 16.68 characters/second. Mean decoded volume −18.9 dB, maximum −1.3 dB. These measurements do not establish naturalness.                                                                                                                                                                                                                                                                                      |
| Visual review      | Nineteen decoded frames checked: fifteen are byte-identical to already-inspected frames from the same take, and four closing frames were inspected directly. The ten-appointment proposal is visible at 41 seconds, unchanged current nine at 44, and the complete change report at 48, matching those captions. Protected appointment, tool definition, capacity explanation, approval, packet and final timeline are readable. Some captions cover nonessential lower-page controls. |
| Firefox 153        | Three seek/play checkpoints with extracted media libraries: 39 presented frames, no reported drops or media errors. Not full-duration playback or universal codec compatibility.                                                                                                                                                                                                                                                                                                       |
| Chrome 152         | Full 120-second playback to completion: 3,000 frames, no reported drops or media errors. Temporary port closed.                                                                                                                                                                                                                                                                                                                                                                        |
| Local transport    | A temporary loopback player exposes only one fixed video buffer and its page. HEAD, byte-range, invalid-range and unrelated-path checks pass. It never serves the work directory or weakens Vite's denial.                                                                                                                                                                                                                                                                             |

Browser checks are muted automation, **not full human listening or a YouTube-player review**. Firefox's earlier browser-only environment rejected AVC; existing extracted media libraries resolved it without host-package changes. [Mozilla media guidance](https://support.mozilla.org/en-US/kb/audio-and-video-firefox)

Captions use actual eSpeak word events. The assembler now follows recorded chapter times rather than planned times, validates their order/range and refuses speech that no longer fits; it does not accelerate narration or video. A failing regression exposed the planned-time mismatch. Camera moves were also paced to keep the current and proposed plans distinct. The final take enters the confirmation scene at 87.00 seconds; its 10.10 seconds of speech fit before the packet scene at 104. Approval occurs at 100.03 seconds, after the separate checkbox action. The checked frames include unchecked and checked states. The final phase queues the already chosen review/read calls and organizer-camera actions, so packet display no longer waits on controller round trips. It appears at 104 seconds and the final current plan is held from 117 seconds. Failed takes that missed the recorder's guard remain separate, with no approval actions and no promotion. [eSpeak API](https://github.com/espeak-ng/espeak-ng/blob/1.51/src/include/espeak-ng/speak_lib.h)

## Machine speech check

Local faster-whisper 1.2.1 / small.en recognition checked the **final encoded movie**, without a reference prompt or hotwords: 11 raw token edits over 222 reference tokens (4.95%). Most are acronym/number spellings or word segmentation; it also drops the opening article and hears “shows” for “chose.” The preceding render garbled the closing disclaimer. Simpler closing sentences now transcribe correctly, including “Repairs are never guaranteed.” Earlier renders misheard “booking” and “repairers”; the current wording uses “slot” and “volunteers.” This is **not a human-intelligibility score** or a substitute for listening. Scores changed between renders, including when only silence placement changed.

Recognition used pinned local weights and CPU inference. A positive-controlled Python socket guard recorded zero connection attempts during recognition; this does not audit every native-library syscall. No audio was uploaded. The recognizer is an optional audit tool, not an app dependency or the coding model. [Recognizer implementation](https://github.com/SYSTRAN/faster-whisper)

## Local artifact

The development recording is not bundled in this source export. Reproduce it locally using the scripts below. The entire work directory remains denied by the dev server; do not weaken that denial to serve media.

## Reproduce

Build and start local workerd. Install a Playwright browser or set `CHROME_EXECUTABLE` as described in README. Both recorders refuse non-loopback origins and start fresh browser contexts. The agent bridge was verified with Chrome 152.0.7977.75's actual Document API and JSON-string execution signature; it is not a polyfill or a hosted-agent service.

### Developer-agent recording

```sh
node scripts/record-agent-demo.mjs UNIQUE_TAKE_TAG
```

A lowercase tag selects a new directory under `work/demo/agent-candidates/`; existing directories are refused. The bridge prints `ready`, then accepts one JSON command per input line. For example, `{"command":"catalog"}` discovers real native definitions. A bounded task starts the clock with `{"command":"begin","task":"..."}`. Native calls use `{"command":"call","name":"get_repair_event","args":{"limit":8}}`. The external agent must choose subsequent calls from actual outputs, follow pagination, inspect changes and supply fresh proposal IDs. This bridge alone is not a language-model agent.

Separate `ui` commands move the camera and automate organizer actions; they are recorded as organizer automation, never native tool approvals. `chapter` commands pace the storyboard. A complete take needs all story beats, a verified final read and at least 120 seconds before `finish`. Errors fail fast, missing UI targets time out after five seconds, and incomplete takes exit unsuccessfully. The six-minute watchdog is a guard, not a tested expiry-duration result. Do not paste secrets, real visitor data or credentials into a filming task.

Audit the completed trace and final state before selecting it. Then copy only that take's `recording.json` into `work/demo/agent-render/` and run:

```sh
DEMO_VARIANT=agent node scripts/assemble-demo.mjs
```

The assembler rejects a fixed-script recording in agent mode, and rejects an agent recording in fixed mode, before changing media outputs. This checks metadata consistency, **not model authentication**. Actual visible navigation pixels determine the trim; timestamps only narrow the search. The 120-second action sequence is preserved without speeding it up. All narration, captions, metadata and videos are staged in the same candidate directory. A controlled encoder failure previously overwrote five older sidecars; the repaired path leaves the selected set unchanged. Final local file replacement keeps backups and rolls back earlier replacements if a later move fails. Do not run concurrent assemblies of the same profile; this is not a cross-process transaction or a guarantee against filesystem failure.

Both profiles were rendered successfully in isolated local copies after this repair. The agent masters and SRT were byte-identical to the selected artifacts; the fixed masters had identical compressed audio/video packets and SRT, though container metadata differed. These are render-equivalence checks, not new browser or listening sessions. That earlier equivalence check did not replace the root videos. The latest selection preserves all 13 prior top-level artifacts with hashes, retains the verified candidate, copies its referenced speech files and restores the trace's original raw-video path. Selected file hashes match the checked candidate; this is not a new playback or agent run.

### Fixed rehearsal alternative

```sh
env PLAYWRIGHT_BROWSERS_PATH="$PWD/work/browsers" node scripts/record-demo.mjs
node scripts/assemble-demo.mjs
```

This older alternative explicitly discloses **no language model choosing tools** and writes to `work/demo/`, not `agent-render/`. Its retained fifth recording predates the latest text-matching and validation refinements. It is not the selected current-build agent draft.

### Optional media runtime

Assembly uses Python 3, an eSpeak NG shared library and voice data, FFmpeg/ffprobe with libass, and DejaVu Sans. Tested versions: eSpeak NG 1.51 and FFmpeg 6.1.1 / libass 0.17.1. They are not app or Cloudflare dependencies. Synthesis and assembly make no model or network-service calls.

`ESPEAK_LIBRARY`, `ESPEAK_DATA_DIR` and `DEMO_ESPEAK_LIBRARY_PATH` select a speech runtime. `FFMPEG_BIN`, `FFPROBE_BIN` and `DEMO_FFMPEG_LIBRARY_PATH` select a media runtime. `ESPEAK_BIN` is obsolete. The development recipe is intentionally not bundled in the source export. No host packages were installed.

A separate ignored Kokoro/ONNX narration pilot was tested locally with a preset voice. It remains an alternative, not the selected recording. Its models and packages are not part of the app or clean source. No voice was cloned or audio uploaded; automatic recognition did not eliminate all ambiguity. [Model](https://huggingface.co/hexgrad/Kokoro-82M) · [Runtime](https://github.com/thewh1teagle/kokoro-onnx)

## Review before publishing

Listen to the complete narration and decide whether to use the entrant's voice. Check the actual target player's controls and captions; only the described local browser configurations have been tested. The user has approved Benchkeeper as the name. The existing local recording predates removal of the pending-name label; refresh that footage before publishing it as the current UI.

Only after explicit authorization, upload the selected video to YouTube and use its real public URL in Devpost. For the clean master, upload the SRT separately; avoid duplicate captions on the burned-caption copy. Keep the video shorter than three minutes. Nothing here uploads or submits anything. [Official requirements](https://webmcp.devpost.com/rules)
