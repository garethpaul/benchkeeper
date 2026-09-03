import { validationMessage } from './validation-message';
import { useEffect, useRef, useState, useId, type FormEvent, type ReactNode } from 'react';
import {
  LockKeyhole,
  UnlockKeyhole,
  X,
  ArrowRight,
  AlertTriangle,
  Check,
  Plus,
  ClipboardPaste,
  Wrench,
  Clock3
} from 'lucide-react';
import { desk, type DeskState } from './store';
import { CapacityPanel } from './CapacityPanel';
import {
  clockFor,
  skills,
  sameAppointment,
  proposalChanges,
  repairerLabel,
  nameInitial,
  requestLabel,
  labelKey,
  type Assignment,
  type RepairEvent,
  type RepairRequest,
  type Proposal
} from './domain';

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  fallbackFocusId
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  fallbackFocusId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  );
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const release = desk.holdInteraction(title);
    dialog?.showModal();
    return () => {
      dialog?.close();
      release();
      // React can remove the dialog before native close() restores focus.
      // Capture the invoker during render, before a child autoFocus runs.
      queueMicrotask(() => {
        if (document.querySelector('dialog[open]')) return;
        const invoker = returnFocus.current;
        if (
          invoker?.isConnected &&
          (invoker.tabIndex >= 0 || invoker.hasAttribute('tabindex')) &&
          !invoker.matches(':disabled') &&
          invoker.getClientRects().length
        ) {
          invoker.focus({ preventScroll: true });
          if (document.activeElement === invoker) {
            invoker.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            return;
          }
        }
        // Applying a plan or removing a record can remove its launcher. Keep
        // keyboard users in the resulting workflow instead of the page body.
        const fallback =
          (fallbackFocusId ? document.getElementById(fallbackFocusId) : null) ??
          document.querySelector<HTMLElement>('main h1') ??
          document.querySelector<HTMLElement>('nav [aria-current="page"]');
        fallback?.focus({ preventScroll: true });
        fallback?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'wide' : ''}
      onCancel={onClose}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, summary, [tabindex]'
          )
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            element.getClientRects().length > 0
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Timeline({
  event,
  assignments,
  preview = false,
  onOpen
}: {
  event: RepairEvent;
  assignments: Assignment[];
  preview?: boolean;
  onOpen: (id: string) => void;
}) {
  const time = clockFor(event);
  return (
    <div
      className="timeline-scroll"
      tabIndex={0}
      aria-label={preview ? 'Proposed appointment timeline' : 'Current appointment timeline'}
    >
      <div className="timeline">
        <div className="time-axis">
          <span>REPAIRER</span>
          <div>
            {[0, 2, 4, 6, 8, 10, 12].map((s) => (
              <span key={s}>{time(s)}</span>
            ))}
          </div>
        </div>
        {event.volunteers.map((v, i) => (
          <div className="timeline-row" key={v.id}>
            <div className="volunteer-label">
              <span className={`avatar avatar-${i}`} aria-hidden="true">
                {nameInitial(v.name)}
              </span>
              <div>
                <strong>{repairerLabel(event, v.id)}</strong>
                <small>
                  {v.skills.join(' · ')}
                  <br />
                  {time(v.start)}–{time(v.end)}
                </small>
              </div>
            </div>
            <div className={`track ${!v.available ? 'unavailable' : ''}`}>
              {v.available && v.start > 0 && (
                <div
                  aria-hidden="true"
                  className="off-shift"
                  style={{ left: 0, width: `${(v.start / 12) * 100}%` }}
                />
              )}
              {v.available && v.end < 12 && (
                <div
                  aria-hidden="true"
                  className="off-shift"
                  style={{ left: `${(v.end / 12) * 100}%`, right: 0 }}
                />
              )}
              {!v.available && (
                <span className="absence-label">
                  {preview ? 'Not available in this scenario' : 'Not available for this session'}
                </span>
              )}
              {v.available &&
                v.blocks.map((block) => (
                  <div
                    className={`reserved-slot reserved-${block.kind}`}
                    key={block.id}
                    style={{
                      left: `${(block.start / 12) * 100}%`,
                      width: `${(block.duration / 12) * 100}%`
                    }}
                    role="note"
                    aria-label={`${block.label}, ${repairerLabel(event, v.id)}, ${time(block.start)} to ${time(block.start + block.duration)}, reserved from booking`}
                    title={`${block.label}: ${time(block.start)}–${time(block.start + block.duration)}`}
                  >
                    <strong>
                      <LockKeyhole size={10} /> {block.label}
                    </strong>
                    <span>
                      {time(block.start)} · {block.duration * 15} min
                    </span>
                  </div>
                ))}
              {assignments
                .filter((a) => a.volunteerId === v.id)
                .map((a) => {
                  const r = event.requests.find((r) => r.id === a.requestId)!;
                  const current = event.assignments.find((old) => old.requestId === a.requestId);
                  const changed = preview && (!current || !sameAppointment(current, a));
                  return (
                    <button
                      key={a.requestId}
                      className={`appointment skill-${r.skill} ${changed ? 'changed' : ''}`}
                      style={{
                        left: `${(a.start / 12) * 100}%`,
                        width: `${(a.duration / 12) * 100}%`
                      }}
                      onClick={() => onOpen(a.requestId)}
                      aria-label={`${requestLabel(event, r.id)}, ${repairerLabel(event, v.id)}, ${time(a.start)} to ${time(a.start + a.duration)}${a.locked ? ', protected' : ''}`}
                    >
                      <strong>
                        {a.locked && <LockKeyhole size={11} />} {r.title}
                      </strong>
                      <span>
                        {time(a.start)} · {a.duration * 15} min
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Queue({
  state,
  onAdd,
  onPaste
}: {
  state: DeskState;
  onAdd: () => void;
  onPaste: () => void;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const e = state.event;
  const time = clockFor(e);
  const query = labelKey(search);
  const visible = e.requests.filter((r) => {
    const assigned = e.assignments.some((a) => a.requestId === r.id);
    return (
      (filter === 'all' ||
        (filter === 'unplaced' && !assigned) ||
        (filter === 'parts' && !r.partsReady)) &&
      labelKey(`${r.title} ${r.visitor} ${r.id}`).includes(query)
    );
  });
  return (
    <section className="panel queue-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE PEOPLE BEHIND THE PLAN</p>
          <h2>
            Repair requests <span className="count">{e.requests.length}</span>
          </h2>
        </div>
        <div className="queue-actions">
          <button className="button secondary" onClick={onPaste}>
            <ClipboardPaste size={16} /> Paste intake
          </button>
          <button className="button secondary" onClick={onAdd}>
            <Plus size={16} /> Add request
          </button>
        </div>
      </div>
      <div className="queue-controls">
        <div className="segmented" aria-label="Filter requests">
          {[
            ['all', 'All requests'],
            ['unplaced', 'Without a slot'],
            ['parts', 'Waiting for parts']
          ].map(([value, label]) => (
            <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <span className="sr-only">Search requests</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find an item or visitor…"
          />
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Item / visitor</th>
              <th>Skill</th>
              <th>Estimate</th>
              <th>Visitor window</th>
              <th>Appointment</th>
              <th>
                <span className="sr-only">Open request</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const a = e.assignments.find((a) => a.requestId === r.id),
                v = e.volunteers.find((v) => v.id === a?.volunteerId);
              return (
                <tr key={r.id}>
                  <td>
                    <button
                      className="text-button item-title"
                      onClick={() => desk.focusRequest(r.id)}
                    >
                      {requestLabel(e, r.id)}
                    </button>
                    <small>{r.visitor}</small>
                  </td>
                  <td>
                    <span className={`skill-label skill-${r.skill}`}>{r.skill}</span>
                  </td>
                  <td>{r.duration * 15} min</td>
                  <td>
                    {time(r.arrival)}–{time(r.leaveBy)}
                  </td>
                  <td>
                    {a ? (
                      <span className="assignment-label">
                        {a.locked && <LockKeyhole size={12} />} {time(a.start)} ·{' '}
                        {v ? repairerLabel(e, v.id) : 'Unknown repairer'}
                      </span>
                    ) : (
                      <span className={`status-pill ${r.partsReady ? 'neutral' : 'warning'}`}>
                        {r.partsReady ? 'Needs a slot' : 'Parts missing'}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Open ${requestLabel(e, r.id)}`}
                      onClick={() => desk.focusRequest(r.id)}
                    >
                      <ArrowRight size={17} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <p className="empty-state">
          {e.requests.length
            ? 'No requests match this view.'
            : 'No requests yet. Add the first item to start your event.'}
        </p>
      )}
    </section>
  );
}

export function RequestEditor({
  initial,
  event,
  onClose,
  proposal,
  onReviewProposal
}: {
  initial?: RepairRequest;
  event: RepairEvent;
  proposal?: Proposal;
  onClose: () => void;
  onReviewProposal: () => void;
}) {
  const time = clockFor(event);
  const [draft, setDraft] = useState<RepairRequest>(
    initial ?? {
      id: `r-${crypto.randomUUID().slice(0, 8)}`,
      title: '',
      visitor: '',
      skill: 'general',
      duration: 2,
      arrival: 0,
      leaveBy: 12,
      partsReady: true,
      note: ''
    }
  );
  const [error, setError] = useState('');
  const [baseRevision, setBaseRevision] = useState(() => desk.getSnapshot().revision);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const stale = baseRevision !== desk.getSnapshot().revision;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const [manualVolunteer, setManualVolunteer] = useState(
    event.assignments.find((a) => a.requestId === initial?.id)?.volunteerId ??
      event.volunteers[0]?.id ??
      ''
  );
  const [manualStart, setManualStart] = useState(
    event.assignments.find((a) => a.requestId === initial?.id)?.start ?? initial?.arrival ?? 0
  );
  const assignment = event.assignments.find((a) => a.requestId === draft.id);
  function save(e: FormEvent) {
    e.preventDefault();
    try {
      desk.saveRequest(draft, 'human', baseRevision);
      onClose();
    } catch (error) {
      setError(validationMessage(error, 'Could not save request.'));
    }
  }
  return (
    <Modal title={initial ? 'Request details' : 'Add a repair request'} onClose={onClose}>
      {initial && (
        <p className="muted">
          Request ID: <code>{initial.id}</code>
        </p>
      )}
      <p className="muted">
        Use an anonymous visitor label. Requests are planned independently; check for overlapping
        appointments if one person brings several items. Times and durations are organizer
        estimates, not repair or safety guarantees.
      </p>
      {stale && (
        <div className="notice warning" role="alert">
          <div>
            <strong>The event changed while you were editing.</strong>
            <p>Your draft has not overwritten anything. Reload the latest details before saving.</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const latest = desk.getSnapshot(),
                  request = latest.event.requests.find((r) => r.id === draft.id);
                if (request) setDraft(request);
                setBaseRevision(latest.revision);
                setConfirmRemoval(false);
                setError('');
              }}
            >
              {initial ? 'Reload latest details (discard draft)' : 'Refresh event context'}
            </button>
          </div>
        </div>
      )}
      {initial && (!assignment || proposal?.excluded.some((ex) => ex.requestId === initial.id)) && (
        <CapacityPanel
          requestId={initial.id}
          event={event}
          proposal={proposal}
          previewBlockedReason={
            stale
              ? 'Reload the latest request details before previewing a plan.'
              : dirty
                ? 'Save your request edits before previewing a plan.'
                : undefined
          }
          onReview={onReviewProposal}
        />
      )}
      <form onSubmit={save} className="request-form">
        <label>
          Item
          <input
            autoFocus
            required
            maxLength={80}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          Visitor label
          <input
            required
            maxLength={40}
            placeholder="e.g. Visitor 13"
            value={draft.visitor}
            onChange={(e) => setDraft({ ...draft, visitor: e.target.value })}
          />
        </label>
        <div className="form-pair">
          <label>
            Skill needed
            <select
              value={draft.skill}
              onChange={(e) =>
                setDraft({ ...draft, skill: e.target.value as RepairRequest['skill'] })
              }
            >
              {skills.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Estimated duration
            <select
              value={draft.duration}
              onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n * 15} minutes
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-pair">
          <label>
            Arrives at
            <select
              value={draft.arrival}
              onChange={(e) => setDraft({ ...draft, arrival: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }, (_, n) => (
                <option key={n} value={n}>
                  {time(n)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Must leave by
            <select
              value={draft.leaveBy}
              onChange={(e) => setDraft({ ...draft, leaveBy: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }, (_, n) => (
                <option key={n + 1} value={n + 1}>
                  {time(n + 1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.partsReady}
            onChange={(e) => setDraft({ ...draft, partsReady: e.target.checked })}
          />{' '}
          Required parts are ready, or no parts are needed
        </label>
        <label>
          Planning note
          <textarea
            maxLength={240}
            rows={3}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </label>
        {assignment && (
          <div className="appointment-summary">
            <Clock3 size={18} />
            <div>
              <strong>
                {time(assignment.start)}–{time(assignment.start + assignment.duration)} with{' '}
                {repairerLabel(event, assignment.volunteerId)}
              </strong>
              <p>
                {assignment.locked
                  ? 'Protected: a new plan must keep this exact appointment.'
                  : 'Not protected: a proposal may move this appointment.'}
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    try {
                      desk.toggleLock(draft.id, baseRevision);
                      setBaseRevision(desk.getSnapshot().revision);
                    } catch (e) {
                      setError(validationMessage(e, 'Unable to change protection.'));
                    }
                  }}
                >
                  {assignment.locked ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}{' '}
                  {assignment.locked ? 'Release promise' : 'Protect appointment'}
                </button>
                {!assignment.locked && (
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() => {
                      try {
                        desk.removeAppointment(draft.id, baseRevision);
                        setBaseRevision(desk.getSnapshot().revision);
                      } catch (e) {
                        setError(validationMessage(e, 'Unable to remove appointment.'));
                      }
                    }}
                  >
                    Remove appointment
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {initial && !assignment?.locked && (
          <fieldset className="manual-appointment">
            <legend>Set an appointment yourself</legend>
            <p>Uses the saved request estimate. Other appointments stay unchanged.</p>
            <div className="form-pair">
              <label>
                Repairer
                <select
                  value={manualVolunteer}
                  disabled={!event.volunteers.some((v) => v.available)}
                  onChange={(e) => setManualVolunteer(e.target.value)}
                >
                  {!event.volunteers.some((v) => v.available) && (
                    <option value="">Add an available repairer first</option>
                  )}
                  {event.volunteers
                    .filter((v) => v.available)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {repairerLabel(event, v.id)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Start time
                <select
                  value={manualStart}
                  onChange={(e) => setManualStart(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, n) => (
                    <option key={n} value={n}>
                      {time(n)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="button secondary"
              disabled={
                stale || !manualVolunteer || !event.volunteers.some((v) => v.available) || dirty
              }
              onClick={() => {
                try {
                  desk.assignRequest(
                    {
                      requestId: initial.id,
                      volunteerId: manualVolunteer,
                      start: manualStart,
                      duration: initial.duration,
                      locked: false
                    },
                    baseRevision
                  );
                  setBaseRevision(desk.getSnapshot().revision);
                  setError('');
                } catch (e) {
                  setError(validationMessage(e, 'Unable to set appointment.'));
                }
              }}
            >
              Set appointment
            </button>
            {dirty && <small>Save your request edits before setting an appointment.</small>}
          </fieldset>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {initial && !assignment?.locked && (
          <div className="request-removal">
            {confirmRemoval ? (
              <div className="notice warning">
                <div>
                  <strong>Remove {initial.title} from this event?</strong>
                  <p>
                    Its unprotected appointment will also be removed. Undo can restore both during
                    this page session.
                  </p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setConfirmRemoval(false)}
                    >
                      Keep request
                    </button>
                    <button
                      type="button"
                      className="button danger-button"
                      disabled={stale}
                      onClick={() => {
                        try {
                          desk.removeRequest(initial.id, baseRevision);
                          onClose();
                        } catch (e) {
                          setError(validationMessage(e, 'Unable to remove request.'));
                        }
                      }}
                    >
                      Remove request
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-button danger"
                disabled={stale}
                onClick={() => setConfirmRemoval(true)}
              >
                Remove this request
              </button>
            )}
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={stale}>
            Save request
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ProposalReview({
  proposal,
  state,
  onApprove
}: {
  proposal: Proposal;
  state: DeskState;
  onApprove: () => void;
}) {
  const p = proposal,
    e = proposal.sourceEvent;
  const time = clockFor(e);
  const stale = p.baseRevision !== state.revision;
  const name = (a: Assignment | null) =>
    a
      ? `${time(a.start)}–${time(a.start + a.duration)} · ${repairerLabel(e, a.volunteerId)}`
      : 'No appointment';
  return (
    <section className="panel proposal-panel" aria-labelledby="proposal-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {stale
              ? 'OUTDATED PROPOSAL · GENERATE A FRESH PREVIEW'
              : 'PROPOSAL · CURRENT PLAN IS UNCHANGED'}
          </p>
          <h2 id="proposal-heading" tabIndex={-1}>
            Review the difference
          </h2>
        </div>
        <span className="status-pill warning">
          {p.conflicts.length ? 'No plan available' : 'Needs your decision'}
        </span>
      </div>
      {!p.conflicts.length && (
        <div className="proposal-metrics">
          <div>
            <strong>{p.metrics.scheduled}</strong>
            <span>appointments</span>
          </div>
          <div>
            <strong>{p.metrics.retained}</strong>
            <span>unchanged</span>
          </div>
          <div>
            <strong>{p.metrics.moved}</strong>
            <span>moved</span>
          </div>
          <div>
            <strong>{p.metrics.newlyScheduled}</strong>
            <span>newly placed</span>
          </div>
          <div className={p.metrics.noLongerScheduled ? 'loss-metric' : ''}>
            <strong>{p.metrics.noLongerScheduled}</strong>
            <span>lose a slot</span>
          </div>
        </div>
      )}
      <p className="scenario-description">
        <strong>Assumptions:</strong>{' '}
        {p.scenario.absentVolunteerId
          ? `${repairerLabel(e, p.scenario.absentVolunteerId)} is unavailable.`
          : 'All current availability retained.'}{' '}
        {p.scenario.extraSlots
          ? `Add ${p.scenario.extraSlots * 15} minutes to every estimate.`
          : 'No extra time buffer.'}{' '}
        {p.scenario.readyRequestId
          ? `Parts ready for ${requestLabel(e, p.scenario.readyRequestId)}.`
          : ''}
        {p.scenario.priorityRequestId
          ? ` Prioritize ${requestLabel(e, p.scenario.priorityRequestId)}; other unprotected appointments may change.`
          : ''}
      </p>
      {stale && (
        <p className="notice warning" role="alert">
          <AlertTriangle size={18} /> Event changed after this proposal. Preview again before
          applying.
        </p>
      )}
      {p.conflicts.length > 0 ? (
        <div className="notice error" role="alert">
          <AlertTriangle size={20} />
          <div>
            <strong>A protected promise cannot be kept</strong>
            <ul>
              {p.conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p>
              No new plan was created; the current appointments are unchanged. Change the scenario,
              or release the affected promise yourself. The agent cannot release it.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="changes-list">
            {proposalChanges(p).map(({ requestId, visitor, before, after }) => {
              return (
                <div className="change-row" key={requestId}>
                  <div className="change-identity">
                    <strong>{requestLabel(e, requestId)}</strong>
                    <small>{visitor}</small>
                  </div>
                  <span>
                    {name(before)} <ArrowRight size={13} /> <b>{name(after)}</b>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="exclusions">
            <h3>
              {p.excluded.length
                ? `${p.excluded.length} still without an appointment`
                : 'Every request has an appointment'}
            </h3>
            {p.excluded.map((ex) => (
              <button
                className="exclusion-row"
                key={ex.requestId}
                onClick={() => desk.focusRequest(ex.requestId)}
              >
                <span>
                  <strong>{requestLabel(e, ex.requestId)}</strong>
                  <small>{ex.reason}</small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
          <p className="fine-print">
            {p.examined.toLocaleString()} candidate placements checked in a bounded search. A
            feasible proposal, not a proof of the best possible schedule. Appointments are
            opportunities to assess items, not promised repairs.
          </p>
        </>
      )}
      <div className="review-actions">
        <button className="button secondary" onClick={() => desk.dismissProposal(p.id)}>
          Dismiss
        </button>
        <button
          className="button primary"
          disabled={stale || p.conflicts.length > 0}
          onClick={onApprove}
        >
          <Check size={16} /> Review & apply
        </button>
      </div>
    </section>
  );
}

export function EmptyProposal({ event }: { event: RepairEvent }) {
  const time = clockFor(event);
  const protectedAppointment = event.assignments.find((a) => a.locked);
  const protectedItem = event.requests.find((r) => r.id === protectedAppointment?.requestId);
  return (
    <section className="empty-proposal">
      <div className="empty-emblem">
        <Wrench size={23} />
      </div>
      <p className="eyebrow">A LITTLE ROOM TO THINK</p>
      <h2>
        Try a change.
        <br />
        Keep the promises.
      </h2>
      <p>
        {!event.requests.length
          ? 'Add your repairers and requests, then preview a first plan. You can always place an appointment yourself.'
          : 'Explore a different plan without moving anyone’s appointment. You’ll see every change before you decide.'}
      </p>
      {protectedAppointment && protectedItem && (
        <div className="promise-example">
          <LockKeyhole size={16} />
          <span>
            {protectedItem.title} at {time(protectedAppointment.start)} is protected.
          </span>
        </div>
      )}
    </section>
  );
}
