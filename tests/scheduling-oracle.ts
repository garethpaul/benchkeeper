import type { Assignment, RepairEvent, Scenario } from '../src/domain';

// Test-only exhaustive bitmask solver. Deliberately does not call the production
// scheduler, overlap helper or assignment validator. It proves cardinality on
// small fixtures; hitting the explicit node cap is an unknown result, not a pass.
function oracleProblem(event: RepairEvent, scenario: Scenario) {
  const volunteers = event.volunteers.map((v) => ({
    ...v,
    available: v.available && v.id !== scenario.absentVolunteerId
  }));
  const masks = volunteers.map((v) =>
    v.blocks.reduce((mask, b) => mask | (((1 << b.duration) - 1) << b.start), 0)
  );
  const fixed = event.assignments.filter((a) => a.locked);
  for (const a of fixed) {
    const vIndex = volunteers.findIndex((v) => v.id === a.volunteerId),
      v = volunteers[vIndex],
      r = event.requests.find((r) => r.id === a.requestId);
    if (
      !v ||
      !r ||
      !v.available ||
      !v.skills.includes(r.skill) ||
      (!r.partsReady && scenario.readyRequestId !== r.id) ||
      a.duration < r.duration + scenario.extraSlots ||
      a.start < r.arrival ||
      a.start < v.start ||
      a.start + a.duration > r.leaveBy ||
      a.start + a.duration > v.end
    )
      throw new Error('Oracle fixture has infeasible protected appointments.');
    const mask = ((1 << a.duration) - 1) << a.start;
    if (masks[vIndex] & mask)
      throw new Error('Oracle fixture has overlapping protected/reserved time.');
    masks[vIndex] |= mask;
  }
  const remaining = event.requests
    .filter((r) => !fixed.some((a) => a.requestId === r.id))
    .map((r) => {
      const choices: { volunteerIndex: number; mask: number; assignment: Assignment }[] = [];
      if (r.partsReady || r.id === scenario.readyRequestId)
        volunteers.forEach((v, index) => {
          if (!v.available || !v.skills.includes(r.skill)) return;
          const minimum = r.duration + scenario.extraSlots;
          const old = event.assignments.find((a) => a.requestId === r.id);
          const durations = old && old.duration > minimum ? [minimum, old.duration] : [minimum];
          for (const duration of durations)
            for (let start = 0; start + duration <= 12; start++) {
              if (duration !== minimum && (v.id !== old!.volunteerId || start !== old!.start))
                continue;
              if (
                start < r.arrival ||
                start < v.start ||
                start + duration > r.leaveBy ||
                start + duration > v.end
              )
                continue;
              const mask = ((1 << duration) - 1) << start;
              if (masks[index] & mask) continue;
              choices.push({
                volunteerIndex: index,
                mask,
                assignment: { requestId: r.id, volunteerId: v.id, start, duration, locked: false }
              });
            }
        });
      return choices;
    })
    .filter((options) => options.length)
    .sort((a, b) => a.length - b.length);
  return { masks, fixed, remaining };
}

export function exhaustiveMaximum(event: RepairEvent, scenario: Scenario, nodeLimit = 2_000_000) {
  const { masks, fixed, remaining } = oracleProblem(event, scenario);
  let maximum = fixed.length,
    visited = 0,
    capped = false,
    best = fixed.slice();
  const seen = new Map<string, number>();
  function visit(index: number, count: number, assignments: Assignment[]) {
    if (++visited > nodeLimit) {
      capped = true;
      return;
    }
    if (count > maximum) {
      maximum = count;
      best = assignments.slice();
    }
    if (index === remaining.length || count + remaining.length - index <= maximum || capped) return;
    const key = `${index}:${masks.join(',')}`;
    if ((seen.get(key) ?? -1) >= count) return;
    seen.set(key, count);
    for (const choice of remaining[index]) {
      if (masks[choice.volunteerIndex] & choice.mask) continue;
      const prior = masks[choice.volunteerIndex];
      masks[choice.volunteerIndex] |= choice.mask;
      visit(index + 1, count + 1, [...assignments, choice.assignment]);
      masks[choice.volunteerIndex] = prior;
    }
    visit(index + 1, count, assignments);
  }
  visit(0, fixed.length, fixed);
  return { maximum, visited, capped, assignments: best };
}

// Compare tuples directly instead of copying the production base-1000 encoding.
// The final component is negative waiting time: larger is better throughout.
export function preservationRank(
  event: RepairEvent,
  scenario: Scenario,
  assignments: Assignment[]
) {
  const rank = [0, 0, 0, assignments.length, 0];
  for (const assignment of assignments) {
    const prior = event.assignments.find((a) => a.requestId === assignment.requestId);
    const request = event.requests.find((r) => r.id === assignment.requestId)!;
    if (assignment.requestId === scenario.priorityRequestId) rank[0]++;
    if (prior) {
      rank[1]++;
      if (
        prior.volunteerId === assignment.volunteerId &&
        prior.start === assignment.start &&
        prior.duration === assignment.duration
      )
        rank[2]++;
    }
    rank[4] -= assignment.start - request.arrival;
  }
  return rank;
}

function compareRanks(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function exhaustivePreservation(
  event: RepairEvent,
  scenario: Scenario,
  nodeLimit = 2_000_000
) {
  const { masks, fixed, remaining } = oracleProblem(event, scenario);
  let visited = 0,
    capped = false,
    best = fixed.slice();
  let bestRank = preservationRank(event, scenario, fixed);
  const seen = new Map<string, number[]>();
  const additions = remaining.map((choices) =>
    choices.map((choice) => preservationRank(event, scenario, [choice.assignment]))
  );
  // Independent optimistic bound: every remaining request gets the best value
  // of each component even if those values require mutually exclusive slots.
  // This overestimates achievable rank, so it cannot prune a better solution.
  const upper: number[][] = Array.from({ length: remaining.length + 1 }, () => [0, 0, 0, 0, 0]);
  for (let i = remaining.length - 1; i >= 0; i--) {
    upper[i] = upper[i + 1].map(
      (value, component) => value + Math.max(0, ...additions[i].map((rank) => rank[component]))
    );
  }
  function visit(index: number, assignments: Assignment[], rank: number[]) {
    if (++visited > nodeLimit) {
      capped = true;
      return;
    }
    if (compareRanks(rank, bestRank) > 0) {
      bestRank = rank;
      best = assignments.slice();
    }
    if (index === remaining.length || capped) return;
    const optimistic = rank.map((value, component) => value + upper[index][component]);
    if (compareRanks(optimistic, bestRank) <= 0) return;
    const key = `${index}:${masks.join(',')}`;
    const priorRank = seen.get(key);
    if (priorRank && compareRanks(priorRank, rank) >= 0) return;
    seen.set(key, rank);
    for (const [choiceIndex, choice] of remaining[index].entries()) {
      if (masks[choice.volunteerIndex] & choice.mask) continue;
      const priorMask = masks[choice.volunteerIndex];
      masks[choice.volunteerIndex] |= choice.mask;
      visit(
        index + 1,
        [...assignments, choice.assignment],
        rank.map((value, component) => value + additions[index][choiceIndex][component])
      );
      masks[choice.volunteerIndex] = priorMask;
      if (capped) break;
    }
    if (!capped) visit(index + 1, assignments, rank);
  }
  visit(0, fixed, bestRank);
  return { rank: bestRank, visited, capped, assignments: best };
}
