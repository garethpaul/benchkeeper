import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Modal } from './components';
import { clockFor, type RepairEvent } from './domain';

type PacketSnapshot = { event: RepairEvent; revision: number };

function PacketPages({ event, revision }: PacketSnapshot) {
  const time = clockFor(event);
  const unplaced = event.requests.filter(
    (r) => !event.assignments.some((a) => a.requestId === r.id)
  );
  return (
    <div className="packet-pages">
      <section className="packet-sheet">
        <p className="packet-kicker">BENCHKEEPER · ORGANIZER COPY</p>
        <h2>{event.name}</h2>
        <p className="packet-meta">
          {time(0)}–{time(12)} · Current plan · Revision {revision}
        </p>
        <p className="packet-summary">
          {event.assignments.length} appointments · {unplaced.length} unplaced requests ·{' '}
          {event.volunteers.filter((v) => v.available).length} available repairers
        </p>
        <p>
          Planning estimates, not a guarantee of repair or safety clearance. No visitors have been
          contacted. This packet excludes all unapproved proposals.
        </p>
        <h3>Reception / requests still needing a place</h3>
        {unplaced.length ? (
          <table>
            <thead>
              <tr>
                <th scope="col">Item / visitor label</th>
                <th scope="col">Window / estimate</th>
                <th scope="col">Intake notes</th>
              </tr>
            </thead>
            <tbody>
              {unplaced.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.title}</strong>
                    <br />
                    {r.id} · {r.visitor}
                    <br />
                    {r.skill}
                  </td>
                  <td>
                    {time(r.arrival)}–{time(r.leaveBy)}
                    <br />
                    {r.duration * 15} min
                  </td>
                  <td>
                    {!r.partsReady && <strong>Parts not ready. </strong>}
                    {r.note || 'No intake notes.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Every recorded request has an appointment.</p>
        )}
        <h3>Repairer sheets included</h3>
        <ul>
          {event.volunteers.map((v) => (
            <li key={v.id}>
              {v.name} — {v.available ? `${time(v.start)}–${time(v.end)}` : 'unavailable'};{' '}
              {event.assignments.filter((a) => a.volunteerId === v.id).length} appointments
            </li>
          ))}
        </ul>
        {!event.volunteers.length && <p>No repairers recorded yet.</p>}
        <p className="packet-footnote">
          Keep this packet with the event team. It includes locally entered notes. Review your
          event’s own intake, safety and privacy procedures; this tool does not replace them.
        </p>
      </section>
      {event.volunteers.map((v) => {
        const rows = [
          ...event.assignments
            .filter((a) => a.volunteerId === v.id)
            .map((a) => ({ start: a.start, duration: a.duration, assignment: a, block: null })),
          ...v.blocks.map((b) => ({
            start: b.start,
            duration: b.duration,
            assignment: null,
            block: b
          }))
        ].sort((a, b) => a.start - b.start);
        return (
          <section className="packet-sheet" key={v.id}>
            <p className="packet-kicker">{event.name} · REPAIRER COPY</p>
            <h2>{v.name}</h2>
            <p className="packet-meta">
              {v.skills.join(' · ')} ·{' '}
              {v.available ? `${time(v.start)}–${time(v.end)}` : 'Unavailable'} · Revision{' '}
              {revision}
            </p>
            {v.available ? (
              <>
                <table>
                  <thead>
                    <tr className="packet-table-identity">
                      <th colSpan={3} scope="colgroup">
                        Repairer: {v.name} · {v.id} · Revision {revision}
                      </th>
                    </tr>
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">Item / visitor label</th>
                      <th scope="col">Notes / desk updates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      if (row.block)
                        return (
                          <tr className="packet-reserve" key={`block-${row.block.id}`}>
                            <td>
                              {time(row.start)}–{time(row.start + row.duration)}
                            </td>
                            <td>
                              <strong>Reserved: {row.block.label}</strong>
                            </td>
                            <td>
                              {row.block.kind === 'walk-in'
                                ? 'Held for walk-ins. Not bookable by the planner.'
                                : 'Repairer break. Not bookable by the planner.'}
                            </td>
                          </tr>
                        );
                      const a = row.assignment!;
                      const r = event.requests.find((request) => request.id === a.requestId)!;
                      return (
                        <tr key={r.id}>
                          <td>
                            {time(a.start)}–{time(a.start + a.duration)}
                            <br />
                            {a.duration * 15} min
                            {a.locked && (
                              <>
                                <br />
                                <strong>PROTECTED</strong>
                              </>
                            )}
                          </td>
                          <td>
                            <strong>{r.title}</strong>
                            <br />
                            {r.id} · {r.visitor}
                            <br />
                            Visitor window: {time(r.arrival)}–{time(r.leaveBy)}
                          </td>
                          <td>
                            {r.note || 'No intake notes.'}
                            <div className="packet-writing-space" aria-hidden="true" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!rows.length && <p>No appointments or reserved time recorded.</p>}
              </>
            ) : (
              <p>No work is assigned to this repairer in the current plan.</p>
            )}
            <p className="packet-footnote">
              Current local plan only. Protected appointments are promises to preserve. Coordinate
              any changes with reception. Estimates are not safety checks or repair outcomes.
            </p>
          </section>
        );
      })}
    </div>
  );
}

export function PrintPacket({
  event,
  revision,
  storageConflict = false,
  onClose
}: PacketSnapshot & { storageConflict?: boolean; onClose: () => void }) {
  // Freeze what the organizer opened. A background tool edit must not silently
  // change the paper handoff, just as it must not substitute an approval target.
  const [snapshot] = useState<PacketSnapshot>(() => ({ event: structuredClone(event), revision }));
  const stale = storageConflict || snapshot.revision !== revision;
  return (
    <>
      <Modal title="Print the current desk packet" onClose={onClose} wide>
        <p>
          One reception sheet and a job sheet for each repairer. Only the current plan is included,
          even when a proposal is on screen. Your browser can print or save a local PDF.
        </p>
        {stale && (
          <p role="alert" className="error">
            {storageConflict
              ? 'Another page changed the saved event. Close this packet and reload the latest saved event before printing.'
              : 'The event changed while this packet was open. Close and reopen it before printing the latest plan.'}
          </p>
        )}
        <div className="dialog-actions packet-actions">
          <button className="button secondary" onClick={onClose}>
            Close preview
          </button>
          <button className="button primary" disabled={stale} onClick={() => window.print()}>
            <Printer size={17} /> Print / save PDF
          </button>
        </div>
        <div className="packet-preview" aria-label="Desk packet preview">
          <PacketPages {...snapshot} />
        </div>
      </Modal>
      {createPortal(
        <div id="desk-print-packet">
          {stale ? (
            <section className="packet-sheet">
              <h2>Packet out of date</h2>
              <p>
                {storageConflict
                  ? 'Another page changed the saved event. Reload the latest saved event before printing.'
                  : 'The event changed. Close and reopen the desk packet to print the latest plan.'}
              </p>
            </section>
          ) : (
            <PacketPages {...snapshot} />
          )}
        </div>,
        document.body
      )}
    </>
  );
}
