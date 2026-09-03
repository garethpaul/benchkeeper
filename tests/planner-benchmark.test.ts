import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { evidencePath } from './evidence-path';
import {
  eventSchema,
  emptyScenario,
  validateAssignments,
  scenarioEvent,
  type RepairEvent,
  type Assignment
} from '../src/domain';
import { planEvent } from '../src/scheduler';
import { exhaustiveMaximum, exhaustivePreservation, preservationRank } from './scheduling-oracle';

function generatedEvent(seed: number, requestCount = 7, volunteerCount = 3): RepairEvent {
  let state = seed || 1;
  const integer = (max: number) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % max;
  };
  const skillNames = ['general', 'electrical'] as const;
  const volunteers = Array.from({ length: volunteerCount }, (_, i) => {
    const end = 9 + integer(4);
    return {
      id: `v-${i}`,
      name: `Repairer ${i + 1}`,
      skills: integer(3) === 0 ? [...skillNames] : [skillNames[integer(2)]],
      start: integer(3),
      end,
      available: integer(10) > 0,
      blocks:
        integer(5) === 0
          ? [
              {
                id: `block-${i}`,
                label: 'Generated break',
                kind: 'break',
                start: end - 2,
                duration: 2
              }
            ]
          : []
    };
  });
  const requests = Array.from({ length: requestCount }, (_, i) => {
    const duration = 1 + integer(4),
      arrival = integer(9),
      leaveBy = arrival + duration + integer(13 - arrival - duration);
    return {
      id: `r-${i}`,
      title: `Item ${i + 1}`,
      visitor: `Visitor ${i + 1}`,
      skill: skillNames[integer(2)],
      duration,
      arrival,
      leaveBy,
      partsReady: integer(10) > 0,
      note: ''
    };
  });
  const event = eventSchema.parse({
    schemaVersion: 1,
    name: `Generated case ${seed}`,
    volunteers,
    requests,
    assignments: []
  });
  if (seed % 7 === 0) {
    for (const request of event.requests) {
      if (!request.partsReady) continue;
      const volunteer = event.volunteers.find(
        (v) =>
          v.available &&
          v.skills.includes(request.skill) &&
          Math.max(v.start, request.arrival) + request.duration <= Math.min(v.end, request.leaveBy)
      );
      if (!volunteer) continue;
      const start = Math.max(volunteer.start, request.arrival);
      if (
        volunteer.blocks.some(
          (b) => start < b.start + b.duration && b.start < start + request.duration
        )
      )
        continue;
      event.assignments.push({
        requestId: request.id,
        volunteerId: volunteer.id,
        start,
        duration: request.duration,
        locked: true
      });
      break;
    }
  }
  return event;
}

it('compares bounded planning with an independent exhaustive small-case oracle', () => {
  const scenario = { ...emptyScenario(), objective: 'most-appointments' as const };
  const differences: unknown[] = [],
    unknownSeeds: number[] = [];
  let maxVisited = 0,
    totalVisited = 0;
  const started = performance.now();
  for (let seed = 1; seed <= 2000; seed++) {
    const event = generatedEvent(seed, 6 + (seed % 3), 2 + (seed % 2));
    const exact = exhaustiveMaximum(event, scenario),
      proposal = planEvent(event, scenario, 0, 'benchmark');
    maxVisited = Math.max(maxVisited, exact.visited);
    totalVisited += exact.visited;
    if (exact.capped) {
      unknownSeeds.push(seed);
      continue;
    }
    expect(validateAssignments(event, proposal.assignments)).toEqual([]);
    if (proposal.assignments.length !== exact.maximum)
      differences.push({
        seed,
        actual: proposal.assignments.length,
        maximum: exact.maximum,
        event,
        oracleAssignments: exact.assignments,
        proposalAssignments: proposal.assignments
      });
  }
  writeFileSync(
    evidencePath('scheduling-oracle.json'),
    JSON.stringify(
      {
        cases: 2000,
        elapsedMs: performance.now() - started,
        totalVisited,
        maxVisited,
        unknownSeeds,
        differences
      },
      null,
      2
    )
  );
  expect(unknownSeeds, 'Oracle node cap means optimality was not established').toEqual([]);
  expect(differences, `See ${evidencePath('scheduling-oracle.json')} for counterexamples`).toEqual(
    []
  );
}, 30000);

it('keeps max-size scenarios feasible within an interactive planning budget', () => {
  const timings: number[] = [];
  let largestPlacements = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const event = generatedEvent(seed + 5000, 24, 8),
      scenario = { ...emptyScenario(), absentVolunteerId: seed % 3 === 0 ? 'v-0' : null };
    // This lane benchmarks feasible planning, not the separate protected-
    // cancellation conflict behavior. Avoid cancelling a promised repairer.
    if (event.assignments.some((a) => a.locked && a.volunteerId === scenario.absentVolunteerId))
      scenario.absentVolunteerId = null;
    const started = performance.now(),
      proposal = planEvent(event, scenario, 0, 'large');
    timings.push(performance.now() - started);
    largestPlacements = Math.max(largestPlacements, proposal.examined);
    expect(validateAssignments(scenarioEvent(event, scenario), proposal.assignments)).toEqual([]);
    expect(proposal.assignments.length + proposal.excluded.length).toBe(24);
  }
  timings.sort((a, b) => a - b);
  const report = {
    cases: timings.length,
    medianMs: timings[Math.floor(timings.length / 2)],
    p95Ms: timings[Math.floor(timings.length * 0.95)],
    maxMs: timings.at(-1),
    largestPlacements,
    scope: 'Host CPU timing, not a claim about all user devices.'
  };
  writeFileSync(evidencePath('planner-performance.json'), JSON.stringify(report, null, 2));
  expect(report.maxMs).toBeLessThan(1000);
}, 30000);

