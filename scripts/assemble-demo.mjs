// Local synthetic narration and video assembly; no network/model API calls.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, renameSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { assertRecordingProvenance, alignNarrationToRecording } from './demo-provenance.ts';
import { promoteDemoArtifacts } from './demo-artifacts.ts';

const variant = process.env.DEMO_VARIANT ?? 'fixed';
if (!['fixed', 'agent'].includes(variant)) throw new Error('Unsupported demo variant.');
const profile =
  variant === 'agent'
    ? {
        directory: 'work/demo/agent-render',
        storyboard: 'docs/demo-agent-storyboard.json',
        disclosure:
          'DEVELOPER-GUIDED AGENT · SYNTHETIC DATA & NARRATION · ORGANIZER CLICKS AUTOMATED',
        title: 'Benchkeeper provisional — developer-guided native WebMCP demo',
        description:
          'Developer-agent-selected native calls on a familiar synthetic case; automated organizer UI and synthetic narration. Not an independent or autonomous-agent evaluation.'
      }
    : {
        directory: 'work/demo',
        storyboard: 'docs/demo-storyboard.json',
        disclosure: 'SCRIPTED DEMO · SYNTHETIC DATA & NARRATION · NO LLM IN THIS REHEARSAL',
        title: 'Benchkeeper provisional — scripted native WebMCP demo',
        description:
          'Scripted real native WebMCP calls and automated human-interface flow; synthetic data and narration. Not an autonomous LLM evaluation.'
      };
