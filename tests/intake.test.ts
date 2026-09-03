import { describe, it, expect } from 'vitest';
import { parseIntake, intakeHeader, intakeExample } from '../src/intake';
import { demoEvent } from '../src/demo';
import { DeskStore } from '../src/store';
import { clockFor } from '../src/domain';

const row = ',Radio,Visitor A,electrical,30,10:00,13:00,yes,';
const sheet = (body: string) => `${intakeHeader}\n${body}`;

describe('spreadsheet intake', () => {
  it('preserves quoted commas, quotes, Unicode and embedded note line breaks as text', () => {
    const note = '  First line\tcheck\nA "quoted" note <script>  ';
    const cells = [
      '',
      'Radio, kitchen',
      'Visitor Á',
      'electrical',
      '30',
      '10:00',
      '13:00',
      'no',
      note
    ];
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    for (const delimiter of [',', '\t'])
      for (const lineEnding of ['\n', '\r\n'])
        for (const bom of ['', '\uFEFF']) {
          const text =
            bom +
            intakeHeader.split(',').map(quote).join(delimiter) +
            lineEnding +
            cells.map(quote).join(delimiter) +
            lineEnding;
          const result = parseIntake(text, demoEvent());
          expect(result.ok, JSON.stringify({ delimiter, lineEnding, bom: !!bom })).toBe(true);
          if (!result.ok) continue;
          expect(result.requests[0]).toMatchObject({
            title: 'Radio, kitchen',
            visitor: 'Visitor Á',
            partsReady: false,
            note
          });
        }
  });
  it('reads pasted tab-separated rows without losing a trailing empty cell', () => {
    const input = '\uFEFF' + sheet(row).replaceAll(',', '\t');
    const result = parseIntake(input, demoEvent());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe('TSV');
    expect(result.requests[0].note).toBe('');
  });
  it('uses the event clock, including midnight as the end of a late session', () => {
    const event = { ...demoEvent(), startMinutes: 1260 };
    const result = parseIntake(sheet(row.replace('10:00,13:00', '21:15,24:00')), event);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.requests[0]).toMatchObject({ arrival: 1, leaveBy: 12 });
    const wrongClock = parseIntake(sheet(row), event);
    expect(wrongClock.ok).toBe(false);
    if (!wrongClock.ok)
      expect(wrongClock.issues.some((issue) => issue.field === 'arrives')).toBe(true);
  });
  it('round-trips generated sheet clocks at every supported session start', () => {
    // Includes the two day boundaries and every quarter-hour start between.
    // A valid example must never tell an organizer to paste an invalid clock.
    for (let startMinutes = 0; startMinutes <= 1260; startMinutes += 15) {
      const event = { ...demoEvent(), startMinutes };
      const result = parseIntake(intakeExample(event), event);
      expect(result.ok, `Example for ${clockFor(event)(0)}`).toBe(true);
      if (!result.ok) continue;
      expect(result.requests.map(({ arrival, leaveBy }) => [arrival, leaveBy])).toEqual([
        [0, 12],
        [2, 10]
      ]);
    }
  });
  it('generates IDs around explicit and existing IDs without changing supplied IDs', () => {
    const event = demoEvent();
    event.requests.push({ ...event.requests[0], id: 'r-intake-1' });
    const result = parseIntake(
      sheet(`${row}\nr-intake-2,Stool,Visitor B,general,15,10:00,13:00,yes,`),
      event
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.requests.map((request) => request.id)).toEqual(['r-intake-3', 'r-intake-2']);
  });
  it.each([
    ['missing parts decision', row.replace(',yes,', ',,')],
    ['invalid duration', row.replace(',30,', ',20,')],
    ['invalid clock step', row.replace('10:00', '10:01')],
    ['window too short', row.replace('13:00', '10:15')],
    ['unsupported skill', row.replace('electrical', 'unknown')],
    ['existing ID', `r-lamp${row}`],
    ['missing cell', row.slice(0, -1)]
  ])('rejects %s with a row-specific error and no partial request result', (_name, bad) => {
    const result = parseIntake(sheet(`${row}\n${bad}`), demoEvent());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.row === 3)).toBe(true);
    expect('requests' in result).toBe(false);
  });
  it('rejects duplicate/unknown headers, malformed quotes, empty and excessive batches', () => {
    for (const input of [
      sheet(row).replace('parts_ready', 'item'),
      sheet(row).replace('note', '__proto__'),
      sheet(row + '"unterminated'),
      intakeHeader,
      sheet(Array(13).fill(row).join('\n')),
      'x'.repeat(100001)
    ])
      expect(parseIntake(input, demoEvent()).ok).toBe(false);
  });
  it('keeps spreadsheet-looking formulas as unevaluated note text', () => {
    const result = parseIntake(sheet(row + '=1+1'), demoEvent());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.requests[0].note).toBe('=1+1');
  });
  it('appends atomically, preserves every appointment, rejects stale/duplicate writes and undoes once', () => {
    const store = new DeskStore();
    const before = structuredClone(store.getSnapshot());
    const parsed = parseIntake(intakeExample(before.event), before.event);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(() =>
      store.appendRequests([...parsed.requests, before.event.requests[0]], before.revision)
    ).toThrow();
    expect(store.getSnapshot()).toEqual(before);
    store.appendRequests(parsed.requests, before.revision);
    expect(store.getSnapshot().event.assignments).toEqual(before.event.assignments);
    expect(store.getSnapshot().event.requests).toHaveLength(14);
    expect(() => store.appendRequests(parsed.requests, before.revision)).toThrow('changed');
    expect(() => store.appendRequests(parsed.requests, store.getSnapshot().revision)).toThrow(
      'Duplicate'
    );
    store.undo(store.getSnapshot().revision);
    expect(store.getSnapshot().event).toEqual(before.event);
  });
});
