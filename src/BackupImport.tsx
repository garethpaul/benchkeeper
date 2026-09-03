import { validationMessage } from './validation-message';
import { useEffect, useRef, useState } from 'react';
import { Modal } from './components';
import { desk } from './store';

export function BackupImport({
  expectedRevision,
  onClose,
  onImported
}: {
  expectedRevision: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const readSequence = useRef(0);
  // Ignore file reads after the dialog closes.
  useEffect(
    () => () => {
      readSequence.current++;
    },
    []
  );

  function clearFileChoice() {
    if (fileInput.current) fileInput.current.value = '';
  }
  function editText(value: string) {
    // Typing takes ownership of the draft, even if a prior file read is pending.
    readSequence.current++;
    setReading(false);
    setText(value);
    setError('');
    clearFileChoice();
  }
  async function readFile(file?: File) {
    const sequence = ++readSequence.current;
    setReading(false);
    setError('');
    if (!file) return;
    // Never leave an older draft eligible for application during a new choice.
    setText('');
    if (file.size > 100000) {
      setError('File uploads are limited to 100 KB. Choose a smaller backup.');
      clearFileChoice();
      return;
    }
    setReading(true);
    try {
      const next = await file.text();
      if (sequence !== readSequence.current) return;
      setText(next);
      if (!next.trim()) {
        setError('This file is empty. Choose another backup or paste JSON below.');
        clearFileChoice();
      }
    } catch {
      if (sequence !== readSequence.current) return;
      setError('The file could not be read. Choose it again or paste JSON below.');
      clearFileChoice();
    } finally {
      if (sequence === readSequence.current) setReading(false);
    }
  }
  function apply() {
    if (reading || !text.trim()) return;
    try {
      desk.importEvent(text, expectedRevision);
      onImported();
    } catch (error) {
      setError(validationMessage(error, 'The backup could not be imported.'));
      clearFileChoice();
    }
  }
  return (
    <Modal title="Import an event backup" onClose={onClose}>
      <p>
        Import a JSON backup or edit one to use your own volunteers and requests. This replaces the
        current event only after validation. Maximum 24 requests and 8 volunteers. Files: 100 KB;
        pasted JSON: 100,000 characters.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        onChange={(event) => void readFile(event.currentTarget.files?.[0])}
        aria-label="Choose event backup file"
      />
      {reading && (
        <p className="muted" role="status">
          Reading the selected backup… You can choose another file or paste JSON instead.
        </p>
      )}
      <label className="import-label">
        Event JSON
        <textarea
          rows={10}
          value={text}
          onChange={(event) => editText(event.target.value)}
          maxLength={100000}
          spellCheck={false}
        />
      </label>
      <div className="dialog-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary" disabled={reading || !text.trim()} onClick={apply}>
          Validate &amp; replace event
        </button>
      </div>
      <p className="muted">Cancel discards only this import draft, not the current event.</p>
    </Modal>
  );
}