const output = (file) => `${profile.directory}/${file}`;
const recording = JSON.parse(readFileSync(output('recording.json'), 'utf8'));
// Validate before creating scratch outputs or touching an existing status/master.
assertRecordingProvenance(recording, variant);
const assemblyId = new Date().toISOString().replace(/[:.]/g, '-');
const stagedDirectory = output(`builds/${assemblyId}`);
const candidateDirectory = resolve(stagedDirectory);
// Narration, captions and metadata belong to the same candidate as the videos.
// Keep prior selected files untouched until every render check has succeeded.
const demo = (file) => `${stagedDirectory}/${file}`;
mkdirSync(candidateDirectory, { recursive: true });
const statusFile = output('assembly-status.json');
writeFileSync(
  statusFile,
  JSON.stringify({ assemblyId, status: 'building', published: false }, null, 2)
);
try {
  const storyboard = alignNarrationToRecording(
    JSON.parse(readFileSync(profile.storyboard, 'utf8')),
    recording.trace
  );
  mkdirSync(demo('audio'), { recursive: true });
  const ffmpeg = process.env.FFMPEG_BIN ?? 'ffmpeg';
  const ffprobe = process.env.FFPROBE_BIN ?? 'ffprobe';
  const mediaEnv = {
    ...process.env,
    XDG_CACHE_HOME: resolve(demo('cache')),
    ...(process.env.DEMO_FFMPEG_LIBRARY_PATH
      ? { LD_LIBRARY_PATH: process.env.DEMO_FFMPEG_LIBRARY_PATH }
      : {})
  };
  function run(binary, args, env = process.env) {
    if (binary === 'ffmpeg' || binary === 'ffprobe') {
      binary = binary === 'ffmpeg' ? ffmpeg : ffprobe;
      env = mediaEnv;
    }
    const result = spawnSync(binary, args, { encoding: 'utf8', env });
    if (result.status !== 0)
      throw new Error(
        `${binary} failed: ${result.error?.message || result.stderr || result.stdout || `exit ${result.status}`}`
      );
    return result.stdout;
  }
  if (
    !run('ffmpeg', ['-hide_banner', '-filters'])
      .split('\n')
      .some((line) => /^\s*\S+\s+ass\s+/.test(line))
  )
    throw new Error(
      'This FFmpeg lacks the ass subtitle filter. Use a build with libass and set FFMPEG_BIN/FFPROBE_BIN if needed. Existing videos were not replaced.'
    );
  const mediaVersions = {
    ffmpeg: run('ffmpeg', ['-version']).split('\n')[0],
    ffprobe: run('ffprobe', ['-version']).split('\n')[0]
  };
  function duration(file) {
    return Number(
      JSON.parse(
        run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file])
      ).format.duration
    );
  }
  const ttsEnv = {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: '1',
    ...(process.env.DEMO_ESPEAK_LIBRARY_PATH
      ? { LD_LIBRARY_PATH: process.env.DEMO_ESPEAK_LIBRARY_PATH }
      : {})
  };
  const srtTime = (seconds) => {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  const captions = [],
    segments = [],
    captionMetadata = [],
    engines = new Set();
  function captionGroups(text) {
    const groups = [];
    let current = null;
    for (const match of text.matchAll(/\S+/g)) {
      const token = match[0];
      if (token.length > 42)
        throw new Error('A narration word is too long for a readable caption.');
      const position = [...text.slice(0, match.index)].length + 1;
      if (!current) current = { start: position, end: position, lines: [''] };
      let last = current.lines.length - 1;
      if (current.lines[last] && current.lines[last].length + 1 + token.length > 42) {
        if (current.lines.length === 2) {
          groups.push(current);
          current = { start: position, end: position, lines: [''] };
        } else current.lines.push('');
        last = current.lines.length - 1;
      }
      current.lines[last] += (current.lines[last] ? ' ' : '') + token;
      current.end = position + [...token].length;
      if (/[.!?]$/.test(token)) {
        groups.push(current);
        current = null;
      }
    }
    if (current) groups.push(current);
    if (groups.map((group) => group.lines.join(' ')).join(' ') !== text.trim().replace(/\s+/g, ' '))
      throw new Error('Caption grouping lost narration text.');
    return groups;
  }
  for (const [index, chapter] of storyboard.entries()) {
    const text = resolve(demo(`audio/chapter-${index + 1}.txt`));
    const wav = resolve(demo(`audio/chapter-${index + 1}.wav`));
    const eventFile = resolve(demo(`audio/chapter-${index + 1}-events.json`));
    writeFileSync(text, chapter.narration + '\n');
    run('python3', ['scripts/synthesize-narration.py', text, wav, eventFile], ttsEnv);
    const speech = JSON.parse(readFileSync(eventFile, 'utf8'));
    engines.add(speech.engine);
    const seconds = duration(wav);
    if (Math.abs(seconds - speech.durationSeconds) > 0.001)
      throw new Error('Word-event metadata does not describe the generated audio.');
    if (seconds > chapter.duration - 0.25)
      throw new Error(`Narration overruns chapter ${index + 1}: ${seconds}s`);
    segments.push({ ...chapter, wav, spokenSeconds: seconds, eventFile });
    const words = speech.events.filter((event) => event.type === 'word');
    const groups = captionGroups(chapter.narration).map((group) => {
      const spoken = words.filter(
        (word) => word.textPosition >= group.start && word.textPosition < group.end
      );
      if (!spoken.length) throw new Error('A caption cannot be mapped to generated speech.');
      return { ...group, audioStart: Math.min(...spoken.map((word) => word.audioMs)) / 1000 };
    });
    for (const [groupIndex, group] of groups.entries()) {
      const end = groups[groupIndex + 1]?.audioStart ?? seconds;
      if (!(group.audioStart >= 0 && end > group.audioStart && end <= seconds))
        throw new Error('Caption timestamps are invalid or overlap.');
      captions.push(
        `${captions.length + 1}\n${srtTime(chapter.start + group.audioStart)} --> ${srtTime(chapter.start + end)}\n${group.lines.join('\n')}\n`
      );
      captionMetadata.push({
        chapter: index + 1,
        start: chapter.start + group.audioStart,
        end: chapter.start + end,
        lines: group.lines
      });
    }
  }
  if (engines.size !== 1) throw new Error('Narration segments used inconsistent speech engines.');
  writeFileSync(demo('narration.srt'), captions.join('\n'));
  writeFileSync(demo('narration.txt'), storyboard.map((c) => c.narration).join('\n\n') + '\n');
  writeFileSync(
    demo('audio-metadata.json'),
    JSON.stringify({ engine: [...engines][0], synthetic: true, segments }, null, 2) + '\n'
  );
  writeFileSync(
    demo('caption-timing.json'),
    JSON.stringify(
      {
        source: 'eSpeak word-event timestamps; not human listening or speech recognition',
        maxLines: 2,
        maxLineCharacters: 42,
        cues: captionMetadata
      },
      null,
      2
    ) + '\n'
  );
  const assTime = (seconds) => {
    const centiseconds = Math.round(seconds * 100);
    return `${Math.floor(centiseconds / 360000)}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
  };
  if (captionMetadata.some((cue) => cue.lines.some((line) => /[{}\\]/.test(line))))
    throw new Error(
      'Narration contains ASS control characters; review caption escaping before assembly.'
    );
  const assHeader = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1440',
    'PlayResY: 960',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,DejaVu Sans,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,3,3,0,2,150,150,62,1',
    'Style: Disclosure,DejaVu Sans,16,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,0,0,2,0,0,10,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];
  // The native dialog backdrop blurs page content, including the recorder's
  // disclosure. Redraw exactly that existing 36px strip after video capture.
  const disclosure = [
    'Dialogue: 0,0:00:00.00,0:02:00.00,Disclosure,,0,0,0,,{\\an7\\pos(0,924)\\p1\\bord0\\shad0\\1c&H303D17&}m 0 0 l 1440 0 l 1440 36 l 0 36 l 0 0',
    `Dialogue: 1,0:00:00.00,0:02:00.00,Disclosure,,0,0,0,,${profile.disclosure}`
  ];
  writeFileSync(demo('disclosure.ass'), [...assHeader, ...disclosure, ''].join('\n'));
  writeFileSync(
    demo('narration.ass'),
    [
      ...assHeader,
      ...disclosure,
      ...captionMetadata.map(
        (cue) =>
          `Dialogue: 2,${assTime(cue.start)},${assTime(cue.end)},Default,,0,0,0,,${cue.lines.join('\\N')}`
      ),
      ''
    ].join('\n')
  );
  const inputArgs = segments.flatMap((s) => ['-i', s.wav]);
  const delays = segments.map((s, i) => `[${i}:a]adelay=${s.start * 1000}:all=1[a${i}]`).join(';');
  const mix = segments.map((_, i) => `[a${i}]`).join('');
  run('ffmpeg', [
    '-y',
    '-v',
    'error',
    ...inputArgs,
    '-filter_complex',
    `${delays};${mix}amix=inputs=${segments.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad,atrim=duration=120[out]`,
    '-map',
    '[out]',
    '-ar',
    '48000',
    demo('narration.wav')
  ]);

  // A failed/partial recording never substitutes for the requested demonstration.
  recording.path = realpathSync(recording.path);
  if (!recording.path.startsWith(resolve('work/demo/raw') + sep))
    throw new Error('The source recording must stay under work/demo/raw.');
  const rawSeconds = duration(recording.path);
  if (rawSeconds < 120) throw new Error('Recording is shorter than the storyboard.');
  // Recorder shutdown can pad the tail. It is not a measure of startup delay.
  // Align the actual visible Tools-tab transition with its recorded chapter time.
  if (!recording.navBounds) throw new Error('Recording is missing its visual alignment anchor.');
  const anchor = recording.navBounds;
  const x = Math.ceil((anchor.x + 7) / 2) * 2,
    y = Math.ceil((anchor.y + 5) / 2) * 2;
  const pixels = spawnSync(
    ffmpeg,
    [
      '-v',
      'error',
      '-i',
      recording.path,
      '-vf',
      `crop=2:2:${x}:${y},format=rgb24`,
      '-pix_fmt',
      'rgb24',
      '-f',
      'rawvideo',
      '-'
    ],
    { env: mediaEnv }
  );
  if (pixels.status !== 0) throw new Error('Could not read recording alignment pixels.');
  const runs = [];
  let begin = null;
  const frameCount = pixels.stdout.length / 12;
  for (let frame = 0; frame <= frameCount; frame++) {
    const offset = frame * 12;
    const active =
      frame < frameCount &&
      pixels.stdout[offset] < 100 &&
      pixels.stdout[offset + 1] < 140 &&
      pixels.stdout[offset + 2] < 130;
    if (active && begin === null) begin = frame;
    if (!active && begin !== null) {
      runs.push({ start: begin / 25, end: frame / 25 });
      begin = null;
    }
  }
  const expected = recording.trace.find(
    (entry) => entry.type === 'chapter' && entry.index === 1
  ).seconds;
  const preludeHint =
    variant === 'agent'
      ? (Date.parse(recording.trace.find((entry) => entry.type === 'task')?.at) -
          Date.parse(recording.trace.find((entry) => entry.type === 'ready')?.at)) /
        1000
      : 0;
  if (!Number.isFinite(preludeHint) || preludeHint < 0)
    throw new Error('Recording is missing its prelude timing hint.');
  // The hint narrows the visual search; the actual pixels still determine trim.
  const matches = runs.filter(
    (run) => Math.abs(run.start - (expected + preludeHint)) < 5 && run.end - run.start > 5
  );
  if (matches.length !== 1)
    throw new Error('Ambiguous visual alignment; inspect the recording instead of guessing.');
  const leadIn = Math.max(0, matches[0].start - expected);
  writeFileSync(
    demo('alignment.json'),
    JSON.stringify(
      {
        pixel: { x, y },
        expectedSwitchSeconds: expected,
        preludeHintSeconds: preludeHint,
        observedRun: matches[0],
        leadIn
      },
      null,
      2
    ) + '\n'
  );
  const encodeArgs = [
    '-y',
    '-v',
    'error',
    '-ss',
    leadIn.toFixed(3),
    '-i',
    recording.path,
    '-i',
    demo('narration.wav'),
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '25',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-metadata',
    `title=${profile.title}`,
    '-metadata',
    `comment=${profile.description}`,
    '-t',
    '120',
    '-movflags',
    '+faststart'
  ];
  const cleanCandidate = resolve(candidateDirectory, 'clean.mp4');
  const captionedCandidate = resolve(candidateDirectory, 'captioned.mp4');
  // Native player controls obscured the disclosure when paused. Keep the
  // recorded picture unscaled and add a small control margin beneath it.
  const controlMargin = 'pad=iw:ih+64:0:0:color=0x101511';
  run('ffmpeg', [
    ...encodeArgs,
    '-vf',
    `ass=${demo('disclosure.ass')},${controlMargin}`,
    cleanCandidate
  ]);
  // Caption placement is baked into this copy so a player's defaults cannot hide
  // the persistent scripted-call disclosure. The clean master and SRT stay separate.
  run('ffmpeg', [
    ...encodeArgs,
    '-vf',
    `ass=${demo('narration.ass')},${controlMargin}`,
    captionedCandidate
  ]);
  const outputSeconds = duration(captionedCandidate);
  if (outputSeconds >= 180 || Math.abs(outputSeconds - 120) > 0.2)
    throw new Error(`Unexpected output duration: ${outputSeconds}`);
  if (Math.abs(duration(cleanCandidate) - outputSeconds) > 0.001)
    throw new Error('Clean and captioned masters have different durations.');
  renameSync(cleanCandidate, demo('benchkeeper-local-demo-clean.mp4'));
  renameSync(captionedCandidate, demo('benchkeeper-local-demo.mp4'));
  const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
  writeFileSync(
    demo('demo-metadata.json'),
    JSON.stringify(
      {
        output: output('benchkeeper-local-demo.mp4'),
        assemblyId,
        mediaVersions,
        videoSha256: digest(demo('benchkeeper-local-demo.mp4')),
        captionsSha256: digest(demo('narration.srt')),
        cleanMaster: output('benchkeeper-local-demo-clean.mp4'),
        captions: 'Burned-in, engine-timed, two lines maximum; separate SRT retained',
        disclosure:
          'Original recorder strip redrawn in the same 36px area so native dialog blur cannot hide it',
        playbackControlPaddingPixels: 64,
        durationSeconds: outputSeconds,
        leadInTrimmedSeconds: leadIn,
        narration: 'Local eSpeak NG synthetic speech',
        recording: profile.description,
        variant,
        choiceSource: variant === 'agent' ? 'external-developer-agent' : 'fixed-rehearsal',
        independentAgentEvaluation: false,
        published: false
      },
      null,
      2
    ) + '\n'
  );
  promoteDemoArtifacts(stagedDirectory, profile.directory, [
    'narration.srt',
    'narration.txt',
    'audio-metadata.json',
    'caption-timing.json',
    'alignment.json',
    'disclosure.ass',
    'narration.ass',
    'narration.wav',
    'benchkeeper-local-demo-clean.mp4',
    'benchkeeper-local-demo.mp4',
    'demo-metadata.json'
  ]);
  writeFileSync(
    statusFile,
    JSON.stringify({ assemblyId, status: 'complete', published: false }, null, 2) + '\n'
  );
  console.log(
    JSON.stringify({
      durationSeconds: outputSeconds,
      output: output('benchkeeper-local-demo.mp4'),
      published: false
    })
  );
} catch (error) {
  writeFileSync(
    statusFile,
    JSON.stringify(
      { assemblyId, status: 'failed', error: error.message, published: false },
      null,
      2
    ) + '\n'
  );
  throw error;
}
