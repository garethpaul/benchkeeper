import { validationMessage } from './validation-message';
import { useState, useSyncExternalStore, useRef, useEffect } from 'react';
import {
  UsersRound,
  Wrench,
  LayoutDashboard,
  ClipboardList,
  Code2,
  History,
  ArrowUpRight,
  ArrowRight,
  LockKeyhole,
  Download,
  Upload,
  RotateCcw,
  Undo2,
  Redo2,
  FilePlus2,
  Printer,
  Check,
  X,
  Sparkles
} from 'lucide-react';
import { desk } from './store';
import {
  emptyScenario,
  scenarioEvent,
  repairerLabel,
  requestLabel,
  clockFor,
  parseStartTime,
  objectiveLabels,
  objectiveDescriptions,
  planningScopeDescription,
  objectives,
  type Scenario,
  type Proposal
} from './domain';
import { useWebMCP } from './webmcp';
import { EmptyProposal, Modal, ProposalReview, Queue, RequestEditor, Timeline } from './components';
import { ToolLab } from './ToolLab';
import { Roster } from './Roster';
import { PlanApproval } from './PlanApproval';
import { PrintPacket } from './PrintPacket';
import { IntakeImport } from './IntakeImport';
import { BackupImport } from './BackupImport';
import { PlanComparison } from './PlanComparison';

