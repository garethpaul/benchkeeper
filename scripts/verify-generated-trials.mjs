// Deterministic trace checks, not an assessment of independent model capability.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync('work/evidence/generated-trials/fixture.json', 'utf8'));
const readTrace = (name) =>
  readFileSync(`work/evidence/native-trial-${name}.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);

function checkPlan(event, scenario, assignments) {
  const assigned = new Set(),
    occupied = new Map();
  for (const a of assignments) {
    assert(!assigned.has(a.requestId));
    assigned.add(a.requestId);
    const request = event.requests.find((r) => r.id === a.requestId);
    const person = event.volunteers.find((v) => v.id === a.volunteerId);
    assert(request && person);
    assert(person.available && person.id !== scenario.absentVolunteerId);
    assert(person.skills.includes(request.skill));
    assert(request.partsReady || request.id === scenario.readyRequestId);
    assert(Number.isInteger(a.start) && Number.isInteger(a.duration) && a.duration > 0);
    assert(a.duration >= request.duration);
    assert(a.start >= Math.max(request.arrival, person.start));
    assert(a.start + a.duration <= Math.min(request.leaveBy, person.end, 12));
    const slots = occupied.get(person.id) ?? new Set();
    for (let slot = a.start; slot < a.start + a.duration; slot++) {
      assert(!slots.has(slot));
      assert(
        !person.blocks.some((block) => slot >= block.start && slot < block.start + block.duration)
      );
      slots.add(slot);
    }
    occupied.set(person.id, slots);
  }
  for (const old of event.assignments.filter((a) => a.locked))
    assert.deepEqual(
      assignments.find((a) => a.requestId === old.requestId),
      old
    );
}
function readPages(calls, name, field) {
  const result = [];
  let next = 0;
  for (const call of calls.filter((call) => call.name === name)) {
    assert.equal(call.args.offset ?? 0, next);
    result.push(...call.output.result[field]);
    next = call.output.result.nextOffset;
    if (next === null) return result;
  }
  assert.fail('Required page sequence did not finish.');
}
function proposalReports(calls) {
  const proposals = new Map();
  for (const call of calls.filter((call) => call.name === 'inspect_plan_changes')) {
    const page = call.output.result;
    const current = proposals.get(page.id) ?? {
      next: 0,
      assignments: [],
      changes: [],
      scenario: page.scenario,
      total: page.totalAppointments,
      totalChanges: page.totalChanges
    };
    assert.equal(call.args.offset ?? 0, current.next);
    assert.equal(page.stale, false);
    assert.equal(page.baseRevision, page.currentRevision);
    assert.deepEqual(page.scenario, current.scenario);
    current.assignments.push(...page.appointments);
    current.changes.push(...page.changes);
    current.next = page.nextOffset;
    proposals.set(page.id, current);
  }
  for (const report of proposals.values()) {
    assert.equal(report.next, null);
    assert.equal(report.assignments.length, report.total);
    assert.equal(report.changes.length, report.totalChanges);
  }
  return proposals;
}

const report = { independentBenchmark: false, nativeCalls: 0, trials: {} };
for (const name of Object.keys(fixture.tasks)) {
  const entries = readTrace(name),
    initial = fixture.events[name];
  for (const type of ['start', 'finish', 'final-state', 'recording'])
    assert.equal(entries.filter((entry) => entry.type === type).length, 1, `${name}: ${type}`);
  assert(!entries.some((entry) => entry.type === 'bridge-error'));
  const calls = entries.filter((entry) => entry.type === 'call');
  assert(calls.every((call) => call.output.ok));
  assert(calls.every((call) => !/approve|apply|unlock|release|reset|send|export/.test(call.name)));
  assert.deepEqual(entries.find((entry) => entry.type === 'finish').blockedNetwork, []);
  const roster = readPages(calls, 'get_repair_event', 'volunteers');
  assert.deepEqual(roster.map((v) => v.id).sort(), initial.volunteers.map((v) => v.id).sort());
  const expected = structuredClone(initial);
  if (name === 'fresh-b') {
    expected.requests.find((r) => r.id === fixture.facts[name].partRequestId).partsReady = true;
    const writes = calls.filter((call) => call.name === 'save_repair_request');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].args.expectedRevision, 1);
    assert.deepEqual(
      writes[0].args.request,
      expected.requests.find((r) => r.id === fixture.facts[name].partRequestId)
    );
    assert.equal(
      readPages(calls, 'list_repair_requests', 'requests').length,
      initial.requests.length
    );
  } else assert(!calls.some((call) => call.name === 'save_repair_request'));
  const final = entries.find((entry) => entry.type === 'final-state');
  assert.deepEqual(final.event, expected);
  assert.equal(final.revision, name === 'fresh-b' ? 2 : 1);
  const proposals = proposalReports(calls);
  for (const proposal of proposals.values())
    checkPlan(expected, proposal.scenario, proposal.assignments);
  if (name === 'fresh-a') {
    const compared = calls.find((call) => call.name === 'compare_repair_objectives');
    assert.equal(compared.args.absentVolunteerId, fixture.facts[name].absentId);
    assert.equal(proposals.size, 3);
    const selected = calls.find((call) => call.name === 'request_plan_review').args.proposalId;
    assert.equal(
      compared.output.result.find((p) => p.id === selected).metrics.noLongerScheduled,
      0
    );
    const choices = [...proposals.values()].map((p) => ({
      objective: p.scenario.objective,
      appointments: p.assignments.length,
      lostVisitors: initial.assignments
        .filter((old) => !p.assignments.some((a) => a.requestId === old.requestId))
        .map((old) => initial.requests.find((r) => r.id === old.requestId).visitor)
    }));
    report.comparisonFinding = choices;
    // A concrete feasible witness: restore an unnecessarily moved same-repairer
    // appointment when doing so causes no conflict. This is not a global search.
    const witness = structuredClone(proposals.get(selected).assignments);
    for (const old of initial.assignments) {
      const index = witness.findIndex((a) => a.requestId === old.requestId);
      if (index < 0 || witness[index].volunteerId !== old.volunteerId) continue;
      const candidate = structuredClone(witness);
      candidate[index] = old;
      try {
        checkPlan(initial, proposals.get(selected).scenario, candidate);
        witness[index] = old;
      } catch {
        /* Keep the verified original placement if this local restoration conflicts. */
      }
    }
    checkPlan(initial, proposals.get(selected).scenario, witness);
    const same = (a, b) =>
      a && b && a.volunteerId === b.volunteerId && a.start === b.start && a.duration === b.duration;
    const witnessSummary = {
      event: initial,
      scenario: proposals.get(selected).scenario,
      witness,
      retainedExact: initial.assignments.filter((old) =>
        same(
          old,
          witness.find((a) => a.requestId === old.requestId)
        )
      ).length,
      retainedVisitors: initial.assignments.filter((old) =>
        witness.some((a) => a.requestId === old.requestId)
      ).length
    };
    writeFileSync(
      'work/evidence/generated-trials/preservation-witness.json',
      JSON.stringify(witnessSummary, null, 2) + '\n'
    );
    report.preservationWitness = {
      retainedExact: witnessSummary.retainedExact,
      retainedVisitors: witnessSummary.retainedVisitors,
      appointments: witness.length
    };
  }
  if (name === 'fresh-b') {
    const planned = [...proposals.values()][0];
    assert(planned.assignments.some((a) => a.requestId === fixture.facts[name].partRequestId));
    assert.equal(planned.assignments.length, 12);
    assert.equal(calls.filter((call) => call.name === 'request_plan_review').length, 1);
  }
  if (name === 'fresh-c') assert(calls.every((call) => call.name === 'get_repair_event'));
  if (name === 'fresh-d') {
    const preview = calls.find((call) => call.name === 'preview_repair_plan');
    assert.equal(preview.args.absentVolunteerId, fixture.facts[name].absentId);
    assert(preview.output.result.conflicts.length > 0);
    assert(!calls.some((call) => call.name === 'request_plan_review'));
  }
  report.nativeCalls += calls.length;
  report.trials[name] = {
    calls: calls.length,
    finalStateMatchesAuthorizedChange: true,
    reportPagesComplete: proposals.size ? true : null,
    reportPageCheck: proposals.size ? 'complete' : 'not applicable — no plan report requested',
    proposedSlotsChecked: [...proposals.values()].reduce((n, p) => n + p.assignments.length, 0)
  };
}
writeFileSync(
  'work/evidence/generated-trials/verification.json',
  JSON.stringify(report, null, 2) + '\n'
);
console.log(JSON.stringify(report));
