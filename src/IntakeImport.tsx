import { validationMessage } from './validation-message';
import { useEffect, useRef, useState } from 'react';
import { ClipboardPaste, Check } from 'lucide-react';
import { Modal } from './components';
import { desk, type DeskState } from './store';
import { clockFor } from './domain';
import { parseIntake, intakeExample, type IntakeIssue, type IntakeResult } from './intake';

type ReviewedIntake = Extract<IntakeResult, { ok: true }> & { revision: number };
export function IntakeImport({
  state,
  onClose,
  onAdded
}: {
  state: DeskState;
  onClose: () => void;
  onAdded: (count: number) => void;
}) {
  const [text, setText] = useState('');
  const [review, setReview] = useState<ReviewedIntake | null>(null);
  const [issues, setIssues] = useState<IntakeIssue[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  const stale = !!review && review.revision !== state.revision;
  const time = clockFor(state.event);
  function changeText(value: string) {
    setText(value);
    setReview(null);
    setIssues([]);
    setConfirmed(false);
  }
  function validate() {
    const current = desk.getSnapshot();
    const result = parseIntake(text, current.event);
    setConfirmed(false);
    if (result.ok) {
      setReview({ ...result, revision: current.revision });
      setIssues([]);
    } else {
      setReview(null);
      setIssues(result.issues);
    }
  }
  function add() {
    if (!review || !confirmed || stale) return;
    try {
      desk.appendRequests(review.requests, review.revision);
      onAdded(review.requests.length);
    } catch (error) {
      setIssues([
        {
          row: null,
          field: null,
          message: validationMessage(error, 'Could not add this batch.')
        }
      ]);
    }
  }
  return (
    <Modal title="Paste an intake sheet" onClose={onClose} wide>
      <p>
        Copy a small CSV or spreadsheet selection including its header. Review every row before
        adding it. Existing requests, appointments and protected promises stay unchanged.
      </p>
      <details className="intake-help">
        <summary>Column format and planning limits</summary>
        <p>
          Required: <code>item, visitor, skill, minutes, arrives, leaves, parts_ready</code>.
          Optional: <code>id, note</code>. Use anonymous visitor labels. No names or contact details
          are needed.
        </p>
        <p>
          Requests are planned independently. If one person brings several items, check their
          appointments for overlaps; visitor labels do not link records to one person.
        </p>
        <p>
          Skills: electrical, textiles, bicycle or general. Minutes: 15, 30, 45, 60, 75 or 90.
          Times: 24-hour HH:MM in 15-minute steps, inside {time(0)}–{time(12)}. Parts: explicitly{' '}
          <code>yes</code> or <code>no</code>. These remain planning estimates, not repair
          guarantees.
        </p>
        <p>
          IDs, if supplied, must be new lowercase IDs beginning with a letter, using letters,
          numbers and hyphens only (at most32 characters). Blank IDs are assigned automatically.
          Quoted commas and line breaks are supported. Formulas remain text; nothing is executed or
          uploaded.
        </p>
      </details>
      <label className="import-label intake-input">
        Intake rows (CSV or tab-separated)
        <textarea
          value={text}
          onChange={(event) => changeText(event.target.value)}
          maxLength={100000}
          rows={7}
          spellCheck={false}
          placeholder="Paste the header and request rows here…"
        />
      </label>
      <div className="intake-controls">
        <button className="button secondary" onClick={() => changeText(intakeExample(state.event))}>
          Use two synthetic example rows
        </button>
        <button className="button primary" onClick={validate} disabled={!text.trim()}>
          <ClipboardPaste size={16} />
          {stale ? 'Revalidate latest event' : 'Validate rows'}
        </button>
      </div>
      {issues.length > 0 && (
        <div className="notice error intake-errors" role="alert">
          <strong>No requests added. Correct these fields and validate again.</strong>
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>
                {issue.row ? `Row ${issue.row}${issue.field ? ` · ${issue.field}` : ''}: ` : ''}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {review && (
        <section className="intake-review" aria-label="Intake batch review">
          <h3 ref={reviewHeading} tabIndex={-1}>
            {review.requests.length} new requests to review
          </h3>
          <p>
            {review.format} · Event revision {review.revision} · {state.event.requests.length}{' '}
            existing requests. This only adds intake; it does not place appointments.
          </p>
          {stale && (
            <div className="notice warning" role="alert">
              The event changed after validation. Your pasted text is preserved. Revalidate against
              the latest event before adding these rows.
            </div>
          )}
          <div className="intake-table-scroll" tabIndex={0} aria-label="Intake rows preview">
            <table className="intake-table">
              <caption className="sr-only">
                Complete batch to append; no existing rows will be replaced
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item / ID</th>
                  <th scope="col">Visitor</th>
                  <th scope="col">Skill</th>
                  <th scope="col">Minutes</th>
                  <th scope="col">Window</th>
                  <th scope="col">Parts ready</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {review.requests.map((request) => (
                  <tr key={request.id}>
                    <th scope="row">
                      {request.title}
                      <small>{request.id}</small>
                    </th>
                    <td>{request.visitor}</td>
                    <td>{request.skill}</td>
                    <td>{request.duration * 15}</td>
                    <td>
                      {time(request.arrival)}–{time(request.leaveBy)}
                    </td>
                    <td>{request.partsReady ? 'Yes' : 'No'}</td>
                    <td>{request.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="intake-cards" aria-label="Intake rows preview">
            {review.requests.map((request) => (
              <li key={request.id}>
                <h4>{request.title}</h4>
                <small>{request.id}</small>
                <dl>
                  <div>
                    <dt>Visitor</dt>
                    <dd>{request.visitor}</dd>
                  </div>
                  <div>
                    <dt>Skill</dt>
                    <dd>{request.skill}</dd>
                  </div>
                  <div>
                    <dt>Estimate</dt>
                    <dd>{request.duration * 15} minutes</dd>
                  </div>
                  <div>
                    <dt>Window</dt>
                    <dd>
                      {time(request.arrival)}–{time(request.leaveBy)}
                    </dd>
                  </div>
                  <div>
                    <dt>Parts ready</dt>
                    <dd>{request.partsReady ? 'Yes' : 'No'}</dd>
                  </div>
                  <div className="intake-card-note">
                    <dt>Note</dt>
                    <dd>{request.note || '—'}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed && !stale}
              disabled={stale}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I checked the rows, visitor labels and parts status.
          </label>
        </section>
      )}
      <div className="dialog-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary" disabled={!review || !confirmed || stale} onClick={add}>
          <Check size={16} />
          Add reviewed requests
        </button>
      </div>
      <p className="muted">
        One undo removes the whole batch during this page session. Download a JSON backup to keep
        your event.
      </p>
    </Modal>
  );
}
