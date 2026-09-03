import { z } from 'zod';

export const skills = ['electrical', 'textiles', 'bicycle', 'general'] as const;
export const skillSchema = z.enum(skills);
export const slotSchema = z.number().int().min(0).max(12);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
const label = z.string().trim().min(1).max(80);
export const sessionStartSchema = z.number().int().min(0).max(1260).multipleOf(15);
export const timeBlockSchema = z.strictObject({
  id,
  label,
  kind: z.enum(['break', 'walk-in']),
  start: slotSchema,
  duration: z.number().int().min(1).max(12)
});
export const requestSchema = z
  .strictObject({
    id,
    title: label,
    visitor: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .describe(
        'Anonymous label for human reference, not a unique person identifier. Use the request ID to identify a record. Requests are planned independently; same-person attendance overlaps are not checked.'
      ),
    skill: skillSchema.describe('Recorded skill needed; not a safety certification.'),
    duration: z
      .number()
      .int()
      .min(1)
      .max(6)
      .describe('Estimated appointment length in 15-minute slots: 1 to 6 (15 to 90 minutes).'),
    arrival: slotSchema.describe(
      'Earliest arrival in 15-minute slots after the event start. Read timeWindow first: 0=start, 4=one hour later.'
    ),
    leaveBy: slotSchema.describe(
      'Visitor departure deadline in the same slot units. Appointment must finish by this slot.'
    ),
    partsReady: z.boolean(),
    note: z.string().max(240)
  })
  .refine(
    (r) => r.arrival < r.leaveBy && r.duration <= r.leaveBy - r.arrival,
    'Arrival, departure and estimated duration must leave a usable appointment window.'
  );
export const volunteerSchema = z
  .strictObject({
    id,
    name: label,
    skills: z.array(skillSchema).min(1).max(4),
    start: slotSchema,
    end: slotSchema,
    available: z.boolean(),
    blocks: z.array(timeBlockSchema).max(4).default([])
  })
  .refine((v) => v.start < v.end, 'A volunteer must have a usable availability window.')
  .superRefine((v, ctx) => {
    if (new Set(v.blocks.map((b) => b.id)).size !== v.blocks.length)
      ctx.addIssue({ code: 'custom', message: 'Reserved-time blocks must have unique IDs.' });
    v.blocks.forEach((b, i) => {
      if (b.start < v.start || b.start + b.duration > v.end)
        ctx.addIssue({
          code: 'custom',
          message: 'Reserved time must fit inside this repairer’s availability.'
        });
      if (
        v.blocks
          .slice(0, i)
          .some(
            (other) => b.start < other.start + other.duration && other.start < b.start + b.duration
          )
      )
        ctx.addIssue({ code: 'custom', message: 'Reserved-time blocks cannot overlap.' });
    });
  });
export const assignmentSchema = z.strictObject({
  requestId: id,
  volunteerId: id,
  start: slotSchema,
  duration: z.number().int().min(1).max(8),
  locked: z.boolean()
});
export const eventSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    name: label,
    startMinutes: sessionStartSchema.default(600),
    requests: z.array(requestSchema).max(24),
    volunteers: z.array(volunteerSchema).max(8),
    assignments: z.array(assignmentSchema).max(24)
  })
  .superRefine((event, ctx) => {
    for (const key of ['requests', 'volunteers'] as const) {
      if (new Set(event[key].map((x) => x.id)).size !== event[key].length)
        ctx.addIssue({ code: 'custom', message: `Duplicate ${key} IDs.` });
    }
    if (new Set(event.assignments.map((x) => x.requestId)).size !== event.assignments.length)
      ctx.addIssue({ code: 'custom', message: 'A request may only have one appointment.' });
    for (const a of event.assignments) {
      if (
        !event.requests.some((r) => r.id === a.requestId) ||
        !event.volunteers.some((v) => v.id === a.volunteerId)
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Assignment refers to an unknown request or volunteer.'
        });
    }
  });
