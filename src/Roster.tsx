import { validationMessage } from './validation-message';
import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Clock3, UsersRound } from 'lucide-react';
import { desk } from './store';
import {
  skills,
  clockFor,
  parseStartTime,
  repairerLabel,
  nameInitial,
  type RepairEvent,
  type Volunteer
} from './domain';
import { Modal } from './components';

export function Roster({ event, onSaved }: { event: RepairEvent; onSaved: () => void }) {
  const time = clockFor(event);
  const [editing, setEditing] = useState<Volunteer | null>(null);
  const [name, setName] = useState(event.name);
  const [startTime, setStartTime] = useState(time(0));
  const [error, setError] = useState('');
  const [nameRevision, setNameRevision] = useState(() => desk.getSnapshot().revision);
  return (
    <section className="roster-page">
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">THE SKILLS THAT MAKE IT POSSIBLE</p>
          <h1 tabIndex={-1}>Meet the repairers.</h1>
          <p>Record who is available and what they can help assess.</p>
        </div>
        <button
          className="button primary"
          disabled={event.volunteers.length >= 8}
          onClick={() =>
            setEditing({
              id: `v-${crypto.randomUUID().slice(0, 8)}`,
              name: '',
              skills: ['general'],
              start: 0,
              end: 12,
              available: true,
              blocks: []
            })
          }
        >
          <Plus size={16} /> Add repairer
        </button>
      </div>
      <form
        className="panel event-settings"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            desk.configureEvent(name, parseStartTime(startTime), nameRevision);
            setNameRevision(desk.getSnapshot().revision);
            setError('');
            onSaved();
          } catch (e) {
            setError(validationMessage(e, 'Could not update event.'));
          }
        }}
      >
        <label>
          Event name
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => {
              if (name === event.name && startTime === time(0))
                setNameRevision(desk.getSnapshot().revision);
              setName(e.target.value);
            }}
          />
        </label>
        <label>
          Session start
          <input
            type="time"
            required
            step={900}
            min="00:00"
            max="21:00"
            disabled={event.requests.length > 0 || event.volunteers.length > 0}
            value={startTime}
            onChange={(e) => {
              if (name === event.name && startTime === time(0))
                setNameRevision(desk.getSnapshot().revision);
              setStartTime(e.target.value);
            }}
          />
        </label>
        <button className="button secondary" type="submit">
          Save event settings
        </button>
        <p>
          Three hours, {time(0)}–{time(12)}, in local clock time and 15-minute slots. Set the start
          before adding requests or repairers; recorded windows and promises cannot be silently
          shifted. Each repairer has one workbench, with no shared-equipment model.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}{' '}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setName(event.name);
                setStartTime(time(0));
                setNameRevision(desk.getSnapshot().revision);
                setError('');
              }}
            >
              Reload current settings
            </button>
          </p>
        )}
      </form>
      <div className="roster-grid">
        {event.volunteers.map((v, i) => (
          <article className="panel repairer-card" key={v.id}>
            <div className="repairer-heading">
              <span className={`avatar avatar-${i % 4}`} aria-hidden="true">
                {nameInitial(v.name)}
              </span>
              <div>
                <h2>{repairerLabel(event, v.id)}</h2>
                <span className={`status-pill ${v.available ? 'success' : 'warning'}`}>
                  {v.available ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <button
                className="icon-button"
                aria-label={`Edit repairer ${repairerLabel(event, v.id)}`}
                onClick={() => setEditing(v)}
              >
                <Pencil size={18} />
              </button>
            </div>
            <div className="repairer-skills">
              {v.skills.map((s) => (
                <span className={`skill-label skill-${s}`} key={s}>
                  {s}
                </span>
              ))}
            </div>
            <p>
              <Clock3 size={15} /> {time(v.start)}–{time(v.end)}
            </p>
            <p>
              <UsersRound size={15} />{' '}
              {event.assignments.filter((a) => a.volunteerId === v.id).length} current appointments
            </p>
            {v.blocks.map((b) => (
              <p className="roster-reserve" key={b.id}>
                <Clock3 size={15} />
                {time(b.start)}–{time(b.start + b.duration)} · {b.label}
              </p>
            ))}
          </article>
        ))}
      </div>
      {!event.volunteers.length && (
        <p className="empty-state">
          No repairers yet. Add someone and record their skills to start your first plan.
        </p>
      )}
      <p className="muted roster-boundary">
        A recorded skill is an organizer’s planning input, not a qualification or safety
        certification. If an assigned repairer cancels, preview that change at the planning desk so
        the affected appointments stay visible.
      </p>
      {editing && <VolunteerEditor initial={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function VolunteerEditor({ initial, onClose }: { initial: Volunteer; onClose: () => void }) {
  const time = clockFor(desk.getSnapshot().event);
  const [draft, setDraft] = useState(initial),
    [error, setError] = useState('');
  const [baseRevision, setBaseRevision] = useState(() => desk.getSnapshot().revision);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const stale = baseRevision !== desk.getSnapshot().revision;
  function save(e: FormEvent) {
    e.preventDefault();
    try {
      desk.saveVolunteer(draft, baseRevision);
      onClose();
    } catch (e) {
      setError(validationMessage(e, 'Unable to save repairer.'));
    }
  }
  return (
    <Modal title={initial.name ? 'Edit repairer' : 'Add a repairer'} onClose={onClose}>
      <form className="request-form" onSubmit={save}>
        {stale && (
          <div className="notice warning" role="alert">
            <div>
              <strong>The event changed while you were editing.</strong>
              <p>Your repairer draft has not been applied.</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  const latest = desk.getSnapshot(),
                    v = latest.event.volunteers.find((v) => v.id === draft.id);
                  if (v) setDraft(v);
                  setBaseRevision(latest.revision);
                  setError('');
                  setConfirmRemoval(false);
                }}
              >
                Reload latest repairer details
              </button>
            </div>
          </div>
        )}
        <label>
          Name or label
          <input
            autoFocus
            required
            maxLength={80}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <fieldset>
          <legend>Recorded skills</legend>
          <div className="skill-checkboxes">
            {skills.map((skill) => (
              <label key={skill} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={draft.skills.includes(skill)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      skills: e.target.checked
                        ? [...draft.skills, skill]
                        : draft.skills.filter((s) => s !== skill)
                    })
                  }
                />
                {skill}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-pair">
          <label>
            Available from
            <select
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }, (_, n) => (
                <option key={n} value={n}>
                  {time(n)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Available until
            <select
              value={draft.end}
              onChange={(e) => setDraft({ ...draft, end: Number(e.target.value) })}
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
            checked={draft.available}
            onChange={(e) => setDraft({ ...draft, available: e.target.checked })}
          />{' '}
          Available for this event
        </label>
        <fieldset className="reserve-editor">
          <legend>Reserved time</legend>
          <p>
            Protect breaks or walk-in capacity. The planner cannot fill these blocks with booked
            requests.
          </p>
          {draft.blocks.map((block, index) => (
            <div className="reserve-edit-row" key={block.id}>
              <label>
                Reserve label
                <input
                  aria-label={`Reserve label ${index + 1}`}
                  required
                  maxLength={80}
                  value={block.label}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      blocks: draft.blocks.map((b) =>
                        b.id === block.id ? { ...b, label: e.target.value } : b
                      )
                    })
                  }
                />
              </label>
              <div className="form-pair">
                <label>
                  Reason
                  <select
                    aria-label={`Reserve reason ${index + 1}`}
                    value={block.kind}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        blocks: draft.blocks.map((b) =>
                          b.id === block.id
                            ? { ...b, kind: e.target.value as 'break' | 'walk-in' }
                            : b
                        )
                      })
                    }
                  >
                    <option value="walk-in">Walk-in capacity</option>
                    <option value="break">Repairer break</option>
                  </select>
                </label>
                <label>
                  Starts at
                  <select
                    aria-label={`Reserve start ${index + 1}`}
                    value={block.start}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        blocks: draft.blocks.map((b) =>
                          b.id === block.id ? { ...b, start: Number(e.target.value) } : b
                        )
                      })
                    }
                  >
                    {Array.from({ length: 12 }, (_, n) => (
                      <option key={n} value={n}>
                        {time(n)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-pair">
                <label>
                  Duration
                  <select
                    aria-label={`Reserve duration ${index + 1}`}
                    value={block.duration}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        blocks: draft.blocks.map((b) =>
                          b.id === block.id ? { ...b, duration: Number(e.target.value) } : b
                        )
                      })
                    }
                  >
                    {Array.from({ length: 12 }, (_, n) => (
                      <option key={n + 1} value={n + 1}>
                        {(n + 1) * 15} minutes
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() =>
                    setDraft({ ...draft, blocks: draft.blocks.filter((b) => b.id !== block.id) })
                  }
                >
                  Remove reserve {index + 1}
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={draft.blocks.length >= 4}
            onClick={() =>
              setDraft({
                ...draft,
                blocks: [
                  ...draft.blocks,
                  {
                    id: `block-${crypto.randomUUID().slice(0, 8)}`,
                    label: 'Walk-in reserve',
                    kind: 'walk-in',
                    start: Math.max(draft.start, draft.end - 3),
                    duration: Math.min(3, draft.end - draft.start)
                  }
                ]
              })
            }
          >
            <Plus size={14} /> Add reserved time
          </button>
        </fieldset>
        <p className="muted">
          Existing appointments must remain valid. To cancel an assigned repairer, use the planning
          desk’s scenario and review the changes.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {desk.getSnapshot().event.volunteers.some((v) => v.id === initial.id) && (
          <div className="request-removal">
            {confirmRemoval ? (
              <div className="notice warning">
                <div>
                  <strong>Remove this repairer?</strong>
                  <p>Only a repairer without appointments can be removed. Undo can restore them.</p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setConfirmRemoval(false)}
                    >
                      Keep repairer
                    </button>
                    <button
                      type="button"
                      className="button danger-button"
                      disabled={stale}
                      onClick={() => {
                        try {
                          desk.removeVolunteer(initial.id, baseRevision);
                          onClose();
                        } catch (e) {
                          setError(validationMessage(e, 'Unable to remove repairer.'));
                        }
                      }}
                    >
                      Remove repairer
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
                Remove this repairer
              </button>
            )}
          </div>
        )}
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={stale}>
            Save repairer
          </button>
        </div>
      </form>
    </Modal>
  );
}
