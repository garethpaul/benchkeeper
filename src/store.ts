import { demoEvent } from './demo';
import { planEvent } from './scheduler';
import { explainCapacity } from './capacity';
import { z } from 'zod';
import {
  eventSchema,
  requestSchema,
  volunteerSchema,
  assignmentSchema,
  scenarioSchema,
  objectives,
  scenarioEvent,
  validateAssignments,
  sameAppointment,
  type RepairEvent,
  type RepairRequest,
  type Proposal
} from './domain';

export type Actor = 'human' | 'native-tool' | 'rehearsal';
export type AuditEntry = { id: number; actor: Actor; message: string };
export type DeskState = {
  event: RepairEvent;
  revision: number;
  proposals: Proposal[];
  selectedProposalId: string | null;
  focusedRequestId: string | null;
  history: AuditEntry[];
  storageIssue: string | null;
  storageRecoveryAvailable: boolean;
  storageConflict: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  interaction: string | null;
  reviewFocusSequence: number;
};
type EventChange = { before: RepairEvent; after: RepairEvent; label: string };
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const storageKey = 'repair-desk-v1';
const storageUnavailableMessage =
  'Browser storage is unavailable. Changes work in memory only; download a backup before leaving.';
const storageConflictMessage =
  'The saved event was changed by another page in this tab. This cached view cannot save or plan over it. Download a cached copy if needed, then reload the latest saved event. Reloading discards unsaved form drafts.';
const persistedSchema = z.strictObject({
  storageVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  event: eventSchema
});