it('compares booked-visitor recovery with an independent lexicographic oracle', () => {
  const differences: unknown[] = [],
    unknownSeeds: number[] = [];
  const waitingGaps: { seed: number; extraWaitingMinutes: number }[] = [];
  let totalVisited = 0,
    maxVisited = 0,
    totalBookings = 0,
    paddedBookings = 0,
    cancellations = 0;
  const started = performance.now();
  for (let seed = 9001; seed <= 13000; seed++) {
    const event = generatedEvent(seed, 7, 3);
    // Construct prior bookings by independent feasible placement, not by the
    // planner being tested. Rotate the request order to vary existing promises.
    const ordered = [...event.requests.slice(seed % 7), ...event.requests.slice(0, seed % 7)];
    for (const request of ordered) {
      if (!request.partsReady || event.assignments.some((a) => a.requestId === request.id))
        continue;
      // Preserve the original 2,000 cases exactly. The additional corpus has
      // organizer-approved padding, so exact retention must compete with the
      // shorter feasible alternatives used by a later scenario.
      const duration = request.duration + (seed > 11000 ? (seed + request.arrival) % 3 : 0);
      const choices: Assignment[] = [];
      for (const volunteer of event.volunteers) {
        if (!volunteer.available || !volunteer.skills.includes(request.skill)) continue;
        for (let start = request.arrival; start + duration <= request.leaveBy; start++) {
          const end = start + duration;
          if (start < volunteer.start || end > volunteer.end) continue;
          if (volunteer.blocks.some((b) => start < b.start + b.duration && b.start < end)) continue;
          if (
            event.assignments.some(
              (a) => a.volunteerId === volunteer.id && start < a.start + a.duration && a.start < end
            )
          )
            continue;
          choices.push({
            requestId: request.id,
            volunteerId: volunteer.id,
            start,
            duration,
            locked: false
          });
        }
      }
      if (choices.length)
        event.assignments.push(choices[(seed + request.arrival) % choices.length]);
    }
    expect(validateAssignments(event, event.assignments)).toEqual([]);
    const cancellable = event.volunteers.filter(
      (v) =>
        event.assignments.some((a) => a.volunteerId === v.id) &&
        !event.assignments.some((a) => a.volunteerId === v.id && a.locked)
    );
    const scenario = {
      ...emptyScenario(),
      absentVolunteerId:
        seed % 2 === 0 && cancellable.length ? cancellable[seed % cancellable.length].id : null,
      priorityRequestId: seed % 3 === 0 ? event.requests[seed % 7].id : null,
      extraSlots: seed % 5 === 0 && !event.assignments.some((a) => a.locked) ? 1 : 0
    };
    totalBookings += event.assignments.length;
    paddedBookings += event.assignments.filter(
      (a) => a.duration > event.requests.find((r) => r.id === a.requestId)!.duration
    ).length;
    cancellations += Number(!!scenario.absentVolunteerId);
    const exact = exhaustivePreservation(event, scenario);
    const proposal = planEvent(event, scenario, 0, 'preservation-audit');
    totalVisited += exact.visited;
    maxVisited = Math.max(maxVisited, exact.visited);
    expect(validateAssignments(scenarioEvent(event, scenario), exact.assignments)).toEqual([]);
    expect(validateAssignments(scenarioEvent(event, scenario), proposal.assignments)).toEqual([]);
    if (exact.capped) {
      unknownSeeds.push(seed);
      continue;
    }
    const actualRank = preservationRank(event, scenario, proposal.assignments);
    if (actualRank.slice(0, 4).some((value, index) => value !== exact.rank[index]))
      differences.push({
        seed,
        actualRank,
        exactRank: exact.rank,
        event,
        scenario,
        proposalAssignments: proposal.assignments,
        oracleAssignments: exact.assignments
      });
    else if (actualRank[4] !== exact.rank[4])
      waitingGaps.push({ seed, extraWaitingMinutes: (exact.rank[4] - actualRank[4]) * 15 });
  }
  const report = {
    cases: 4000,
    originalMinimumDurationCases: 2000,
    additionalPaddedDurationCases: 2000,
    totalBookings,
    paddedBookings,
    cancellations,
    elapsedMs: performance.now() - started,
    totalVisited,
    maxVisited,
    unknownSeeds,
    differences,
    waitingGaps
  };
  writeFileSync(evidencePath('preservation-oracle.json'), JSON.stringify(report, null, 2));
  expect(unknownSeeds, 'A capped oracle is an unknown result, not a pass').toEqual([]);
  expect(differences, `See ${evidencePath('preservation-oracle.json')}`).toEqual([]);
  // The earlier fixed-width beam missed15 minutes at seed9475. Broader search
  // on short queues now matches every ranking component in this fixed corpus;
  // retaining the stronger assertion is still not a universal optimality proof.
  expect(waitingGaps).toEqual([]);
}, 30000);
