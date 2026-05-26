import { useEffect, useRef, useState } from 'react';
import { formatElapsed, billedHours, formatDuration, formatDateTime } from '../utils/time';

const WARN_SECONDS = 55 * 60;

export default function ProjectCard({ project, activeEntry, onStart, onStop, onDelete, onArchive, onEdit, onAddDescription }) {
  const [elapsed, setElapsed] = useState(0);
  const [warned, setWarned] = useState(false);
  const [description, setDescription] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const menuRef = useRef(null);
  const intervalRef = useRef(null);

  const isRunning = !!activeEntry;

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (isRunning) {
      const tick = () => {
        const secs = (Date.now() - new Date(activeEntry.start_time).getTime()) / 1000;
        setElapsed(secs);
        if (secs >= WARN_SECONDS && !warned) {
          setWarned(true);
          triggerWarning(project.name);
        }
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(intervalRef.current);
      setElapsed(0);
      setWarned(false);
      setDescription('');
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, activeEntry?.start_time]);

  function triggerWarning(name) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Still working on "${name}"?`, {
        body: 'You have been working for 55 minutes. Click stop when done.',
        icon: '/favicon.svg',
      });
    }
  }

  function startEditing() {
    setEditName(project.name);
    setEditCompany(project.company || '');
    setIsEditing(true);
    setMenuOpen(false);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return;
    await onEdit(project.id, editName.trim(), editCompany.trim() || null);
    setIsEditing(false);
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') setIsEditing(false);
  }

  const billed = billedHours(elapsed);
  const lastEntry = project.lastEntry;

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
          <input
            className="add-project-input"
            value={editCompany}
            onChange={e => setEditCompany(e.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder="Company (optional)"
            maxLength={100}
          />
          <div className="card-edit-actions">
            <button className="btn-secondary" style={{ borderRadius: 8, padding: '8px 14px', fontSize: '0.875rem' }}
              onClick={() => setIsEditing(false)}>Cancel</button>
            <button className="btn-primary" style={{ borderRadius: 8, padding: '8px 14px', fontSize: '0.875rem' }}
              onClick={handleSaveEdit}>Save</button>
          </div>
        </div>
      ) : (
        <div className="card-header">
          <div className="card-title">
            <span className="project-name" title={project.name}>{project.name}</span>
            {project.company && <span className="project-company">{project.company}</span>}
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
                >
                  Archive
                </button>
                <div className="menu-divider" />
                <button className="menu-item menu-item-danger" onClick={() => { onDelete(project.id); setMenuOpen(false); }}>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="timer-section">
        {isRunning && elapsed >= WARN_SECONDS && (
          <div className="warning-banner">
            <span className="warn-icon">⚠️</span>
            <span>55+ minutes logged — are you still working?</span>
          </div>
        )}

        <div className="timer-display">
          <div className={`timer-elapsed${isRunning ? ' running' : ''}`}>
            {formatElapsed(isRunning ? elapsed : 0)}
          </div>
          {isRunning && (
            <div className="timer-billed">
              <span>{billed}</span> hr{billed !== 1 ? 's' : ''} billed
            </div>
          )}
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
              <button className="session-desc add-desc-btn" title="Edit description"
                onClick={() => onAddDescription(lastEntry, project.name)}>
                {lastEntry.description}
              </button>
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
