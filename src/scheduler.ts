import {
  type Assignment,
  type RepairEvent,
  type Scenario,
  type Proposal,
  type Exclusion,
  scenarioEvent,
  sameAppointment,
  overlap,
  assignmentProblem,
  validateAssignments
} from './domain';

// Deterministic bounded beam search. This is a good feasible proposal, not a
// claim of global optimality or a prediction that any repair will succeed.
export function planEvent(
  original: RepairEvent,
  scenario: Scenario,
  baseRevision: number,
  proposalId: string
): Proposal {
  const event = scenarioEvent(original, scenario);
  const locked = original.assignments.filter((a) => a.locked);
  const conflicts = validateAssignments(event, locked);
  for (const a of locked) {
    const request = event.requests.find((r) => r.id === a.requestId)!;
    if (a.duration < request.duration + scenario.extraSlots)
      conflicts.push(
        `${request.title}: protected appointment cannot absorb the extra time. Change the assumption or explicitly release the promise.`
      );
  }
  const options = new Map<string, Assignment[]>();
  const oldById = new Map(original.assignments.map((a) => [a.requestId, a]));
  const excluded: Exclusion[] = [];
  for (const r of event.requests.filter((r) => !locked.some((a) => a.requestId === r.id))) {
    const duration = r.duration + scenario.extraSlots;
    const qualified = event.volunteers.filter((v) => v.available && v.skills.includes(r.skill));
    const choices: Assignment[] = [];
    if (r.partsReady)
      for (const v of qualified) {
        for (
          let start = Math.max(r.arrival, v.start);
          start + duration <= Math.min(r.leaveBy, v.end, 12);
          start++
        ) {
          const a = { requestId: r.id, volunteerId: v.id, start, duration, locked: false };
          if (
            !locked.some((b) => overlap(a, b)) &&
            !v.blocks.some((b) => start < b.start + b.duration && b.start < start + duration)
          )
            choices.push(a);
        }
      }
    // An approved appointment may include more time than today's estimate.
    // Keep its exact slot available to the ranking policy, without forcing
    // retention or generating arbitrary oversized alternatives.
    const old = oldById.get(r.id);
    if (
      old &&
      old.duration > duration &&
      !assignmentProblem(event, old) &&
      !locked.some((a) => overlap(a, old))
    )
      choices.push({ ...old });
    options.set(r.id, choices);
    if (!choices.length) {
      if (!r.partsReady)
        excluded.push({
          requestId: r.id,
          code: 'parts',
          reason: 'Required parts are not ready. No appointment was promised.'
        });
      else if (!qualified.length)
        excluded.push({
          requestId: r.id,
          code: 'skill',
          reason: `No available volunteer has the recorded ${r.skill} skill.`
        });
      else
        excluded.push({
          requestId: r.id,
          code: 'window',
          reason:
            'No slot fits the visitor window, volunteer hours, reserved time, estimated duration and protected appointments.'
        });
    }
  }
  const requestById = new Map(event.requests.map((r) => [r.id, r]));
  const value = (assignments: Assignment[]) => {
    if (scenario.objective !== 'earlier-visitors') {
      let priority = 0,
        booked = 0,
        exact = 0,
        waiting = 0;
      for (const a of assignments) {
        const request = requestById.get(a.requestId)!,
          old = oldById.get(a.requestId);
        priority += Number(a.requestId === scenario.priorityRequestId);
        booked += Number(!!old);
        exact += Number(!!old && sameAppointment(a, old));
        waiting += a.start - request.arrival;
      }
      // Keep-booked mode values existing visitors before count; max-count mode
      // puts count first, then ranks retained bookings above lower waiting time
      // when counts tie. Explicit individual priority precedes both policies.
      // Every component is below1000 (24 requests ×12 slots), so lower-ranked
      // preferences cannot outweigh one unit above them. Still a bounded search.
      const rank =
        scenario.objective === 'keep-promises'
          ? [priority, booked, exact, assignments.length, 24 * 12 - waiting]
          : [priority, assignments.length, booked, exact, 24 * 12 - waiting];
      return rank.reduce((score, component) => score * 1000 + component, 0);
    }
    return assignments.reduce((sum, a) => {
      const r = requestById.get(a.requestId)!;
      const old = oldById.get(a.requestId);
      const retained = old && sameAppointment(a, old);
      const priorityBonus = a.requestId === scenario.priorityRequestId ? 1000000 : 0;
      return (
        sum +
        priorityBonus +
        10000 +
        (12 - r.arrival) * 200 -
        (a.start - r.arrival) * 10 +
        (retained ? 10 : 0)
      );
    }, 0);
  };
  const queue = event.requests
    .filter((r) => options.get(r.id)?.length)
    .sort(
      (a, b) =>
        Number(b.id === scenario.priorityRequestId) - Number(a.id === scenario.priorityRequestId) ||
        (scenario.objective === 'keep-promises'
          ? Number(oldById.has(b.id)) - Number(oldById.has(a.id))
          : 0) ||
        options.get(a.id)!.length - options.get(b.id)!.length ||
        a.arrival - b.arrival ||
        a.id.localeCompare(b.id)
    );
  // Spend the same nominal state-step budget on shorter decision queues with
  // greater breadth. A fixed 96-state beam discarded the padded-slot witness
  // before its final constrained request (see the preserved counterexample).
  // The cap limits peak memory; this remains bounded, not globally optimal.
  const beamWidth = Math.max(96, Math.min(384, Math.floor((24 * 96) / Math.max(1, queue.length))));
  let beam: { assignments: Assignment[]; score: number }[] = [
    { assignments: locked, score: value(locked) }
  ];
  let examined = 0;
  const volunteerIndex = new Map(event.volunteers.map((v, index) => [v.id, index]));
  const occupancyKey = (assignments: Assignment[]) => {
    const masks = event.volunteers.map(() => 0);
    for (const a of assignments)
      masks[volunteerIndex.get(a.volunteerId)!] |= ((1 << a.duration) - 1) << a.start;
    return masks.join(',');
  };
  if (!conflicts.length)
    for (const r of queue) {
      const next: typeof beam = [];
      for (const state of beam) {
        next.push(state);
        for (const a of options.get(r.id)!) {
          examined++;
          if (state.assignments.some((b) => overlap(a, b))) continue;
          const assignments = [...state.assignments, a];
          next.push({ assignments, score: value(assignments) });
        }
      }
      // At this queue position, future requests are identical across states.
      // Equal occupied slots therefore have equal future feasibility: retain
      // only the highest-value history for each occupancy pattern. Without this
      // dominance pass, equivalent histories crowd useful alternatives out of
      // the bounded beam (see preserved oracle counterexamples).
      const distinct = new Map<string, (typeof next)[number]>();
      for (const state of next) {
        const key = occupancyKey(state.assignments),
          prior = distinct.get(key);
        if (
          !prior ||
          state.score > prior.score ||
          (state.score === prior.score && state.assignments.length > prior.assignments.length)
        )
          distinct.set(key, state);
      }
      beam = [...distinct.values()]
        .sort((a, b) => b.score - a.score || b.assignments.length - a.assignments.length)
        .slice(0, beamWidth);
    }
  const assignments = conflicts.length
    ? []
    : beam[0].assignments
        .slice()
        .sort((a, b) => a.start - b.start || a.volunteerId.localeCompare(b.volunteerId));
  if (!conflicts.length)
    for (const r of event.requests) {
      if (
        !assignments.some((a) => a.requestId === r.id) &&
        !excluded.some((e) => e.requestId === r.id)
      )
        excluded.push({
          requestId: r.id,
          code: 'capacity',
          reason:
            'Not placed in this bounded search: compatible time is competing with other requests. Try another objective or availability.'
        });
    }
  const retained = assignments.filter((a) =>
    original.assignments.some((b) => sameAppointment(a, b))
  ).length;
  return {
    id: proposalId,
    baseRevision,
    sourceEvent: structuredClone(original),
    scenario: { ...scenario },
    assignments,
    excluded,
    conflicts,
    examined,
    score: beam[0].score,
    metrics: {
      scheduled: assignments.length,
      retained,
      moved: assignments.filter((a) =>
        original.assignments.some((b) => b.requestId === a.requestId && !sameAppointment(a, b))
      ).length,
      newlyScheduled: assignments.filter(
        (a) => !original.assignments.some((b) => b.requestId === a.requestId)
      ).length,
      noLongerScheduled: original.assignments.filter(
        (a) => !assignments.some((b) => b.requestId === a.requestId)
      ).length,
      protected: locked.length,
      volunteerMinutes: assignments.reduce((sum, a) => sum + a.duration * 15, 0)
    }
  };
}