type Tab = 'desk' | 'queue' | 'people' | 'tools' | 'history';
export default function App() {
  const state = useSyncExternalStore(desk.subscribe, desk.getSnapshot);
  const status = useWebMCP();
  const [tab, setTab] = useState<Tab>('desk');
  const [scenarioDraft, setScenario] = useState<Scenario | null>(null);
  const [timelineView, setTimelineView] = useState<'current' | 'proposed'>('current');
  const [modal, setModal] = useState<
    'add' | 'reset' | 'approve' | 'import' | 'new' | 'print' | 'intake' | 'recover' | null
  >(null);
  const [modalRevision, setModalRevision] = useState(0);
  const [newEventName, setNewEventName] = useState('My repair event');
  const [newEventStart, setNewEventStart] = useState('10:00');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewedProposal, setReviewedProposal] = useState<Proposal | null>(null);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  useEffect(() => {
    // BFCache restores the old JavaScript heap, not a fresh DeskStore. Another
    // same-tab document may have changed sessionStorage while this one slept.
    window.addEventListener('pageshow', desk.checkStorage);
    return () => window.removeEventListener('pageshow', desk.checkStorage);
  }, []);
  const proposal = state.proposals.find((p) => p.id === state.selectedProposalId);
  // A selected proposal owns its assumptions. Human edits are a separate draft
  // until previewed; a new native proposal must not overwrite that draft.
  const scenario = scenarioDraft ?? proposal?.scenario ?? emptyScenario();
  const time = clockFor(state.event);
  const sessionWindow = `${time(0)}–${time(12)}`;
  const handledReviewFocus = useRef(0);
  useEffect(() => {
    if (state.reviewFocusSequence === handledReviewFocus.current) return;
    if (tab !== 'desk') {
      setTab('desk');
      return;
    }
    handledReviewFocus.current = state.reviewFocusSequence;
    const heading = document.getElementById('proposal-heading');
    heading?.closest('.proposal-panel')?.scrollIntoView({ block: 'start' });
    heading?.focus({ preventScroll: true });
  }, [state.reviewFocusSequence, tab]);
  useEffect(() => {
    setTimelineView(proposal && !proposal.conflicts.length ? 'proposed' : 'current');
  }, [proposal]);
  const proposedView =
    !!proposal &&
    timelineView === 'proposed' &&
    proposal.baseRevision === state.revision &&
    !proposal.conflicts.length;
  const timelineEvent = proposedView
    ? scenarioEvent(proposal.sourceEvent, proposal.scenario)
    : state.event;
  const selected = state.event.requests.find((r) => r.id === state.focusedRequestId);
  const missing = state.event.requests.length - state.event.assignments.length;
  const storyRepairer = state.event.volunteers.find((v) => v.id === 'v-sam' && v.available);
  function openEventModal(kind: 'new' | 'reset' | 'import' | 'recover') {
    setError('');
    setModalRevision(state.revision);
    setModal(kind);
  }
  function act(fn: () => void) {
    try {
      fn();
      setError('');
    } catch (e) {
      setError(validationMessage(e, 'Something went wrong.'));
    }
  }
  function preview() {
    act(() => {
      desk.preview(scenario);
      setScenario(null);
      setTab('desk');
    });
  }
  function backup() {
    const blob = new Blob([desk.exportEvent()], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'repair-event-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      'Backup download requested. Check your browser’s downloads before closing this tab; the file contains local planning data.'
    );
  }
  function downloadUnreadableSave() {
    act(() => {
      const blob = new Blob([desk.exportUnreadableSave()], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob),
        anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'unreadable-event-save.txt';
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice(
        'Unreadable-copy download requested. Check your browser’s downloads and keep the file private. The saved data has not been replaced.'
      );
    });
  }
  const ready = status.kind === 'native' || status.kind === 'legacy';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#main"
          aria-label="Benchkeeper home"
          onClick={() => setTab('desk')}
        >
          <span className="brand-mark">
            <Wrench size={24} />
          </span>
          <span>
            Benchkeeper<small>THE REPAIR EVENT DESK</small>
          </span>
        </a>
        <div className="sidebar-event">
          <span className="event-dot" />
          <span>
            {state.event.name}
            <small>Local planning session · {sessionWindow}</small>
          </span>
        </div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: 'desk', label: 'Planning desk', icon: LayoutDashboard },
              { id: 'queue', label: 'Repair requests', icon: ClipboardList },
              { id: 'people', label: 'Repairers', icon: UsersRound },
              { id: 'tools', label: 'Agent tools', icon: Code2 },
              { id: 'history', label: 'Activity', icon: History }
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
              onFocus={(event) =>
                // Firefox can consider a partially clipped button already visible.
                event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
              }
            >
              <item.icon size={19} />
              {item.label}
              {item.id === 'queue' && <span>{state.event.requests.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="sketch">
            <Wrench size={34} />
            <span>↗</span>
          </div>
          <h3>
            Good things deserve
            <br />
            another go.
          </h3>
          <p>
            Plan the time.
            <br />
            Leave the fixing to people.
          </p>
        </div>
        <div className="local-state">
          <span className="small-dot" />
          <div>
            Private to this browser tab
            <small>
              Download a backup before closing.
              <br />
              No account. No server-side data.
              <br />
              Your browser agent’s data policy still applies.
            </small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Community repair <span>/</span> {sessionWindow}
          </div>
          <div className="header-actions">
            <span className={`webmcp-status ${ready ? 'ready' : ''}`} title={status.detail}>
              <span />
              {ready
                ? `${status.count} ${status.kind === 'legacy' ? 'legacy ' : ''}agent tools ready`
                : status.kind === 'error'
                  ? 'Tool registration failed'
                  : status.kind === 'registering'
                    ? 'Checking WebMCP…'
                    : 'Manual mode · WebMCP unavailable'}
            </span>
            <button
              className="icon-button"
              aria-label="Undo last event change"
              title={state.undoLabel ? `Undo: ${state.undoLabel}` : 'Nothing to undo'}
              disabled={!state.undoLabel}
              onClick={() =>
                act(() => {
                  desk.undo(state.revision);
                  setScenario(null);
                  setNotice(
                    'Previous event state restored. Redo is available; no external action was reversed.'
                  );
                })
              }
            >
              <Undo2 size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo event change"
              title={state.redoLabel ? `Redo: ${state.redoLabel}` : 'Nothing to redo'}
              disabled={!state.redoLabel}
              onClick={() =>
                act(() => {
                  desk.redo(state.revision);
                  setScenario(null);
                  setNotice('Local event change restored.');
                })
              }
            >
              <Redo2 size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="Start a blank event"
              title="New event"
              onClick={() => openEventModal('new')}
            >
              <FilePlus2 size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="Print current desk packet"
              title="Print current desk packet"
              onClick={() => setModal('print')}
              disabled={state.storageRecoveryAvailable || state.storageConflict}
            >
              <Printer size={19} />
            </button>
            <button
              className="icon-button"
              onClick={backup}
              disabled={state.storageRecoveryAvailable}
              aria-label="Download event backup"
              title="Download backup"
            >
              <Download size={19} />
            </button>
            <button
              className="icon-button"
              onClick={() => openEventModal('import')}
              aria-label="Import event backup"
              title="Import backup"
            >
              <Upload size={19} />
            </button>
            <button
              className="icon-button"
              onClick={() => openEventModal('reset')}
              aria-label="Reset example event"
              title="Reset example"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </header>
        <main id="main">
          {(error || state.storageIssue) && (
            <div className="notice error" role="alert">
              <div>
                <span>
                  {state.storageConflict ? state.storageIssue : error || state.storageIssue}
                </span>
                {state.storageConflict && (
                  <div className="recovery-controls">
                    {!state.storageRecoveryAvailable && (
                      <button className="button secondary" onClick={backup}>
                        Download cached event copy
                      </button>
                    )}
                    <button className="button secondary" onClick={() => window.location.reload()}>
                      Reload latest saved event
                    </button>
                  </div>
                )}
                {state.storageRecoveryAvailable && (
                  <div className="recovery-controls">
                    <button className="button secondary" onClick={downloadUnreadableSave}>
                      Download unreadable saved copy
                    </button>
                    <button
                      className="button secondary"
                      disabled={state.storageConflict}
                      onClick={() => {
                        setRecoveryConfirmed(false);
                        openEventModal('recover');
                      }}
                    >
                      Replace unreadable save…
                    </button>
                  </div>
                )}
              </div>
              {error && (
                <button
                  className="icon-button"
                  onClick={() => setError('')}
                  aria-label="Dismiss error"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
          {notice && (
            <div className="notice success" role="status">
              <span>{notice}</span>
              <button
                className="icon-button"
                onClick={() => setNotice('')}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!ready && status.kind !== 'registering' && (
            <div className="fallback-notice">
              <Code2 size={16} />
              <span>
                {status.kind === 'error'
                  ? `WebMCP registration failed: ${status.detail} Manual planning still works.`
                  : 'All planning controls work here. For native agent tools, enable chrome://flags/#enable-webmcp-testing in supported Chrome and relaunch.'}
              </span>
            </div>
          )}
          {tab === 'desk' && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">{state.event.name}</p>
                  <h1 tabIndex={-1}>
                    Make room for
                    <br />
                    <em>one more repair.</em>
                  </h1>
                  <p>People bring the skills. You and your agent make the plan.</p>
                </div>
                <div className="session-stamp">
                  <span>HOURS</span>
                  <strong>03</strong>
                  <small>{sessionWindow}</small>
                  <span className="stamp-caption">REPAIR SESSION</span>
                </div>
              </div>
              <div className="metrics-row">
                <div>
                  <span className="metric-icon">
                    <ClipboardList size={20} />
                  </span>
                  <strong>{state.event.requests.length}</strong>
                  <span>items in the queue</span>
                </div>
                <div>
                  <span className="metric-icon">
                    <Wrench size={20} />
                  </span>
                  <strong>{state.event.volunteers.filter((v) => v.available).length}</strong>
                  <span>available repairers</span>
                </div>
                <div>
                  <span className="metric-icon warm">
                    <ArrowUpRight size={20} />
                  </span>
                  <strong>{missing}</strong>
                  <span>still need a slot</span>
                </div>
                <div>
                  <span className="metric-icon">
                    <LockKeyhole size={19} />
                  </span>
                  <strong>{state.event.assignments.filter((a) => a.locked).length}</strong>
                  <span>
                    protected promise
                    {state.event.assignments.filter((a) => a.locked).length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="desk-grid">
                <div className="desk-main">
                  <section className="panel schedule-panel">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">
                          {proposedView
                            ? 'PROPOSED SCHEDULE · NOTHING APPLIED'
                            : 'THE PLAN YOU’VE COMMITTED TO'}
                        </p>
                        <h2 id="workbench-heading" tabIndex={-1}>
                          {proposedView ? 'A possible workbench plan' : 'At the workbench'}
                        </h2>
                      </div>
                      {proposal ? (
                        <div className="segmented timeline-view" aria-label="Choose schedule view">
                          <button
                            aria-pressed={!proposedView}
                            onClick={() => setTimelineView('current')}
                          >
                            Current
                          </button>
                          <button
                            aria-pressed={proposedView}
                            disabled={
                              proposal.baseRevision !== state.revision ||
                              !!proposal.conflicts.length
                            }
                            onClick={() => setTimelineView('proposed')}
                          >
                            Proposed
                          </button>
                        </div>
                      ) : (
                        <span className="status-pill success">
                          <span className="small-dot" /> Current plan
                        </span>
                      )}
                    </div>
                    <Timeline
                      event={timelineEvent}
                      assignments={proposedView ? proposal.assignments : state.event.assignments}
                      preview={proposedView}
                      onOpen={(id) => desk.focusRequest(id)}
                    />
                    <div className="schedule-footer">
                      <span>
                        <LockKeyhole size={13} /> Protected appointments and reserved time stay put.
                      </span>
                      <span>
                        {proposedView
                          ? 'Outlined appointments are new or changed.'
                          : 'Click an item to inspect or protect it'}{' '}
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </section>
                  {proposal ? (
                    <>
                      <PlanComparison
                        selected={proposal}
                        proposals={state.proposals}
                        revision={state.revision}
                        onSelect={(id) => {
                          act(() => {
                            desk.selectProposal(id);
                            setScenario(null);
                            requestAnimationFrame(() =>
                              document.getElementById('proposal-heading')?.focus()
                            );
                          });
                        }}
                      />
                      <ProposalReview
                        proposal={proposal}
                        state={state}
                        onApprove={() => {
                          setReviewedProposal(proposal);
                          setModal('approve');
                        }}
                      />
                    </>
                  ) : (
                    <EmptyProposal event={state.event} />
                  )}
                </div>
                <aside className="scenario-sidebar" aria-label="Explore a scenario">
                  <div className="scenario-card">
                    <div className="scenario-title">
                      <Sparkles size={18} />
                      <span>WHAT IF…</span>
                    </div>
                    <h2>
                      Plans change. <br />
                      Try it here first.
                    </h2>
                    <p>Explore a scenario. Nothing moves until you apply it.</p>
                    <div className="planning-preference-field">
                      <label>
                        Planning preference
                        <select
                          id="planning-preference"
                          aria-describedby="planning-preference-help"
                          value={scenario.objective}
                          onChange={(e) =>
                            setScenario({
                              ...scenario,
                              objective: e.target.value as Scenario['objective']
                            })
                          }
                        >
                          {objectives.map((objective) => (
                            <option key={objective} value={objective}>
                              {objectiveLabels[objective]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <small id="planning-preference-help" className="preference-help">
                        {objectiveDescriptions[scenario.objective]}
                      </small>
                    </div>
                    <label>
                      A repairer can’t make it
                      <select
                        value={scenario.absentVolunteerId ?? ''}
                        onChange={(e) =>
                          setScenario({ ...scenario, absentVolunteerId: e.target.value || null })
                        }
                      >
                        <option value="">No change to availability</option>
                        {state.event.volunteers
                          .filter((v) => v.available)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {repairerLabel(state.event, v.id)} is unavailable
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Allow more time per item
                      <select
                        value={scenario.extraSlots}
                        onChange={(e) =>
                          setScenario({ ...scenario, extraSlots: Number(e.target.value) })
                        }
                      >
                        <option value={0}>Use current estimates</option>
                        <option value={1}>Add 15 minutes</option>
                        <option value={2}>Add 30 minutes</option>
                      </select>
                    </label>
                    <label>
                      A missing part arrives
                      <select
                        value={scenario.readyRequestId ?? ''}
                        onChange={(e) =>
                          setScenario({ ...scenario, readyRequestId: e.target.value || null })
                        }
                      >
                        <option value="">No parts update</option>
                        {state.event.requests
                          .filter((r) => !r.partsReady)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {requestLabel(state.event, r.id)} — parts ready
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Make room for a specific item
                      <select
                        value={scenario.priorityRequestId ?? ''}
                        onChange={(e) =>
                          setScenario({ ...scenario, priorityRequestId: e.target.value || null })
                        }
                      >
                        <option value="">No individual priority</option>
                        {state.event.requests.map((r) => (
                          <option key={r.id} value={r.id}>
                            {requestLabel(state.event, r.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="button primary full" onClick={preview}>
                      Preview a new plan <ArrowRight size={17} />
                    </button>
                    <button
                      className="button secondary full compare-button"
                      onClick={() =>
                        act(() => {
                          desk.compare(scenario);
                          setScenario(null);
                          requestAnimationFrame(() =>
                            document.getElementById('comparison-heading')?.focus()
                          );
                        })
                      }
                    >
                      Compare all three preferences
                    </button>
                    {scenarioDraft && (
                      <div className="scenario-draft" role="status">
                        <p>Your scenario edits have not been previewed.</p>
                        {proposal && (
                          <small>The displayed proposal keeps its own assumptions.</small>
                        )}
                        <button
                          className="text-button"
                          onClick={() => {
                            setScenario(null);
                            requestAnimationFrame(() =>
                              document.getElementById('planning-preference')?.focus()
                            );
                          }}
                        >
                          Discard scenario edits
                        </button>
                      </div>
                    )}
                    <small className="scenario-hint">
                      Protected promises are always hard constraints. {planningScopeDescription}
                    </small>
                  </div>
                  {storyRepairer && (
                    <div className="try-card">
                      <p className="eyebrow">TRY THE STORY</p>
                      <h3>“{storyRepairer.name} can’t come today.”</h3>
                      <p>Who can take over? What stays put? And who still needs another option?</p>
                      <button
                        className="text-button"
                        onClick={() => {
                          act(() => {
                            desk.preview({ ...emptyScenario(), absentVolunteerId: 'v-sam' });
                            setScenario(null);
                          });
                        }}
                      >
                        Explore the cancellation <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                  {state.proposals.length > 1 && (
                    <div className="recent-plans">
                      <h3>Recent proposals</h3>
                      {state.proposals.map((p) => (
                        <button
                          key={p.id}
                          className={p.id === proposal?.id ? 'selected' : ''}
                          aria-pressed={p.id === proposal?.id}
                          onClick={() =>
                            act(() => {
                              desk.selectProposal(p.id);
                              setScenario(null);
                            })
                          }
                        >
                          <span>
                            {objectiveLabels[p.scenario.objective]}
                            <small>
                              {p.baseRevision !== state.revision
                                ? 'Out of date'
                                : p.conflicts.length
                                  ? 'No plan — protected conflict'
                                  : `${p.metrics.scheduled} appointments · ${p.metrics.moved} moved · ${p.metrics.noLongerScheduled} lose a slot`}
                            </small>
                          </span>
                          <ArrowRight size={15} />
                        </button>
                      ))}
                    </div>
                  )}
                </aside>
              </div>
              <Queue
                state={state}
                onAdd={() => setModal('add')}
                onPaste={() => setModal('intake')}
              />
            </>
          )}
          {tab === 'queue' && (
            <>
              <div className="page-heading compact">
                <div>
                  <p className="eyebrow">INTAKE & APPOINTMENTS</p>
                  <h1 tabIndex={-1}>Every item has a story.</h1>
                  <p>
                    Record a request, check its constraints, and protect the promises you’ve made.
                  </p>
                </div>
              </div>
              <Queue
                state={state}
                onAdd={() => setModal('add')}
                onPaste={() => setModal('intake')}
              />
            </>
          )}
          {tab === 'people' && (
            <Roster
              key={`${state.event.name}:${state.event.startMinutes}`}
              event={state.event}
              onSaved={() => setNotice('Event settings saved.')}
            />
          )}
          <div hidden={tab !== 'tools'}>
            <ToolLab status={status} />
          </div>
          {tab === 'history' && (
            <section className="activity">
              <p className="eyebrow">SHARED STATE, VISIBLE ACTIONS</p>
              <h1 tabIndex={-1}>What changed?</h1>
              <p className="muted">
                Activity for this page session. Tool calls never claim human approval.
              </p>
              {state.history.length === 0 ? (
                <p className="empty-state">
                  Your desk is untouched. Preview a plan to start the activity log.
                </p>
              ) : (
                <ol className="audit-list">
                  {state.history
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <li key={entry.id}>
                        <span className={`actor actor-${entry.actor}`}>
                          {entry.actor === 'native-tool'
                            ? 'Native tool'
                            : entry.actor === 'rehearsal'
                              ? 'Scripted rehearsal'
                              : 'Human UI'}
                        </span>
                        <p>{entry.message}</p>
                        <small>#{entry.id}</small>
                      </li>
                    ))}
                </ol>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>Built for the people who keep things going.</span>
            <span>Planning estimates only · No visitors contacted · Tab-local data</span>
          </footer>
        </main>
      </div>
      {(selected || modal === 'add') && (
        <RequestEditor
          key={selected?.id ?? 'new'}
          initial={selected}
          event={state.event}
          proposal={proposal}
          onReviewProposal={() => {
            setScenario(null);
            desk.closeRequest();
            setModal(null);
            setTab('desk');
          }}
          onClose={() => {
            desk.closeRequest();
            setModal(null);
          }}
        />
      )}
      {modal === 'print' && (
        <PrintPacket
          event={state.event}
          revision={state.revision}
          storageConflict={state.storageConflict}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'recover' && (
        <Modal title="Replace the unreadable save?" onClose={() => setModal(null)}>
          <p>
            This discards the unreadable stored value and starts from the visible example event. It
            cannot recover the original event. Download the unreadable copy first if you may need
            its contents.
          </p>
          <button className="button secondary" onClick={downloadUnreadableSave}>
            Download unreadable copy first
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <label className="checkbox-label recovery-confirmation">
            <input
              type="checkbox"
              checked={recoveryConfirmed}
              onChange={(event) => setRecoveryConfirmed(event.target.checked)}
            />
            I understand this replaces the unreadable saved data.
          </label>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Keep it for now
            </button>
            <button
              className="button primary"
              disabled={!recoveryConfirmed}
              onClick={() =>
                act(() => {
                  desk.replaceUnreadableSave(modalRevision);
                  setModal(null);
                  setNotice(
                    'Unreadable saved data was explicitly replaced. You can now use the example or import a valid backup.'
                  );
                })
              }
            >
              Replace unreadable saved data
            </button>
          </div>
        </Modal>
      )}
      {modal === 'intake' && (
        <IntakeImport
          state={state}
          onClose={() => setModal(null)}
          onAdded={(count) => {
            setModal(null);
            setNotice(
              `${count} intake requests added. Existing appointments are unchanged. Undo removes the batch.`
            );
          }}
        />
      )}
      {modal === 'new' && (
        <Modal title="Start your own repair event" onClose={() => setModal(null)}>
          <p>
            Start with an empty queue and roster. Your current event is replaced; Undo can restore
            it during this page session. Download a backup if you want a separate copy.
          </p>
          <form
            className="request-form"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => {
                desk.startBlank(newEventName, modalRevision, parseStartTime(newEventStart));
                setModal(null);
                setScenario(null);
                setTab('people');
                setNotice('Blank event created. Add your repairers, then your first request.');
              });
            }}
          >
            <label>
              New event name
              <input
                required
                maxLength={80}
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                autoFocus
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
                value={newEventStart}
                onChange={(e) => setNewEventStart(e.target.value)}
              />
              <small>
                Three-hour session, in local clock time. Set this before making appointments.
              </small>
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>
                Keep current event
              </button>
              <button className="button primary" type="submit">
                Create blank event
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'reset' && (
        <Modal title="Start the example again?" onClose={() => setModal(null)}>
          <p>
            This replaces the current event and clears proposals. Download a backup first if you
            want to keep your edits. Undo can restore the previous event during this page session.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Keep working
            </button>
            <button
              className="button primary"
              onClick={() =>
                act(() => {
                  desk.reset(modalRevision);
                  setScenario(null);
                  setModal(null);
                  setNotice('Example event restored.');
                })
              }
            >
              Reset example
            </button>
          </div>
        </Modal>
      )}
      {modal === 'approve' && reviewedProposal && (
        <PlanApproval
          proposal={reviewedProposal}
          currentRevision={state.revision}
          available={state.proposals.some((p) => p.id === reviewedProposal.id)}
          onClose={() => {
            setModal(null);
            setReviewedProposal(null);
          }}
          onApply={() => {
            desk.approveProposal(reviewedProposal.id);
            setModal(null);
            setReviewedProposal(null);
            setScenario(null);
            setNotice('Plan applied after your review. No visitors have been contacted.');
          }}
        />
      )}
      {modal === 'import' && (
        <BackupImport
          expectedRevision={modalRevision}
          onClose={() => setModal(null)}
          onImported={() => {
            setModal(null);
            setScenario(null);
            setNotice('Validated event imported.');
          }}
        />
      )}
    </div>
  );
}