export class DeskStore {
  private state: DeskState;
  private listeners = new Set<() => void>();
  private sequence = 0;
  // Proposals are transient. An agent may retain an old ID across a reload;
  // a new page must not reuse it for a different scenario.
  private readonly proposalScope = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  private undoStack: EventChange[] = [];
  private redoStack: EventChange[] = [];
  private interactionSequence = 0;
  private interactions = new Map<number, string>();
  private unreadableSavedData: string | null = null;
  private persistedRaw: string | null = null;
  constructor(
    private storage?: StoragePort,
    private storageUnavailable = false
  ) {
    let event = demoEvent();
    let revision = 0;
    let storageIssue: string | null = storageUnavailable ? storageUnavailableMessage : null;
    let raw: string | null | undefined;
    try {
      raw = storage?.getItem(storageKey);
    } catch {
      this.storageUnavailable = true;
      storageIssue = storageUnavailableMessage;
    }
    this.persistedRaw = raw ?? null;
    if (raw !== null && raw !== undefined) {
      try {
        if (raw.length > 100000) throw new Error('Saved event exceeds the size limit.');
        const data: unknown = JSON.parse(raw);
        if (data && typeof data === 'object' && 'storageVersion' in data) {
          const saved = persistedSchema.parse(data);
          event = this.parseEvent(saved.event);
          revision = saved.revision;
        } else {
          // Backward compatibility with event-only storage and backups.
          event = this.parseEvent(data);
        }
      } catch {
        this.unreadableSavedData = raw;
        storageIssue =
          'The saved event could not be read and has not been overwritten. The example is displayed for now. Download the unreadable copy if needed, then explicitly replace it to enable editing.';
      }
    }
    this.state = {
      event,
      revision,
      proposals: [],
      selectedProposalId: null,
      focusedRequestId: null,
      history: [],
      storageIssue,
      storageRecoveryAvailable: this.unreadableSavedData !== null,
      storageConflict: false,
      undoLabel: null,
      redoLabel: null,
      interaction: null,
      reviewFocusSequence: 0
    };
  }
  getSnapshot = () => this.state;
  checkStorage = () => {
    if (!this.storage || this.storageUnavailable || this.state.storageConflict) return;
    let raw: string | null;
    try {
      raw = this.storage.getItem(storageKey);
    } catch {
      // Without a trustworthy read, never overwrite an unknown saved value.
      // Keep this document memory-only until the organizer reloads it.
      this.storageUnavailable = true;
      this.publish({
        ...this.state,
        storageIssue:
          this.unreadableSavedData === null
            ? storageUnavailableMessage
            : 'The saved event cannot be read safely. Download the retained unreadable copy and reload before replacing it.'
      });
      return;
    }
    if (raw !== this.persistedRaw)
      this.publish({
        ...this.state,
        storageConflict: true,
        storageIssue: storageConflictMessage,
        proposals: [],
        selectedProposalId: null
      });
  };
  assertStorageCurrent() {
    this.checkStorage();
    if (this.state.storageConflict) throw new Error(storageConflictMessage);
  }
  holdInteraction(description: string) {
    const id = ++this.interactionSequence;
    this.interactions.set(id, description);
    this.publish({ ...this.state, interaction: description });
    return () => {
      this.interactions.delete(id);
      this.publish({ ...this.state, interaction: [...this.interactions.values()].at(-1) ?? null });
    };
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(next: DeskState) {
    this.state = next;
    this.listeners.forEach((l) => l());
  }
  private audit(actor: Actor, message: string): AuditEntry[] {
    return [...this.state.history, { id: ++this.sequence, actor, message }].slice(-50);
  }
  private assertRevision(expectedRevision: number = this.state.revision) {
    this.assertStorageCurrent();
    if (expectedRevision !== this.state.revision)
      throw new Error(
        'The event changed since this action was prepared. Reload the latest details before saving; your draft has not been applied.'
      );
  }
  private change(event: RepairEvent, actor: Actor, message: string, recordUndo = true) {
    this.assertReadableStorage();
    const revision = this.state.revision + 1;
    if (!Number.isSafeInteger(revision))
      throw new Error(
        'The event revision limit was reached. Download a backup and open a fresh tab.'
      );
    let storageIssue: string | null = this.storageUnavailable ? storageUnavailableMessage : null;
    try {
      if (this.storage && !this.storageUnavailable) {
        const raw = JSON.stringify({ storageVersion: 1, revision, event });
        this.storage.setItem(storageKey, raw);
        this.persistedRaw = raw;
      }
    } catch {
      storageIssue = storageUnavailableMessage;
    }
    if (recordUndo) {
      this.undoStack = [
        ...this.undoStack,
        { before: this.state.event, after: event, label: message }
      ].slice(-20);
      this.redoStack = [];
    }
    this.publish({
      ...this.state,
      event,
      revision,
      history: this.audit(actor, message),
      storageIssue,
      storageRecoveryAvailable: false,
      undoLabel: this.undoStack.at(-1)?.label ?? null,
      redoLabel: this.redoStack.at(-1)?.label ?? null
    });
  }
  private parseEvent(data: unknown) {
    const event = eventSchema.parse(data);
    const issues = validateAssignments(event, event.assignments);
    if (issues.length) throw new Error(issues.join(' '));
    return event;
  }
  private assertReadableStorage() {
    this.assertStorageCurrent();
    if (this.unreadableSavedData !== null)
      throw new Error(
        'The saved event needs recovery. You can download its unreadable copy. Explicitly choose to replace the unreadable save before making changes.'
      );
  }
  exportUnreadableSave() {
    if (this.unreadableSavedData === null)
      throw new Error('No unreadable saved copy is available.');
    return this.unreadableSavedData;
  }
  replaceUnreadableSave(expectedRevision: number) {
    this.assertRevision(expectedRevision);
    if (this.unreadableSavedData === null)
      throw new Error('No unreadable saved copy is available.');
    if (this.storageUnavailable)
      throw new Error(
        'Storage cannot be read safely. Download the unreadable copy and reload before replacing it.'
      );
    try {
      this.storage?.removeItem(storageKey);
      this.persistedRaw = null;
    } catch {
      throw new Error(
        'Browser storage refused the replacement. Download the unreadable copy and use a fresh tab.'
      );
    }
    this.unreadableSavedData = null;
    this.change(
      this.state.event,
      'human',
      'Explicitly replaced an unreadable saved value with the visible example.',
      false
    );
  }
  preview(input: unknown, actor: Actor = 'human'): Proposal {
    this.assertReadableStorage();
    const scenario = scenarioSchema.parse(input);
    const proposal = planEvent(
      this.state.event,
      scenario,
      this.state.revision,
      `plan-${this.proposalScope}-${++this.sequence}`
    );
    this.publish({
      ...this.state,
      proposals: [proposal, ...this.state.proposals].slice(0, 4),
      selectedProposalId: proposal.id,
      history: this.audit(
        actor,
        proposal.conflicts.length
          ? 'No plan available — protected appointment conflict. Current plan unchanged.'
          : `Proposed ${proposal.metrics.scheduled} appointments. Current plan unchanged.`
      )
    });
    return proposal;
  }
  compare(input: unknown, actor: Actor = 'human'): Proposal[] {
    this.assertReadableStorage();
    const scenario = scenarioSchema.parse(input);
    // Build the entire set before publishing, so the UI never sees a partial
    // comparison and all three proposals refer to exactly the same revision.
    const proposals = objectives.map((objective) =>
      planEvent(
        this.state.event,
        { ...scenario, objective },
        this.state.revision,
        `plan-${this.proposalScope}-${++this.sequence}`
      )
    );
    this.publish({
      ...this.state,
      proposals: [...proposals, ...this.state.proposals].slice(0, 4),
      selectedProposalId: proposals.find((p) => p.scenario.objective === scenario.objective)!.id,
      history: this.audit(
        actor,
        'Compared three preferences with the same assumptions. Current plan unchanged.'
      )
    });
    return proposals;
  }
  inspectCapacity(requestId: string, proposalId?: string) {
    const proposal = proposalId ? this.state.proposals.find((p) => p.id === proposalId) : undefined;
    if (proposalId && !proposal) throw new Error('Proposal expired. Generate another preview.');
    if (proposal && proposal.baseRevision !== this.state.revision)
      throw new Error('This proposal is stale. Preview again before inspecting its capacity.');
    if (proposal?.conflicts.length)
      throw new Error(
        'This proposal has protected-appointment conflicts. Resolve those before inspecting individual capacity.'
      );
    const event = proposal ? scenarioEvent(this.state.event, proposal.scenario) : this.state.event;
    return {
      revision: this.state.revision,
      source: proposal?.id ?? 'current-plan',
      ...explainCapacity(
        event,
        proposal?.assignments ?? event.assignments,
        requestId,
        proposal?.scenario.extraSlots ?? 0
      )
    };
  }
  focusRequest(id: string, actor: Actor = 'human') {
    if (actor !== 'human' && (this.state.interaction || this.state.focusedRequestId))
      throw new Error(
        'An organizer dialog is already open. Read-only tools remain available; close the dialog before requesting another focus.'
      );
    if (!this.state.event.requests.some((r) => r.id === id)) throw new Error('Unknown request.');
    this.publish({
      ...this.state,
      focusedRequestId: id,
      history: this.audit(actor, `Opened request ${id}.`)
    });
  }
  closeRequest() {
    this.publish({ ...this.state, focusedRequestId: null });
  }
  selectProposal(id: string, actor: Actor = 'human') {
    this.assertStorageCurrent();
    if (actor !== 'human' && this.state.interaction)
      throw new Error(
        'An organizer dialog is already open. The proposal is saved; close the dialog before opening another review.'
      );
    const proposal = this.state.proposals.find((p) => p.id === id);
    if (!proposal) throw new Error('Proposal expired. Generate another preview.');
    if (actor !== 'human' && proposal.baseRevision !== this.state.revision)
      throw new Error(
        'This proposal is stale. Generate a fresh preview before requesting human review.'
      );
    if (actor !== 'human' && proposal.conflicts.length)
      throw new Error(
        'No plan is available: resolve the protected-appointment conflict before requesting review.'
      );
    this.publish({
      ...this.state,
      selectedProposalId: id,
      reviewFocusSequence: this.state.reviewFocusSequence + (actor === 'human' ? 0 : 1),
      history: this.audit(actor, 'Opened a proposal for human review; no appointments applied.')
    });
  }
  dismissProposal(id: string) {
    this.publish({
      ...this.state,
      proposals: this.state.proposals.filter((p) => p.id !== id),
      selectedProposalId: null,
      history: this.audit('human', 'Dismissed proposal. Current plan unchanged.')
    });
  }
  // Deliberately not registered as a WebMCP tool. A page click requests this
  // action; it is not a security boundary against arbitrary page automation.
  approveProposal(id: string) {
    const p = this.state.proposals.find((p) => p.id === id);
    if (!p) throw new Error('Proposal expired. Generate another preview.');
    if (p.baseRevision !== this.state.revision)
      throw new Error('This proposal is stale. The event changed; generate a fresh preview.');
    if (p.conflicts.length)
      throw new Error('Resolve protected appointment conflicts before applying.');
    const event = scenarioEvent(this.state.event, p.scenario);
    const issues = validateAssignments(event, p.assignments);
    if (issues.length) throw new Error(issues.join(' '));
    for (const locked of this.state.event.assignments.filter((a) => a.locked)) {
      if (!p.assignments.some((a) => a.locked && sameAppointment(a, locked)))
        throw new Error('A protected appointment cannot be changed.');
    }
    this.change(
      { ...event, assignments: p.assignments },
      'human',
      `Applied ${p.metrics.scheduled} appointments after review. No visitors contacted.`
    );
    this.publish({ ...this.state, selectedProposalId: null });
  }
  toggleLock(requestId: string, expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    const assignment = this.state.event.assignments.find((a) => a.requestId === requestId);
    if (!assignment) throw new Error('Only an existing appointment can be protected.');
    this.change(
      {
        ...this.state.event,
        assignments: this.state.event.assignments.map((a) =>
          a.requestId === requestId ? { ...a, locked: !a.locked } : a
        )
      },
      'human',
      `${assignment.locked ? 'Released' : 'Protected'} appointment ${requestId}.`
    );
  }
  saveRequest(input: unknown, actor: Actor = 'human', expectedRevision?: number): RepairRequest {
    this.assertRevision(expectedRevision);
    const r = requestSchema.parse(input);
    const exists = this.state.event.requests.some((old) => old.id === r.id);
    if (!exists && this.state.event.requests.length >= 24)
      throw new Error('This small-event planner supports at most 24 requests.');
    const event = {
      ...this.state.event,
      requests: exists
        ? this.state.event.requests.map((old) => (old.id === r.id ? r : old))
        : [...this.state.event.requests, r]
    };
    const issues = validateAssignments(event, event.assignments);
    if (issues.length)
      throw new Error(
        'This edit would invalidate an existing appointment. Remove its appointment first. ' +
          issues[0]
      );
    this.change(
      event,
      actor,
      `${exists ? 'Updated' : 'Added'} request ${r.id}. Existing proposals need a fresh preview.`
    );
    return r;
  }
  appendRequests(input: unknown, expectedRevision: number) {
    this.assertRevision(expectedRevision);
    const requests = z.array(requestSchema).min(1).max(24).parse(input);
    const event = this.parseEvent({
      ...this.state.event,
      requests: [...this.state.event.requests, ...requests]
    });
    this.change(
      event,
      'human',
      `Added ${requests.length} requests from a reviewed intake sheet. No appointments changed.`
    );
  }
  removeAppointment(requestId: string, expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    const a = this.state.event.assignments.find((a) => a.requestId === requestId);
    if (!a) throw new Error('No appointment to remove.');
    if (a.locked) throw new Error('Release the protected promise first.');
    this.change(
      {
        ...this.state.event,
        assignments: this.state.event.assignments.filter((a) => a.requestId !== requestId)
      },
      'human',
      `Removed appointment ${requestId}; request remains in the queue.`
    );
  }
  assignRequest(input: unknown, expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    const a = assignmentSchema.parse(input);
    const current = this.state.event.assignments.find((old) => old.requestId === a.requestId);
    if (current?.locked)
      throw new Error('Release the protected promise before editing its appointment.');
    const assignments = [
      ...this.state.event.assignments.filter((old) => old.requestId !== a.requestId),
      { ...a, locked: false }
    ];
    const issues = validateAssignments(this.state.event, assignments);
    if (issues.length) throw new Error(issues.join(' '));
    this.change(
      { ...this.state.event, assignments },
      'human',
      `Set appointment ${a.requestId}. Other appointments unchanged.`
    );
  }
  saveVolunteer(input: unknown, expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    const v = volunteerSchema.parse(input);
    const exists = this.state.event.volunteers.some((old) => old.id === v.id);
    if (!exists && this.state.event.volunteers.length >= 8)
      throw new Error('This small-event planner supports at most eight volunteers.');
    const event = {
      ...this.state.event,
      volunteers: exists
        ? this.state.event.volunteers.map((old) => (old.id === v.id ? v : old))
        : [...this.state.event.volunteers, v]
    };
    const issues = validateAssignments(event, event.assignments);
    if (issues.length)
      throw new Error(
        'This change would invalidate an appointment. Use a cancellation scenario or move affected appointments first. ' +
          issues[0]
      );
    this.change(event, 'human', `${exists ? 'Updated' : 'Added'} repairer ${v.name}.`);
  }
  renameEvent(name: string, expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    const event = eventSchema.parse({ ...this.state.event, name });
    this.change(event, 'human', 'Updated the event name.');
  }
  configureEvent(name: string, startMinutes: number, expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    if (
      startMinutes !== this.state.event.startMinutes &&
      (this.state.event.assignments.length ||
        this.state.event.requests.length ||
        this.state.event.volunteers.length)
    )
      throw new Error(
        'Choose the start before adding requests or repairers. Start a blank event to use another time; existing availability and promises keep their clock times.'
      );
    const event = eventSchema.parse({ ...this.state.event, name, startMinutes });
    this.change(event, 'human', 'Updated the event name and session clock.');
  }
  private clearContext() {
    this.publish({
      ...this.state,
      proposals: [],
      selectedProposalId: null,
      focusedRequestId: null
    });
  }
  startBlank(name: string, expectedRevision?: number, startMinutes = 600) {
    this.assertRevision(expectedRevision);
    const event = eventSchema.parse({
      schemaVersion: 1,
      name,
      startMinutes,
      requests: [],
      volunteers: [],
      assignments: []
    });
    this.change(
      event,
      'human',
      'Started a blank event. The previous event can be restored with Undo.'
    );
    this.clearContext();
  }
  removeRequest(requestId: string, expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    const request = this.state.event.requests.find((r) => r.id === requestId);
    if (!request) throw new Error('Unknown request.');
    if (this.state.event.assignments.some((a) => a.requestId === requestId && a.locked))
      throw new Error('Release the protected appointment before removing this request.');
    this.change(
      {
        ...this.state.event,
        requests: this.state.event.requests.filter((r) => r.id !== requestId),
        assignments: this.state.event.assignments.filter((a) => a.requestId !== requestId)
      },
      'human',
      `Removed request ${requestId} and its unprotected appointment. Undo can restore them.`
    );
    this.publish({ ...this.state, focusedRequestId: null });
  }
  removeVolunteer(volunteerId: string, expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    if (!this.state.event.volunteers.some((v) => v.id === volunteerId))
      throw new Error('Unknown repairer.');
    if (this.state.event.assignments.some((a) => a.volunteerId === volunteerId))
      throw new Error('Move or remove this repairer’s appointments before removing the repairer.');
    this.change(
      {
        ...this.state.event,
        volunteers: this.state.event.volunteers.filter((v) => v.id !== volunteerId)
      },
      'human',
      'Removed an unassigned repairer. Undo can restore the repairer.'
    );
  }
  undo(expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    const last = this.undoStack.at(-1);
    if (!last) throw new Error('Nothing to undo in this page session.');
    this.undoStack = this.undoStack.slice(0, -1);
    this.redoStack.push(last);
    this.change(last.before, 'human', `Undid: ${last.label}`, false);
    this.publish({ ...this.state, focusedRequestId: null, selectedProposalId: null });
  }
  redo(expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    const next = this.redoStack.at(-1);
    if (!next) throw new Error('Nothing to redo in this page session.');
    this.redoStack = this.redoStack.slice(0, -1);
    this.undoStack.push(next);
    this.change(next.after, 'human', `Redid: ${next.label}`, false);
    this.publish({ ...this.state, focusedRequestId: null, selectedProposalId: null });
  }
  reset(expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    this.change(demoEvent(), 'human', 'Reset to the deterministic example event.');
    this.publish({
      ...this.state,
      proposals: [],
      selectedProposalId: null,
      focusedRequestId: null
    });
  }
  importEvent(text: string, expectedRevision?: number) {
    this.assertRevision(expectedRevision);
    if (text.length > 100000) throw new Error('Import is limited to 100 KB.');
    const event = this.parseEvent(JSON.parse(text));
    this.change(event, 'human', 'Imported a validated event backup.');
    this.publish({
      ...this.state,
      proposals: [],
      selectedProposalId: null,
      focusedRequestId: null
    });
  }
  exportEvent() {
    return JSON.stringify(this.state.event, null, 2);
  }
}

let storage: StoragePort | undefined;
try {
  if (typeof window !== 'undefined') storage = window.sessionStorage;
} catch {
  /* handled in the UI */
}
export const desk = new DeskStore(storage, typeof window !== 'undefined' && !storage);
