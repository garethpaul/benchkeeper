import { eventSchema, type RepairEvent } from './domain';

export function demoEvent(): RepairEvent {
  const requests = [
    [
      'r-lamp',
      'Desk lamp',
      'Visitor 01',
      'electrical',
      2,
      0,
      6,
      true,
      'Visitor needs to leave by 11:30.'
    ],
    [
      'r-jacket',
      'Winter jacket',
      'Visitor 02',
      'textiles',
      2,
      0,
      8,
      true,
      'Loose lining; bring the matching thread.'
    ],
    ['r-bike', 'City bicycle', 'Visitor 03', 'bicycle', 3, 0, 10, true, 'Assessment requested.'],
    ['r-radio', 'Kitchen radio', 'Visitor 04', 'electrical', 2, 0, 10, true, 'Intermittent sound.'],
    [
      'r-chair',
      'Dining chair',
      'Visitor 05',
      'general',
      3,
      1,
      12,
      true,
      'Loose joint; organizer estimate only.'
    ],
    [
      'r-toaster',
      'Toaster',
      'Visitor 06',
      'electrical',
      2,
      2,
      12,
      false,
      'Waiting for the visitor to bring a part.'
    ],
    ['r-bag', 'Canvas bag', 'Visitor 07', 'textiles', 1, 2, 8, true, 'A small seam repair.'],
    [
      'r-kettle',
      'Kettle',
      'Visitor 08',
      'electrical',
      2,
      3,
      10,
      true,
      'Assessment only; no safety guarantee.'
    ],
    ['r-jeans', 'Favourite jeans', 'Visitor 09', 'textiles', 2, 4, 12, true, 'Patch at the knee.'],
    [
      'r-fan',
      'Table fan',
      'Visitor 10',
      'electrical',
      3,
      4,
      12,
      true,
      'Allow time for an assessment.'
    ],
    ['r-toy', 'Wooden toy', 'Visitor 11', 'general', 1, 4, 12, true, 'Loose wheel.'],
    [
      'r-clock',
      'Wall clock',
      'Visitor 12',
      'electrical',
      1,
      6,
      12,
      true,
      'Battery contacts need assessment.'
    ]
  ].map(([id, title, visitor, skill, duration, arrival, leaveBy, partsReady, note]) => ({
    id,
    title,
    visitor,
    skill,
    duration,
    arrival,
    leaveBy,
    partsReady,
    note
  }));
  return eventSchema.parse({
    schemaVersion: 1,
    name: 'Saturday at the community hall',
    requests,
    volunteers: [
      { id: 'v-ada', name: 'Ada', skills: ['electrical'], start: 0, end: 8, available: true },
      {
        id: 'v-sam',
        name: 'Sam',
        skills: ['electrical', 'general'],
        start: 0,
        end: 12,
        available: true
      },
      { id: 'v-jo', name: 'Jo', skills: ['textiles'], start: 0, end: 12, available: true },
      {
        id: 'v-min',
        name: 'Min',
        skills: ['bicycle', 'general'],
        start: 0,
        end: 12,
        available: true,
        blocks: [
          { id: 'block-walk-in', label: 'Walk-in reserve', kind: 'walk-in', start: 9, duration: 3 }
        ]
      }
    ],
    assignments: [
      { requestId: 'r-lamp', volunteerId: 'v-ada', start: 0, duration: 2, locked: true },
      { requestId: 'r-radio', volunteerId: 'v-sam', start: 0, duration: 2, locked: false },
      { requestId: 'r-jacket', volunteerId: 'v-jo', start: 0, duration: 2, locked: false },
      { requestId: 'r-bike', volunteerId: 'v-min', start: 0, duration: 3, locked: false },
      { requestId: 'r-kettle', volunteerId: 'v-ada', start: 3, duration: 2, locked: false },
      { requestId: 'r-chair', volunteerId: 'v-min', start: 3, duration: 3, locked: false },
      { requestId: 'r-bag', volunteerId: 'v-jo', start: 2, duration: 1, locked: false },
      { requestId: 'r-jeans', volunteerId: 'v-jo', start: 4, duration: 2, locked: false },
      { requestId: 'r-fan', volunteerId: 'v-sam', start: 4, duration: 3, locked: false }
    ]
  });
}
