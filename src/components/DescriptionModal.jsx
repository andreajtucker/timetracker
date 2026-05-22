import { useState } from 'react';
import { formatDuration, formatDateTime } from '../utils/time';

export default function DescriptionModal({ entry, projectName, onSave, onSkip }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const seconds = entry
    ? (new Date(entry.end_time) - new Date(entry.start_time)) / 1000
    : 0;

  async function handleSave() {
    if (!text.trim()) { onSkip(); return; }
    setSaving(true);
    try {
      await fetch(`/api/time-entries/${entry.id}/description`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text.trim() }),
      });
      onSave(entry.id, text.trim());
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.metaKey) handleSave();
    if (e.key === 'Escape') onSkip();
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Session Complete — {projectName}</h3>
        <p className="modal-session-info">
          {formatDateTime(entry?.start_time)} → {formatDateTime(entry?.end_time)}{' '}
          &nbsp;·&nbsp; <strong>{formatDuration(seconds)}</strong> logged
        </p>
        <textarea
          className="modal-textarea"
          placeholder="What did you work on? (optional)"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onSkip}>Skip</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Description'}
          </button>
        </div>
      </div>
    </div>
  );
}
