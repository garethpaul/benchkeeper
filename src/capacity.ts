import { overlap, type Assignment, type RepairEvent } from './domain';

export type CapacityReport = {
  requestId: string;
  status:
    | 'scheduled'
    | 'parts_missing'
    | 'no_repairer'
    | 'outside_window'
    | 'protected_capacity'
    | 'reserved_capacity'
    | 'occupied_capacity'
    | 'open_slot';
  requiredMinutes: number;
  candidateStarts: number;
  startsBlockedByPromises: number;
  startsBlockedByReservations: number;
  qualifiedRepairerIds: string[];
  bestOpening: {
    volunteerId: string;
    start: number;
    duration: number;
    displacedRequestIds: string[];
  } | null;
  explanation: string;
};

// Enumerates every discrete start that meets the *recorded* skill and timing
// constraints. This is an exact local slot witness, not an optimal full replan.
export function explainCapacity(
  event: RepairEvent,
  assignments: Assignment[],
  requestId: string,
  extraSlots = 0
): CapacityReport {
  const request = event.requests.find((r) => r.id === requestId);
  if (!request) throw new Error('Unknown request.');
  const duration = request.duration + extraSlots;
  const qualified = event.volunteers.filter((v) => v.available && v.skills.includes(request.skill));
  const base = {
    requestId,
    requiredMinutes: duration * 15,
    candidateStarts: 0,
    startsBlockedByPromises: 0,
    startsBlockedByReservations: 0,
    qualifiedRepairerIds: qualified.map((v) => v.id),
    bestOpening: null
  };
  const existing = assignments.find((a) => a.requestId === requestId);
  if (existing)
    return {
      ...base,
      status: 'scheduled',
      explanation: 'This request already has an appointment in this plan.',
      bestOpening: {
        volunteerId: existing.volunteerId,
        start: existing.start,
        duration: existing.duration,
        displacedRequestIds: []
      }
    };
  if (!request.partsReady)
    return {
      ...base,
      status: 'parts_missing',
      explanation:
        'Required parts are recorded as missing. More time or a different repairer does not resolve that recorded constraint.'
    };
  if (!qualified.length)
    return {
      ...base,
      status: 'no_repairer',
      explanation: `No available repairer has the recorded ${request.skill} skill. A new time alone does not resolve that constraint.`
    };
  let candidateStarts = 0,
    startsBlockedByPromises = 0,
    startsBlockedByReservations = 0;
  const openings: NonNullable<CapacityReport['bestOpening']>[] = [];
  for (const volunteer of qualified) {
    for (
      let start = Math.max(request.arrival, volunteer.start);
      start + duration <= Math.min(request.leaveBy, volunteer.end, 12);
      start++
    ) {
      candidateStarts++;
      const crossesReserve = volunteer.blocks.some(
        (b) => start < b.start + b.duration && b.start < start + duration
      );
      const candidate = { requestId, volunteerId: volunteer.id, start, duration, locked: false };
      const conflicts = assignments.filter(
        (a) => a.requestId !== requestId && overlap(candidate, a)
      );
      const crossesPromise = conflicts.some((a) => a.locked);
      // These are overlapping counts of starts, not mutually exclusive buckets.
      // A start spanning adjacent reserved and protected slots crosses both.
      if (crossesReserve) startsBlockedByReservations++;
      if (crossesPromise) startsBlockedByPromises++;
      if (crossesReserve || crossesPromise) continue;
      openings.push({
        volunteerId: volunteer.id,
        start,
        duration,
        displacedRequestIds: conflicts.map((a) => a.requestId).sort()
      });
    }
  }
  openings.sort(
    (a, b) =>
      a.displacedRequestIds.length - b.displacedRequestIds.length ||
      a.start - b.start ||
      a.volunteerId.localeCompare(b.volunteerId)
  );
  const bestOpening = openings[0] ?? null;
  if (!candidateStarts)
    return {
      ...base,
      status: 'outside_window',
      explanation: 'No recorded repairer/visitor overlap is long enough for this estimate.'
    };
  if (!bestOpening)
    return {
      ...base,
      candidateStarts,
      startsBlockedByPromises,
      startsBlockedByReservations,
      status: startsBlockedByReservations ? 'reserved_capacity' : 'protected_capacity',
      explanation:
        'Every otherwise eligible start overlaps protected appointments or reserved time. No unprotected-only change can create a slot.'
    };
  const count = bestOpening.displacedRequestIds.length;
  return {
    ...base,
    candidateStarts,
    startsBlockedByPromises,
    startsBlockedByReservations,
    bestOpening,
    status: count ? 'occupied_capacity' : 'open_slot',
    explanation: count
      ? `Every promise-preserving start is occupied. The smallest local change overlaps ${count} unprotected appointment${count === 1 ? '' : 's'}. Those visitors are not yet replanned.`
      : 'An eligible free slot exists in this plan. A preview or manual placement can use it; this is not a promise that a repair will succeed.'
  };
}
