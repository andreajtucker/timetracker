import { useEffect, useState } from 'react';
import { formatDuration, formatDate, formatTime } from '../utils/time';

export default function SessionsModal({ project, onClose }) {
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
              </div>
            ))}
            <div className="sessions-list-total">
              <span>Total</span>
              <span />
              <span />
              <span>{formatDuration(totalSeconds)}</span>
              <span />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
