import type { RepairEvent } from '../../src/domain';
import { demoEvent } from '../../src/demo';

/** Valid boundary-length labels without whitespace; not a real event dataset. */
export function unbrokenLabelsEvent(): RepairEvent {
  const event = demoEvent();
  event.name = 'Community'.repeat(9).slice(0, 80);
  for (const [index, volunteer] of event.volunteers.entries()) {
    volunteer.name = (`Repairer${index}` + 'Workshop'.repeat(10)).slice(0, 80);
    for (const block of volunteer.blocks) block.label = 'Reserved'.repeat(10);
  }
  for (const [index, request] of event.requests.entries()) {
    request.title = (`Item${index}` + 'Appliance'.repeat(10)).slice(0, 80);
    request.visitor = (`Visitor${index}` + 'Label'.repeat(10)).slice(0, 40);
    request.note = 'PlanningNote'.repeat(20);
  }
  return event;
}

/** Synthetic supported-limit fixture shared by contract, browser and PDF checks. */
export function maximumEvent(): RepairEvent {
  return {
    schemaVersion: 1,
    name: 'Maximum-size synthetic repair event',
    startMinutes: 600,
    assignments: [],
    volunteers: Array.from({ length: 8 }, (_, i) => ({
      id: `volunteer-${i}`,
      name: `Repairer ${i} with a long descriptive label `.repeat(3).slice(0, 80),
      skills: ['general'],
      start: 0,
      end: 12,
      available: true,
      blocks: [1, 4, 7, 10].map((start, j) => ({
        id: `reserve-${j}`,
        label: 'Reserved walk-in or break time with an intentionally long label '
          .repeat(2)
          .slice(0, 80),
        kind: 'walk-in',
        start,
        duration: 1
      }))
    })),
    requests: Array.from({ length: 24 }, (_, i) => ({
      id: `request-${i}`,
      title: `Item ${i} with a long descriptive label `.repeat(3).slice(0, 80),
      visitor: 'Anonymous visitor with a long local label'.slice(0, 40),
      skill: 'general',
      duration: 1,
      arrival: 0,
      leaveBy: 12,
      partsReady: true,
      note: `${'A detailed synthetic planning note. '.repeat(8).slice(0, 224)} Endnote ${i}.`
    }))
  };
}
