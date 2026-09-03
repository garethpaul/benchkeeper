import { ArrowRight, SearchCheck } from 'lucide-react';
import { desk } from './store';
import {
  emptyScenario,
  clockFor,
  repairerLabel,
  requestLabel,
  type Proposal,
  type RepairEvent
} from './domain';

export function CapacityPanel({
  requestId,
  event,
  proposal,
  previewBlockedReason,
  onReview
}: {
  requestId: string;
  event: RepairEvent;
  proposal?: Proposal;
  previewBlockedReason?: string;
  onReview: () => void;
}) {
  let report: ReturnType<typeof desk.inspectCapacity>;
  try {
    report = desk.inspectCapacity(requestId, proposal?.id);
  } catch (error) {
    return (
      <div className="notice warning">
        <p>{error instanceof Error ? error.message : 'Capacity details are unavailable.'}</p>
      </div>
    );
  }
  const time = clockFor(event);
  const opening = report.bestOpening;
  return (
    <section className="capacity-panel" aria-label="Capacity explanation">
      <div className="capacity-heading">
        <SearchCheck size={19} />
        <h3>{proposal ? 'Why it does not fit this proposal' : 'Capacity in the current plan'}</h3>
      </div>
      <p>{report.explanation}</p>
      {report.candidateStarts > 0 && (
        <div className="capacity-counts">
          <span>
            <strong>{report.requiredMinutes}</strong> minutes needed
          </span>
          <span>
            <strong>{report.candidateStarts}</strong> time-window starts checked
          </span>
          <span>
            <strong>{report.startsBlockedByPromises}</strong> cross a protected slot
          </span>
          <span>
            <strong>{report.startsBlockedByReservations}</strong> cross reserved time
          </span>
        </div>
      )}
      {report.startsBlockedByPromises > 0 && report.startsBlockedByReservations > 0 && (
        <small>A start can cross both; counts may overlap.</small>
      )}
      {opening && report.status !== 'scheduled' && (
        <div className="capacity-opening">
          <strong>
            One possible opening: {time(opening.start)}–{time(opening.start + opening.duration)}{' '}
            with {repairerLabel(event, opening.volunteerId)}
          </strong>
          <p>
            {opening.displacedRequestIds.length ? (
              <>
                Would displace:{' '}
                {opening.displacedRequestIds.map((id) => requestLabel(event, id)).join(', ')}. Those
                visitors have not been replanned yet.
              </>
            ) : (
              'No existing appointment occupies this slot.'
            )}
          </p>
        </div>
      )}
      {(report.status === 'occupied_capacity' || report.status === 'open_slot') && (
        <>
          <button
            className="button secondary"
            type="button"
            disabled={!!previewBlockedReason}
            aria-describedby="capacity-preview-help"
            onClick={() => {
              if (previewBlockedReason) return;
              desk.preview({
                ...(proposal?.scenario ?? emptyScenario()),
                priorityRequestId: requestId
              });
              onReview();
            }}
          >
            Preview making room for this item <ArrowRight size={15} />
          </button>
          <small id="capacity-preview-help">
            {previewBlockedReason ??
              'This creates a full proposal so you can review who moves or loses a slot. Protected promises remain fixed.'}
          </small>
        </>
      )}
    </section>
  );
}
