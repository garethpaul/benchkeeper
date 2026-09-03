// Fresh synthetic instances for developer-guided trials, not an independent benchmark.
// Does not use or read the private inspiration material.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const setName = process.env.TRIAL_SET ?? '';
if (setName && !/^[a-z][a-z0-9-]{0,31}$/.test(setName))
  throw new Error('Trial set names must be short lowercase names with letters, digits or hyphens.');
const directory = join('work/evidence/generated-trials', setName);
const path = join(directory, 'fixture.json');
if (existsSync(path))
  throw new Error('Preserve the existing trial fixture before generating another.');
let state = randomBytes(4).readUInt32LE(0) || 1;
const seed = state;
function random() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
}
function shuffle(values) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const used = new Set();
function id(prefix) {
  let value;
  do {
    value = `${prefix}-${Math.floor(random() * 4294967296).toString(36)}`;
  } while (used.has(value));
  used.add(value);
  return value;
}
function eventFor(kind) {
  const names = shuffle(['Rowan', 'Harper', 'Ellis', 'Marin', 'Devon', 'Toby', 'Ari', 'Remy']);
  const people = [
    { skills: ['electrical'], start: 0, end: 12 },
    { skills: ['electrical', 'general'], start: 0, end: 8 },
    {
      skills: ['general', 'textiles'],
      start: 2,
      end: 12,
      blocks: [{ id: 'walk-in', label: 'Walk-in reserve', kind: 'walk-in', start: 9, duration: 3 }]
    },
    {
      skills: ['textiles'],
      start: 0,
      end: 10,
      blocks: [{ id: 'break', label: 'Repairer break', kind: 'break', start: 4, duration: 1 }]
    },
    { skills: ['bicycle'], start: 0, end: 12 },
    { skills: ['general'], start: 0, end: 12 }
  ].map((person, i) => ({
    id: id('person'),
    name: names[i],
    available: true,
    blocks: [],
    ...person
  }));
  if (kind === 'c') people[1].name = people[0].name;
  const items = [
    ['Blue kettle', 'electrical', 2, 0, 4, true],
    ['Kitchen radio', 'electrical', 2, 0, 6, true],
    ['Audio amplifier', 'electrical', 2 + Math.floor(random() * 2), 2, 8, true],
    ['Coffee scale', 'electrical', 2, 0, 8, false],
    ['Town bicycle', 'bicycle', 3, 0, 12, true],
    ['Jacket zipper', 'textiles', 2, 0, 10, true],
    ['Wooden toy', 'general', 1, 0, 12, true],
    ['Canvas bag', 'textiles', 2, 2, 9, true],
    ['Table fan', 'electrical', 2 + Math.floor(random() * 2), 4, 12, true],
    ['Kitchen stool', 'general', 2, 0, 12, true],
    ['Wall clock', 'electrical', 1, 0, 8, true],
    ['Jeans pocket', 'textiles', 2, 5, 10, true]
  ].map(([title, skill, duration, arrival, leaveBy, partsReady], i) => ({
    id: id('item'),
    title,
    skill,
    duration,
    arrival,
    leaveBy,
    partsReady,
    visitor: `Guest ${i + 1}`,
    note: i === 0 ? 'A promised assessment slot; not a guaranteed repair.' : ''
  }));
  const assignments = [
    [0, 1, 0],
    [1, 0, 0],
    [2, 0, 2],
    [4, 4, 0],
    [5, 3, 0],
    [6, 5, 0],
    [7, 2, 2],
    [9, 5, 2],
    [11, 3, 5]
  ].map(([item, person, start]) => ({
    requestId: items[item].id,
    volunteerId: people[person].id,
    start,
    duration: items[item].duration,
    locked: item === 0
  }));
  const event = {
    schemaVersion: 1,
    name: `Fresh-instance workshop ${kind.toUpperCase()} — synthetic`,
    startMinutes: [495, 645, 870, 1050][Math.floor(random() * 4)],
    volunteers: shuffle(people),
    requests: shuffle(items),
    assignments: shuffle(assignments)
  };
  const tasks = {
    a: `${people[0].name} cannot come today. Compare keeping existing appointments with fitting the most appointments. Tell me which visitors lose a slot in each choice, and leave a proposal for review.`,
    b: 'The Coffee scale part has arrived. Record that fact, then show a plan that includes it if possible. Keep promised appointments and leave the plan for review.',
    c: `${people[0].name} cannot come today. Can you show me the revised plan?`,
    d: `${people[1].name} cannot come today. Keep all promised appointments exactly as they are and show the revised plan.`
  };
  return {
    event,
    task: tasks[kind],
    facts: {
      absentId: kind === 'd' ? people[1].id : people[0].id,
      partRequestId: items[3].id,
      protectedRequestId: items[0].id
    }
  };
}
const events = {},
  tasks = {},
  facts = {};
for (const kind of ['a', 'b', 'c', 'd']) {
  const generated = eventFor(kind),
    name = `fresh-${kind}`;
  events[name] = generated.event;
  tasks[name] = generated.task;
  facts[name] = generated.facts;
}
mkdirSync(directory, { recursive: true, mode: 0o700 });
writeFileSync(
  path,
  JSON.stringify(
    {
      seed,
      events,
      tasks,
      facts,
      limitation:
        'Generator and task families are known to the developer agent. Fresh realized values do not make this an independent benchmark.'
    },
    null,
    2
  ) + '\n',
  { mode: 0o600, flag: 'wx' }
);
console.log(
  JSON.stringify({
    fixture: path,
    trials: Object.keys(tasks),
    synthetic: true,
    seedAndEventDetailsNotPrinted: true
  })
);
