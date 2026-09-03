import { useState } from 'react';
import { Play, Code2, ArrowRight, ShieldCheck } from 'lucide-react';
import { runTool, toolCatalog, type WebMCPStatus } from './webmcp';

export function ToolLab({ status }: { status: WebMCPStatus }) {
  const [results, setResults] = useState<{ name: string; path: string; output: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  async function rehearsal() {
    setRunning(true);
    setResults([]);
    setError('');
    try {
      const event = await runTool('get_repair_event', {});
      setResults([{ name: 'get_repair_event', ...event }]);
      const current = JSON.parse(event.output);
      if (
        !current.ok ||
        !current.result.volunteers.some(
          (v: { id: string; available: boolean }) => v.id === 'v-sam' && v.available
        )
      )
        throw new Error(
          'This fixed rehearsal uses Sam from the example event. Load the example to rehearse it, or use the structured tools with your own event data.'
        );
      const plan = await runTool('preview_repair_plan', {
        objective: 'keep-promises',
        absentVolunteerId: 'v-sam',
        extraSlots: 0,
        readyRequestId: null
      });
      setResults((old) => [...old, { name: 'preview_repair_plan', ...plan }]);
      const parsed = JSON.parse(plan.output);
      if (!parsed.ok) throw new Error(parsed.error);
      if (parsed.result.status === 'blocked')
        throw new Error(`No plan is available: ${parsed.result.conflicts.join(' ')}`);
      const review = await runTool('request_plan_review', { proposalId: parsed.result.proposalId });
      setResults((old) => [...old, { name: 'request_plan_review', ...review }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rehearsal failed.');
    } finally {
      setRunning(false);
    }
  }
  return (
    <section className="tool-lab">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SAME DESK. TWO WAYS TO WORK.</p>
          <h2>Agent tools, out in the open.</h2>
        </div>
        <Code2 size={25} />
      </div>
      <div className="agent-intro">
        <div>
          <h3>Your browser agent is the collaborator.</h3>
          <p>
            This app does not contain a chatbot or call a model API. In a compatible browser, your
            agent can inspect the queue, compare plans and bring one back for your review.
          </p>
          <blockquote>
            “Sam can’t come today. Keep the desk lamp’s promised slot. Show me a revised plan and
            explain who still can’t fit. Don’t apply it.”
          </blockquote>
        </div>
        <div className="boundary-card">
          <ShieldCheck size={24} />
          <h3>You keep the final say.</h3>
          <p>
            No approval, promise-release, contact, payment or deployment tool is exposed. Tool
            descriptions are guidance, not a security barrier against software with full page
            access.
          </p>
          <p>
            This app stores data in your tab. A browser agent may send tool output to its model
            provider. Use anonymous labels and check your agent’s data policy before sharing notes.
          </p>
        </div>
      </div>
      <div className="panel rehearsal-panel">
        <div>
          <p className="eyebrow">REPEATABLE DEMO · NO LLM</p>
          <h3>Rehearse the cancellation</h3>
          <p>
            A fixed script reads the event, previews Sam’s absence, and opens a review. It is{' '}
            <strong>not an autonomous-agent evaluation</strong>.
          </p>
          <p className="native-detail">
            {status.kind === 'error'
              ? 'Registration failed. Manual planning still works. Download a backup before reloading to retry; reloading discards unfinished drafts.'
              : status.kind === 'native'
                ? 'Uses the real browser registration and execution APIs when available.'
                : 'Without a native execution API, calls our handlers directly and labels the fallback.'}
          </p>
        </div>
        <button
          className="button primary"
          disabled={running || status.kind === 'registering' || status.kind === 'error'}
          onClick={rehearsal}
        >
          <Play size={16} />
          {running ? 'Running…' : 'Run scripted rehearsal'}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="tool-results" aria-live="polite">
        {results.map((r, i) => (
          <details key={i} open>
            <summary>
              <span>
                {i + 1}. {r.name}
              </span>
              <small>{r.path}</small>
            </summary>
            <pre>{JSON.stringify(JSON.parse(r.output), null, 2)}</pre>
          </details>
        ))}
      </div>
      <div className="tool-catalog">
        <h3>{toolCatalog.length} structured tools</h3>
        {toolCatalog.map((t) => (
          <details key={t.name}>
            <summary>
              <Code2 size={15} />
              <code>{t.name}</code>
              <span className="status-pill neutral">
                {t.annotations.readOnlyHint ? 'read' : 'changes shared state'}
              </span>
              <ArrowRight size={14} />
            </summary>
            <p>{t.description}</p>
            <pre>{JSON.stringify(t.inputSchema, null, 2)}</pre>
          </details>
        ))}
      </div>
    </section>
  );
}
