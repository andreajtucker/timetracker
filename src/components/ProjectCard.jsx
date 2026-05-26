import { useEffect, useRef, useState } from 'react';
import { formatElapsed, formatDuration, formatDateTime } from '../utils/time';

const WARN_SECONDS = 55 * 60;

export default function ProjectCard({ project, activeEntry, lastEntry, companies = [], notificationsEnabled, onStart, onStop, onDelete, onArchive, onEdit, onAddDescription }) {
  const [elapsed, setElapsed] = useState(0);
  const warnedRef = useRef(false);
  const [description, setDescription] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const menuRef = useRef(null);
  const intervalRef = useRef(null);

  const isRunning = !!activeEntry;

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (isRunning) {
      const tick = () => {
        const secs = (Date.now() - new Date(activeEntry.start_time).getTime()) / 1000;
        setElapsed(secs);
        if (secs >= WARN_SECONDS && !warnedRef.current) {
          warnedRef.current = true;
          triggerWarning(project.name);
        }
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(intervalRef.current);
      setElapsed(0);
      warnedRef.current = false;
      setDescription('');
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, activeEntry?.start_time]);

  function triggerWarning(name) {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`Still working on "${name}"?`, {
        body: 'You have been working for 55 minutes. Click stop when done.',
        icon: '/favicon.svg',
      });
    }
  }

  function startEditing() {
    setEditName(project.name);
    setEditCompanyId(project.company_id ? String(project.company_id) : '');
    setIsEditing(true);
    setMenuOpen(false);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return;
    await onEdit(project.id, editName.trim(), editCompanyId ? parseInt(editCompanyId) : null);
    setIsEditing(false);
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Escape') setIsEditing(false);
  }

  return (
    <div className={`project-card${isRunning ? ' running' : ''}`}>
      {isEditing ? (
        <div className="card-edit-form">
          <input
            className="add-project-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder="Project name"
            autoFocus
            maxLength={100}
          />
          <select
            className="add-project-input"
            value={editCompanyId}
            onChange={e => setEditCompanyId(e.target.value)}
            style={{ fontSize: '0.95rem' }}
          >
            <option value="">No company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="card-edit-actions">
            <button className="btn-secondary" style={{ borderRadius: 8, padding: '8px 14px', fontSize: '0.875rem' }} onClick={() => setIsEditing(false)}>Cancel</button>
            <button className="btn-primary" style={{ borderRadius: 8, padding: '8px 14px', fontSize: '0.875rem' }} onClick={handleSaveEdit}>Save</button>
          </div>
        </div>
      ) : (
        <div className="card-header">
          <div className="card-title">
            <span className="project-name" title={project.name}>{project.name}</span>
          </div>
          <div className="card-menu" ref={menuRef}>
            <button className="menu-btn" onClick={() => setMenuOpen(o => !o)} title="More options">⋯</button>
            {menuOpen && (
              <div className="menu-dropdown">
                <button className="menu-item" onClick={startEditing}>Edit</button>
                <button
                  className="menu-item"
                  onClick={() => { onArchive(project.id); setMenuOpen(false); }}
                  disabled={isRunning}
                  title={isRunning ? 'Stop the timer before archiving' : undefined}
                >Archive</button>
                <div className="menu-divider" />
                <button className="menu-item menu-item-danger" onClick={() => { onDelete(project.id); setMenuOpen(false); }}>Delete</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="timer-section">
        <div className="timer-display">
          <div className={`timer-elapsed${isRunning ? ' running' : ''}`}>
            {formatElapsed(isRunning ? elapsed : 0)}
          </div>
        </div>
        <button
          className={`timer-btn ${isRunning ? 'stop' : 'start'}`}
          onClick={isRunning ? () => onStop(project.id, activeEntry.id, description) : () => onStart(project.id)}
          title={isRunning ? 'Stop timer' : 'Start timer'}
        >
          {isRunning ? '⏹' : '▶'}
        </button>
        {isRunning && (
          <input
            className="session-desc-input"
            placeholder="What are you working on? (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={200}
          />
        )}
      </div>

      {lastEntry && !isRunning && (
        <div className="last-session">
          <div className="last-session-label">Last Session</div>
          <div className="last-session-info">
            <div className="session-time">
              <span>{formatDateTime(lastEntry.start_time)}</span>
              <span className="session-duration">{formatDuration(lastEntry.duration_seconds)}</span>
            </div>
            {lastEntry.description ? (
              <div className="session-desc-row">
                <span className="session-desc" title={lastEntry.description}>{lastEntry.description}</span>
                <button className="edit-desc-btn" onClick={() => onAddDescription(lastEntry, project.name)} title="Edit description">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button className="add-desc-btn" onClick={() => onAddDescription(lastEntry, project.name)}>
                + Add description
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
