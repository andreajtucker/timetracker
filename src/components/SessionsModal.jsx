import { useEffect, useState } from 'react';
import { formatDuration, formatDate, formatTime } from '../utils/time';

export default function SessionsModal({ project, onClose, onSessionDeleted }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/time-entries/project/${project.id}`)
      .then(r => r.json())
      .then(data => { setEntries(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project.id]);

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleDelete(entryId) {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    const res = await fetch(`/api/time-entries/${entryId}`, { method: 'DELETE' });
    if (!res.ok) return;
    setEntries(prev => prev.filter(e => e.id !== entryId));
    onSessionDeleted?.();
  }

  const totalSeconds = entries.reduce((s, e) => s + parseFloat(e.duration_seconds || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sessions-modal" onClick={e => e.stopPropagation()}>
        <div className="sessions-modal-header">
          <div>
            <h3>{project.name}</h3>
            <div className="modal-session-info">
              {loading ? 'Loading…' : `${entries.length} session${entries.length !== 1 ? 's' : ''} · ${formatDuration(totalSeconds)} total`}
            </div>
          </div>
          <button className="sessions-close-btn" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="loading" style={{ padding: '32px 0' }}>Loading sessions…</div>
        ) : entries.length === 0 ? (
          <div className="report-empty" style={{ padding: '32px 0' }}>No sessions recorded yet.</div>
        ) : (
          <div className="sessions-list">
            <div className="sessions-list-header">
              <span>Date</span>
              <span>Start</span>
              <span>End</span>
              <span>Duration</span>
              <span>Notes</span>
              <span />
            </div>
            {entries.map(entry => (
              <div key={entry.id} className="sessions-list-row">
                <span className="sessions-date">{formatDate(entry.start_time)}</span>
                <span className="sessions-time">{formatTime(entry.start_time)}</span>
                <span className="sessions-time">{formatTime(entry.end_time)}</span>
                <span className="sessions-duration">{formatDuration(entry.duration_seconds)}</span>
                <span className="sessions-desc">
                  {entry.description || <span className="entry-desc-empty">—</span>}
                </span>
                <button
                  className="sessions-delete-btn"
                  onClick={() => handleDelete(entry.id)}
                  title="Delete session"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            ))}
            <div className="sessions-list-total">
              <span>Total</span>
              <span />
              <span />
              <span>{formatDuration(totalSeconds)}</span>
              <span />
              <span />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