export const scenarioSchema = z.strictObject({
  objective: z
    .enum(['keep-promises', 'most-appointments', 'earlier-visitors'])
    .describe(
      'Soft preference: keep-promises prioritizes already-booked requests, then their exact times; most-appointments prioritizes count, then retaining booked requests and their exact times; earlier-visitors favors earlier arrivals. Protected appointments and reserved time remain hard constraints in all modes. Counts are appointments/request records, not unique people.'
    )
    .default('keep-promises'),
  absentVolunteerId: id
    .nullable()
    .describe(
      'ID from the complete event roster; null keeps recorded availability. Never guess from an ambiguous name.'
    )
    .default(null),
  extraSlots: z
    .number()
    .int()
    .min(0)
    .max(2)
    .describe(
      'Add 0, 1 or 2 fifteen-minute slots to every estimate. A protected shorter appointment will cause a conflict.'
    )
    .default(0),
  readyRequestId: id
    .nullable()
    .describe(
      'One request whose missing parts are now available in this scenario; null leaves recorded parts unchanged.'
    )
    .default(null),
  priorityRequestId: id
    .nullable()
    .describe(
      'Try to fit this request first, potentially displacing unprotected appointments; null adds no individual priority.'
    )
    .default(null)
});
export type RepairRequest = z.infer<typeof requestSchema>;
export type Volunteer = z.infer<typeof volunteerSchema>;
export type TimeBlock = z.infer<typeof timeBlockSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type RepairEvent = z.infer<typeof eventSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export const objectiveLabels: Record<Scenario['objective'], string> = {
  'keep-promises': 'Keep booked visitors',
  'most-appointments': 'Fit more appointments',
  'earlier-visitors': 'Prioritize earlier arrivals'
};
export const objectiveDescriptions: Record<Scenario['objective'], string> = {
  'keep-promises':
    'Try to retain existing bookings, then their exact slots. This can fit fewer total appointments.',
  'most-appointments':
    'Try to fit the most appointments. On a count tie, favor existing bookings, then their exact slots.',
  'earlier-visitors':
    'Favor visitors with earlier arrival times. Booked visitors and exact slots may change.'
};
export const objectives = Object.keys(objectiveLabels) as Scenario['objective'][];
export const planningScopeDescription =
  'Plan the whole session before it starts; elapsed time and repair progress are not tracked.';
export type Exclusion = {
  requestId: string;
  reason: string;
  code: 'parts' | 'skill' | 'window' | 'capacity';
};
export type Proposal = {
  id: string;
  baseRevision: number;
  sourceEvent: RepairEvent;
  scenario: Scenario;
  assignments: Assignment[];
  excluded: Exclusion[];
  conflicts: string[];
  examined: number;
  score: number;
  metrics: {
    scheduled: number;
    retained: number;
    moved: number;
    newlyScheduled: number;
    noLongerScheduled: number;
    protected: number;
    volunteerMinutes: number;
  };
};
export const emptyScenario = (): Scenario => ({
  objective: 'keep-promises',
  absentVolunteerId: null,
  extraSlots: 0,
  readyRequestId: null,
  priorityRequestId: null
});
// Different objectives are comparable only when every other assumption and the
// source revision agree. List the fields explicitly: no coercion or label matching.
export function comparableProposals(a: Proposal, b: Proposal) {
  return (
    a.baseRevision === b.baseRevision &&
    a.scenario.absentVolunteerId === b.scenario.absentVolunteerId &&
    a.scenario.extraSlots === b.scenario.extraSlots &&
    a.scenario.readyRequestId === b.scenario.readyRequestId &&
    a.scenario.priorityRequestId === b.scenario.priorityRequestId
  );
}
export function comparisonChoices(selected: Proposal, proposals: Proposal[], revision: number) {
  if (selected.baseRevision !== revision) return [];
  return objectives.flatMap((objective) => {
    const match =
      selected.scenario.objective === objective
        ? selected
        : proposals.find(
            (p) => p.scenario.objective === objective && comparableProposals(selected, p)
          );
    return match ? [match] : [];
  });
}
export const time = (slot: number, startMinutes = 600) => {
  const minutes = startMinutes + slot * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};
export const clockFor = (event: Pick<RepairEvent, 'startMinutes'>) => (slot: number) =>
  time(slot, event.startMinutes);
export function parseStartTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error('Choose a session start in HH:MM format.');
  const [hours, minutes] = value.split(':').map(Number);
  if (minutes > 59) throw new Error('Invalid minutes in session start.');
  return sessionStartSchema.parse(hours * 60 + minutes);
}
export const sameAppointment = (a: Assignment, b: Assignment) =>
  a.requestId === b.requestId &&
  a.volunteerId === b.volunteerId &&
  a.start === b.start &&
  a.duration === b.duration;
// Compare canonical Unicode equivalents without rewriting human labels.
// NFC does not fold compatibility forms or attempt homoglyph detection.
export const labelKey = (value: string) => value.normalize('NFC').toLowerCase().normalize('NFC');

// Decorative initials must not cut a surrogate pair or a supported grapheme.
// Older browsers get one NFC code point, not a grapheme-segmentation polyfill.
export function nameInitial(name: string) {
  if (typeof Intl.Segmenter === 'function') {
    const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name);
    return segments[Symbol.iterator]().next().value?.segment ?? '';
  }
  return Array.from(name.normalize('NFC'))[0] ?? '';
}

