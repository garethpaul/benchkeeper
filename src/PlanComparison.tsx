import { ArrowRight } from 'lucide-react';
import {
  comparisonChoices,
  objectiveLabels,
  repairerLabel,
  requestLabel,
  type Proposal
} from './domain';

export function PlanComparison({
  selected,
  proposals,
  revision,
  onSelect
}: {
  selected: Proposal;
  proposals: Proposal[];
  revision: number;
  onSelect: (id: string) => void;
}) {
  const choices = comparisonChoices(selected, proposals, revision);
  if (choices.length < 2) return null;
  const { scenario, sourceEvent: event } = selected;
  const assumptions = [
    scenario.absentVolunteerId
      ? `${repairerLabel(event, scenario.absentVolunteerId)} unavailable`
      : 'recorded staffing',
    scenario.extraSlots ? `+${scenario.extraSlots * 15} minutes per item` : 'current estimates',
    scenario.readyRequestId
      ? `parts ready for ${requestLabel(event, scenario.readyRequestId)}`
      : 'recorded parts',
    scenario.priorityRequestId
      ? `priority for ${requestLabel(event, scenario.priorityRequestId)}`
      : 'no individual priority'
  ];
  const inspect = (proposal: Proposal) => (
    <button
      className="text-button"
      aria-label={`Inspect ${objectiveLabels[proposal.scenario.objective]}`}
      aria-pressed={selected.id === proposal.id}
      onClick={() => onSelect(proposal.id)}
    >
      {selected.id === proposal.id ? 'Viewing' : 'Inspect'} <ArrowRight size={14} />
    </button>
  );
  return (
    <section className="panel comparison-panel" aria-labelledby="comparison-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SAME ASSUMPTIONS · DIFFERENT PREFERENCES</p>
          <h2 id="comparison-heading" tabIndex={-1}>
            Compare the trade-offs
          </h2>
        </div>
      </div>
      <p className="comparison-context">
        Revision {revision}. {assumptions.join(' · ')}. Nothing applied.
      </p>
      <table className="comparison-table">
        <caption className="sr-only">
          Planning preferences with identical scenario assumptions
        </caption>
        <thead>
          <tr>
            <th scope="col">Preference</th>
            <th scope="col">Scheduled</th>
            <th scope="col">Lose a slot</th>
            <th scope="col">Unchanged</th>
            <th scope="col">Moved</th>
            <th scope="col">
              <span className="sr-only">Inspect changes</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {choices.map((proposal) => (
            <tr key={proposal.id} className={selected.id === proposal.id ? 'selected' : ''}>
              <th scope="row">{objectiveLabels[proposal.scenario.objective]}</th>
              {proposal.conflicts.length ? (
                <td colSpan={4}>No plan — protected appointment conflict</td>
              ) : (
                <>
                  <td>{proposal.metrics.scheduled}</td>
                  <td className={proposal.metrics.noLongerScheduled ? 'lost-slot-count' : ''}>
                    {proposal.metrics.noLongerScheduled}
                  </td>
                  <td>{proposal.metrics.retained}</td>
                  <td>{proposal.metrics.moved}</td>
                </>
              )}
              <td>{inspect(proposal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="comparison-cards">
        {choices.map((proposal) => (
          <article key={proposal.id} className={selected.id === proposal.id ? 'selected' : ''}>
            <h3>{objectiveLabels[proposal.scenario.objective]}</h3>
            {proposal.conflicts.length ? (
              <p>No plan — protected appointment conflict</p>
            ) : (
              <dl>
                <div>
                  <dt>Scheduled</dt>
                  <dd>{proposal.metrics.scheduled}</dd>
                </div>
                <div>
                  <dt>Lose a slot</dt>
                  <dd className={proposal.metrics.noLongerScheduled ? 'lost-slot-count' : ''}>
                    {proposal.metrics.noLongerScheduled}
                  </dd>
                </div>
                <div>
                  <dt>Unchanged</dt>
                  <dd>{proposal.metrics.retained}</dd>
                </div>
                <div>
                  <dt>Moved</dt>
                  <dd>{proposal.metrics.moved}</dd>
                </div>
              </dl>
            )}
            {inspect(proposal)}
          </article>
        ))}
      </div>
      <p className="comparison-footnote">
        “Lose a slot” counts requests whose existing booking is removed, not unique visitors.
        Unchanged means the same repairer, time and duration. These are bounded-search alternatives,
        not guaranteed optimal plans.
      </p>
    </section>
  );
}
