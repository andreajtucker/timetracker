import { useEffect, useRef, useState } from 'react';
import { formatElapsed, billedHours, formatDuration, formatDateTime } from '../utils/time';

const WARN_SECONDS = 55 * 60;

export default function ProjectCard({ project, activeEntry, onStart, onStop, onDelete, onAddDescription }) {
  const [elapsed, setElapsed] = useState(0);
  const [warned, setWarned] = useState(false);
  const intervalRef = useRef(null);

  const isRunning = !!activeEntry;

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

  const billed = billedHours(elapsed);
  const lastEntry = project.lastEntry;

  return (
    <div className={`project-card${isRunning ? ' running' : ''}`}>
      <div className="card-header">
        <span className="project-name" title={project.name}>{project.name}</span>
        {!isRunning && (
          <button className="delete-btn" onClick={() => onDelete(project.id)} title="Remove project">✕</button>
        )}
      </div>

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
          onClick={isRunning ? () => onStop(project.id, activeEntry.id) : () => onStart(project.id)}
          title={isRunning ? 'Stop timer' : 'Start timer'}
        >
          {isRunning ? '⏹' : '▶'}
        </button>
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
              <div className="session-desc" title={lastEntry.description}>{lastEntry.description}</div>
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