export function repairerLabel(event: RepairEvent, id: string) {
  const repairer = event.volunteers.find((v) => v.id === id);
  if (!repairer) return 'Unknown repairer';
  const duplicate =
    event.volunteers.filter((v) => labelKey(v.name) === labelKey(repairer.name)).length > 1;
  return duplicate ? `${repairer.name} [${repairer.id}]` : repairer.name;
}
export const overlap = (a: Assignment, b: Assignment) =>
  a.volunteerId === b.volunteerId &&
  a.start < b.start + b.duration &&
  b.start < a.start + a.duration;

export function requestLabel(event: RepairEvent, id: string) {
  const request = event.requests.find((r) => r.id === id);
  if (!request) return 'Unknown request';
  const matchingTitles = event.requests.filter(
    (r) => labelKey(r.title) === labelKey(request.title)
  );
  if (matchingTitles.length === 1) return request.title;
  const duplicateVisitor =
    matchingTitles.filter((r) => labelKey(r.visitor) === labelKey(request.visitor)).length > 1;
  return `${request.title} — ${request.visitor}${duplicateVisitor ? ` [${request.id}]` : ''}`;
}

export function proposalChanges(proposal: Proposal) {
  // Conflicted proposals contain no usable plan; do not misreport every
  // existing appointment as deliberately removed in that case.
  if (proposal.conflicts.length) return [];
  return proposal.sourceEvent.requests.flatMap((request) => {
    const before = proposal.sourceEvent.assignments.find((a) => a.requestId === request.id) ?? null;
    const after = proposal.assignments.find((a) => a.requestId === request.id) ?? null;
    if ((!before && !after) || (before && after && sameAppointment(before, after))) return [];
    return [
      {
        requestId: request.id,
        title: request.title,
        visitor: request.visitor,
        before,
        after,
        kind: !before
          ? ('newly-placed' as const)
          : !after
            ? ('no-longer-placed' as const)
            : ('moved' as const)
      }
    ];
  });
}

export function scenarioEvent(event: RepairEvent, scenario: Scenario): RepairEvent {
  if (
    scenario.absentVolunteerId &&
    !event.volunteers.some((v) => v.id === scenario.absentVolunteerId)
  )
    throw new Error('Unknown absent volunteer. Read the event first.');
  if (scenario.readyRequestId && !event.requests.some((r) => r.id === scenario.readyRequestId))
    throw new Error('Unknown request for available parts.');
  if (
    scenario.priorityRequestId &&
    !event.requests.some((r) => r.id === scenario.priorityRequestId)
  )
    throw new Error('Unknown priority request.');
  return {
    ...event,
    volunteers: event.volunteers.map((v) =>
      v.id === scenario.absentVolunteerId ? { ...v, available: false } : v
    ),
    requests: event.requests.map((r) =>
      r.id === scenario.readyRequestId ? { ...r, partsReady: true } : r
    )
  };
}

export function assignmentProblem(event: RepairEvent, a: Assignment): string | null {
  const r = event.requests.find((r) => r.id === a.requestId);
  const v = event.volunteers.find((v) => v.id === a.volunteerId);
  if (!r || !v) return 'Unknown request or volunteer.';
  if (!r.partsReady) return `${r.title}: required parts are not ready.`;
  if (!v.available) return `${r.title}: ${v.name} is unavailable.`;
  if (!v.skills.includes(r.skill)) return `${r.title}: ${v.name} does not have the recorded skill.`;
  if (v.blocks.some((b) => a.start < b.start + b.duration && b.start < a.start + a.duration))
    return `${r.title}: appointment overlaps reserved time for ${v.name}.`;
  if (a.duration < r.duration) return `${r.title}: appointment is shorter than the estimate.`;
  if (
    a.start < Math.max(r.arrival, v.start) ||
    a.start + a.duration > Math.min(r.leaveBy, v.end, 12)
  )
    return `${r.title}: appointment is outside availability.`;
  return null;
}

export function validateAssignments(event: RepairEvent, assignments: Assignment[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    if (ids.has(a.requestId)) problems.push('Duplicate appointment for a request.');
    ids.add(a.requestId);
    const problem = assignmentProblem(event, a);
    if (problem) problems.push(problem);
    if (assignments.slice(0, i).some((b) => overlap(a, b)))
      problems.push(`Overlapping appointments for ${a.volunteerId}.`);
  }
  return problems;
}
