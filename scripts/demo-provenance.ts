export type DemoVariant = 'fixed' | 'agent';

export function alignNarrationToRecording<T extends { start: number; duration: number }>(
  storyboard: readonly T[],
  trace: unknown
): T[] {
  const invalid = () => new Error('Recording chapter timings are missing or invalid.');
  if (!storyboard.length || !Array.isArray(trace)) throw invalid();
  let total = 0;
  for (const chapter of storyboard) {
    if (
      !Number.isFinite(chapter.start) ||
      !Number.isFinite(chapter.duration) ||
      chapter.duration <= 0 ||
      Math.abs(chapter.start - total) > 0.000001
    )
      throw invalid();
    total = chapter.start + chapter.duration;
    if (!Number.isFinite(total)) throw invalid();
  }
  const chapters = trace.filter((entry) => entry?.type === 'chapter');
  if (chapters.length !== storyboard.length) throw invalid();
  const starts = chapters.map((chapter, index) => {
    if (
      chapter.index !== index ||
      typeof chapter.seconds !== 'number' ||
      !Number.isFinite(chapter.seconds) ||
      chapter.seconds < 0 ||
      chapter.seconds >= total
    )
      throw invalid();
    return chapter.seconds as number;
  });
  // The recorded picture is untouched. Fit narration into the camera beats
  // that actually happened, not their intended times; synthesis later refuses
  // a chapter whose speech no longer fits. Never silently accelerate speech.
  return storyboard.map((chapter, index) => {
    const start = starts[index];
    const duration = (starts[index + 1] ?? total) - start;
    if (duration <= 0) throw invalid();
    return { ...chapter, start, duration };
  });
}

// Prevent mixing recording modes and painting the wrong disclosure. This checks
// metadata consistency; it does not authenticate a model or prove a benchmark.
export function assertRecordingProvenance(recording: unknown, variant: DemoVariant): void {
  if (!recording || typeof recording !== 'object') throw new Error('Recording did not finish.');
  const data = recording as Record<string, unknown>;
  const trace = data.trace;
  if (!Array.isArray(trace) || trace.at(-1)?.type !== 'complete')
    throw new Error('Recording did not finish.');
  const fails = () => {
    throw new Error('Recording provenance does not match this demo variant.');
  };
  for (const field of ['errors', 'blockedNetwork'])
    if (data[field] !== undefined && (!Array.isArray(data[field]) || data[field].length)) fails();
  if (data.status === 'failed' || data.independentBenchmark === true) fails();
  const calls = trace.filter((entry) => entry?.type === 'native-call');
  const rehearsal = trace.some((entry) => entry?.type === 'native-rehearsal');
  if (variant === 'fixed') {
    if (
      (data.choiceSource !== undefined && data.choiceSource !== 'fixed-rehearsal') ||
      !rehearsal ||
      calls.some((entry) => entry.choiceSource === 'external-developer-agent') ||
      (data.organizerActions !== undefined && data.organizerActions !== 'automated')
    )
      fails();
  } else if (
    data.status !== 'complete' ||
    data.choiceSource !== 'external-developer-agent' ||
    data.organizerActions !== 'automated' ||
    data.independentBenchmark !== false ||
    !Array.isArray(data.errors) ||
    !Array.isArray(data.blockedNetwork) ||
    rehearsal ||
    !calls.length ||
    calls.some((entry) => entry.choiceSource !== 'external-developer-agent') ||
    trace.at(-1).choiceSource !== 'external-developer-agent'
  )
    fails();
}
