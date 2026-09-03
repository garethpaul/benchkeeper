import { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from './components';
import { type Proposal } from './domain';

// The parent captures this proposal when review begins. A later tool call can
// select another proposal behind the dialog, but cannot substitute its payload.
export function PlanApproval({
  proposal,
  currentRevision,
  available,
  onClose,
  onApply
}: {
  proposal: Proposal;
  currentRevision: number;
  available: boolean;
  onClose: () => void;
  onApply: () => void;
}) {
  const [ack, setAck] = useState(false),
    [error, setError] = useState('');
  const stale = proposal.baseRevision !== currentRevision;
  const blocked = !available || stale || proposal.conflicts.length > 0;
  return (
    <Modal title="Apply this plan?" onClose={onClose} fallbackFocusId="workbench-heading">
      <p className="approval-reference">
        Reviewing {proposal.id} · event revision {proposal.baseRevision}
      </p>
      <p>
        The current plan will be replaced by{' '}
        <strong>{proposal.metrics.scheduled} appointments</strong>. {proposal.metrics.moved} move;{' '}
        {proposal.metrics.noLongerScheduled} lose a slot. Availability and parts assumptions in this
        specific proposal become event facts.
      </p>
      <p>
        No visitor will be contacted. You are responsible for checking the estimates and
        communicating changes.
      </p>
      {!available && (
        <p className="error" role="alert">
          This reviewed proposal has expired. Close this dialog and review a current proposal.
        </p>
      )}
      {available && stale && (
        <p className="error" role="alert">
          The event changed after this proposal. Close this dialog and generate a fresh preview.
        </p>
      )}
      {proposal.conflicts.length > 0 && (
        <p className="error" role="alert">
          Protected-appointment conflicts prevent applying this proposal.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <label className="checkbox-label approval-check">
        <input
          type="checkbox"
          checked={ack}
          disabled={blocked}
          onChange={(e) => setAck(e.target.checked)}
        />{' '}
        I have reviewed the changes and scenario assumptions.
      </label>
      <div className="dialog-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!ack || blocked}
          onClick={() => {
            try {
              onApply();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to apply this proposal.');
            }
          }}
        >
          <Check size={16} /> Apply reviewed plan
        </button>
      </div>
    </Modal>
  );
}
