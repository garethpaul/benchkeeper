import { describe, expect, it } from 'vitest';
import { assertRecordingProvenance, alignNarrationToRecording } from '../scripts/demo-provenance';
import { promoteDemoArtifacts } from '../scripts/demo-artifacts';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';

// These are metadata fixtures, not mocked browser verification or real footage.
const fixed = () => ({ trace: [{ type: 'native-rehearsal' }, { type: 'complete' }] });
const agent = () => ({
  status: 'complete',
  choiceSource: 'external-developer-agent',
  organizerActions: 'automated',
  independentBenchmark: false,
  errors: [],
  blockedNetwork: [],
  trace: [
    { type: 'native-call', choiceSource: 'external-developer-agent' },
    { type: 'complete', choiceSource: 'external-developer-agent' }
  ]
});

describe('narration follows the recorded camera beats', () => {
  const planned = [
    { start: 0, duration: 14, narration: 'Protected appointment.' },
    { start: 14, duration: 22, narration: 'Native tools.' },
    { start: 36, duration: 84, narration: 'Review the consequences.' }
  ];
  const trace = (times: unknown[]) =>
    times.map((seconds, index) => ({ type: 'chapter', index, seconds }));

  it('uses actual late beats without retiming the picture or mutating the plan', () => {
    const result = alignNarrationToRecording(planned, trace([0.0002, 18.05, 37.2]));
    expect(result.map(({ start }) => start)).toEqual([0.0002, 18.05, 37.2]);
    expect(result[0].duration).toBeCloseTo(18.0498);
    expect(result[1].duration).toBeCloseTo(19.15);
    expect(result.at(-1)!.start + result.at(-1)!.duration).toBe(120);
    expect(result.map(({ narration }) => narration)).toEqual(
      planned.map(({ narration }) => narration)
    );
    expect(planned[1].start).toBe(14);
  });

  it('refuses missing, reordered, duplicate or unusable camera beats', () => {
    for (const invalid of [
      null,
      trace([0, 18]),
      trace([0, 18, 120]),
      trace([0, 18, 17]),
      trace([0, '18', 37]),
      trace([0, NaN, 37]),
      trace([-1, 18, 37]),
      trace([0, 18, 37]).reverse(),
      [...trace([0, 18, 37]), { type: 'chapter', index: 1, seconds: 18 }]
    ])
      expect(() => alignNarrationToRecording(planned, invalid)).toThrow(/chapter/i);
    for (const invalid of [
      [],
      [{ start: 0, duration: -1 }],
      [{ start: 0, duration: NaN }],
      [{ start: 1, duration: 120 }],
      [
        { start: 0, duration: 10 },
        { start: 12, duration: 108 }
      ],
      [
        { start: 0, duration: 1e308 },
        { start: 1e308, duration: 1e308 }
      ]
    ])
      expect(() =>
        alignNarrationToRecording(invalid, trace(invalid.map((_, index) => index * 18)))
      ).toThrow(/chapter/i);
  });
});

describe('local demo artifact replacement', () => {
  function fixture(run: (staged: string, selected: string) => void) {
    mkdirSync('work/test-demo-artifacts', { recursive: true });
    const directory = mkdtempSync('work/test-demo-artifacts/case-');
    const staged = join(directory, 'staged');
    const selected = join(directory, 'selected');
    mkdirSync(staged);
    mkdirSync(selected);
    for (const name of ['video.mp4', 'narration.srt']) {
      writeFileSync(join(staged, name), `new ${name}`);
      writeFileSync(join(selected, name), `old ${name}`);
    }
    try {
      run(staged, selected);
    } finally {
      rmSync(directory, { recursive: true });
    }
  }

  it('replaces the complete selected set after all staging succeeds', () => {
    fixture((staged, selected) => {
      promoteDemoArtifacts(staged, selected, ['video.mp4', 'narration.srt']);
      for (const name of ['video.mp4', 'narration.srt'])
        expect(readFileSync(join(selected, name), 'utf8')).toBe(`new ${name}`);
    });
  });

  it('refuses an incomplete staged set before changing the previous artifacts', () => {
    fixture((staged, selected) => {
      rmSync(join(staged, 'narration.srt'));
      expect(() =>
        promoteDemoArtifacts(staged, selected, ['video.mp4', 'narration.srt'])
      ).toThrow();
      for (const name of ['video.mp4', 'narration.srt'])
        expect(readFileSync(join(selected, name), 'utf8')).toBe(`old ${name}`);
    });
  });

  it('restores earlier replacements if a later file move fails', () => {
    fixture((staged, selected) => {
      writeFileSync(join(staged, 'new-note.txt'), 'Only the new take has this file.');
      let moves = 0;
      expect(() =>
        promoteDemoArtifacts(
          staged,
          selected,
          ['video.mp4', 'new-note.txt', 'narration.srt'],
          (from, to) => {
            if (++moves === 3) throw new Error('Synthetic file replacement failure.');
            renameSync(from, to);
          }
        )
      ).toThrow('Synthetic file replacement failure.');
      expect(moves).toBe(3);
      for (const name of ['video.mp4', 'narration.srt'])
        expect(readFileSync(join(selected, name), 'utf8')).toBe(`old ${name}`);
      expect(existsSync(join(selected, 'new-note.txt'))).toBe(false);
    });
  });
});
describe('recording disclosure provenance', () => {
  it('accepts complete fixed and explicitly labelled developer-agent recordings', () => {
    expect(() => assertRecordingProvenance(fixed(), 'fixed')).not.toThrow();
    expect(() => assertRecordingProvenance(agent(), 'agent')).not.toThrow();
  });
  it('refuses to paint a fixed recording as agent-chosen or an agent recording as no-LLM', () => {
    expect(() => assertRecordingProvenance(fixed(), 'agent')).toThrow(/provenance/i);
    expect(() => assertRecordingProvenance(agent(), 'fixed')).toThrow(/provenance/i);
  });
  it('rejects incomplete recordings, even when their top-level status claims completion', () => {
    expect(() => assertRecordingProvenance({ ...agent(), trace: [] }, 'agent')).toThrow();
    expect(() => assertRecordingProvenance(null, 'fixed')).toThrow();
  });
  it('rejects failures and unsupported benchmark or organizer claims', () => {
    for (const patch of [
      { errors: ['recording failed'] },
      { blockedNetwork: ['https://invalid.example/'] },
      { status: 'failed' },
      { independentBenchmark: true },
      { organizerActions: 'real human' }
    ])
      expect(() => assertRecordingProvenance({ ...agent(), ...patch }, 'agent')).toThrow(
        /provenance/i
      );
  });
  it('rejects mixed or missing native-call provenance inside an agent recording', () => {
    for (const entry of [{ type: 'native-rehearsal' }, { type: 'native-call' }]) {
      const recording = agent();
      recording.trace.splice(1, 0, entry as (typeof recording.trace)[number]);
      expect(() => assertRecordingProvenance(recording, 'agent')).toThrow(/provenance/i);
    }
    expect(() =>
      assertRecordingProvenance(
        { ...agent(), trace: [{ type: 'complete', choiceSource: 'external-developer-agent' }] },
        'agent'
      )
    ).toThrow(/provenance/i);
  });
});
