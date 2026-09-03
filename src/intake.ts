import { parse } from 'csv-parse/browser/esm/sync';
import { clockFor, requestSchema, type RepairEvent, type RepairRequest } from './domain';

const required = ['item', 'visitor', 'skill', 'minutes', 'arrives', 'leaves', 'parts_ready'];
const optional = ['id', 'note'];
export const intakeHeader = 'id,item,visitor,skill,minutes,arrives,leaves,parts_ready,note';
export type IntakeIssue = { row: number | null; field: string | null; message: string };
export type IntakeResult =
  | { ok: true; requests: RepairRequest[]; format: 'CSV' | 'TSV' }
  | { ok: false; issues: IntakeIssue[] };

export function intakeExample(event: RepairEvent) {
  const clock = clockFor(event);
  return `${intakeHeader}\n,Wooden stool,Visitor A,general,30,${clock(0)},${clock(12)},yes,Example data — replace before adding\n,Jacket seam,Visitor B,textiles,15,${clock(2)},${clock(10)},yes,`;
}

function slot(value: string, event: RepairEvent) {
  if (value !== '24:00' && !/^([01]\d|2[0-3]):(00|15|30|45)$/.test(value))
    throw new Error('Use a 24-hour HH:MM time in 15-minute steps.');
  const [hours, minutes] = value.split(':').map(Number);
  const index = (hours * 60 + minutes - event.startMinutes) / 15;
  if (index < 0 || index > 12)
    throw new Error(`Use a time inside this event: ${clockFor(event)(0)}–${clockFor(event)(12)}.`);
  return index;
}

// No event mutation, type coercion of arbitrary values, formula execution or
// network access. Both UI preview and final append validate independently.
export function parseIntake(text: string, event: RepairEvent): IntakeResult {
  const issues: IntakeIssue[] = [];
  const issue = (message: string, row: number | null = null, field: string | null = null) =>
    issues.push({ row, field, message });
  if (text.length > 100000)
    return {
      ok: false,
      issues: [{ row: null, field: null, message: 'Paste at most 100,000 characters.' }]
    };
  // Do not trim the document: a final tab can represent an empty note cell.
  const input = text.replace(/^\uFEFF/, '');
  const headerLine = input.split(/\r\n|\r|\n/).find((line) => line.trim().length > 0) ?? '';
  const delimiter = headerLine.includes('\t') ? '\t' : ',';
  let rows: string[][];
  try {
    rows = parse(input, {
      delimiter,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      max_record_size: 10000
    });
  } catch {
    return {
      ok: false,
      issues: [
        {
          row: null,
          field: null,
          message:
            'The sheet could not be parsed. Check balanced quotes and comma/tab separators. No rows were added.'
        }
      ]
    };
  }
  if (rows.length < 2)
    return {
      ok: false,
      issues: [
        { row: null, field: null, message: 'Include a header and at least one request row.' }
      ]
    };
  const header = rows[0].map((cell) => cell.trim().toLowerCase().replace(/[ -]+/g, '_'));
  const allowed = new Set([...required, ...optional]);
  if (header.length > allowed.size)
    return {
      ok: false,
      issues: [
        {
          row: 1,
          field: null,
          message: 'Use only the nine documented columns; unexpected extra columns were found.'
        }
      ]
    };
  for (const field of required)
    if (!header.includes(field)) issue(`Required column is missing: ${field}.`, 1, field);
  for (const field of header)
    if (!allowed.has(field)) issue(`Unknown column: ${field || '(empty)'}.`, 1, field);
  if (new Set(header).size !== header.length) issue('Column names must be unique.', 1);
  if (rows.length - 1 + event.requests.length > 24)
    issue(
      `This batch would exceed 24 requests. The event has room for ${24 - event.requests.length} more.`
    );
  if (issues.length) return { ok: false, issues };

  const idColumn = header.indexOf('id');
  const reserved = new Set([
    ...event.requests.map((r) => r.id),
    ...rows
      .slice(1)
      .map((row) => row[idColumn]?.trim())
      .filter((id): id is string => !!id)
  ]);
  const occupied = new Set(event.requests.map((r) => r.id));
  let sequence = 0;
  const requests: RepairRequest[] = [];
  for (const [index, cells] of rows.slice(1).entries()) {
    const row = index + 2;
    if (cells.length !== header.length) {
      issue(`Expected ${header.length} cells, found ${cells.length}.`, row);
      continue;
    }
    const record: Record<string, string> = Object.fromEntries(
      header.map((field, i) => [field, cells[i]])
    );
    let id = record.id?.trim();
    if (!id) {
      do {
        id = `r-intake-${++sequence}`;
      } while (reserved.has(id));
      reserved.add(id);
    }
    if (occupied.has(id))
      issue(
        'ID already exists in the event or this batch. Intake only adds new requests.',
        row,
        'id'
      );
    occupied.add(id);
    if (!/^(15|30|45|60|75|90)$/.test(record.minutes.trim()))
      issue('Use 15, 30, 45, 60, 75 or 90 estimated minutes.', row, 'minutes');
    const parts = record.parts_ready.trim().toLowerCase();
    if (parts !== 'yes' && parts !== 'no')
      issue(
        'Enter yes or no explicitly; parts availability is never inferred.',
        row,
        'parts_ready'
      );
    const times: Record<string, number> = {};
    for (const field of ['arrives', 'leaves']) {
      try {
        times[field] = slot(record[field].trim(), event);
      } catch (error) {
        issue(error instanceof Error ? error.message : 'Invalid time.', row, field);
      }
    }
    if (issues.some((issue) => issue.row === row)) continue;
    const parsed = requestSchema.safeParse({
      id,
      title: record.item,
      visitor: record.visitor,
      skill: record.skill.trim().toLowerCase(),
      duration: Number(record.minutes) / 15,
      arrival: times.arrives,
      leaveBy: times.leaves,
      partsReady: parts === 'yes',
      note: record.note ?? ''
    });
    if (!parsed.success) {
      const fields: Record<string, string> = {
        title: 'item',
        duration: 'minutes',
        arrival: 'arrives',
        leaveBy: 'leaves',
        partsReady: 'parts_ready'
      };
      for (const error of parsed.error.issues) {
        const key = String(error.path[0] ?? '');
        issue(error.message, row, fields[key] ?? (key || null));
      }
    } else requests.push(parsed.data);
  }
  return issues.length
    ? { ok: false, issues }
    : { ok: true, requests, format: delimiter === '\t' ? 'TSV' : 'CSV' };
}
