import { useEffect, useState } from 'react';
import { billedHours } from '../utils/time';
import ProjectCard from './ProjectCard';

export default function CompanyGroup({ company, projects, activeEntries, lastEntries, companies, notificationsEnabled, onStart, onStop, onDelete, onArchive, onEdit, onAddDescription, onViewSessions }) {
  const [billedSecs, setBilledSecs] = useState(0);

  // Merge all entry intervals (active = [start, ∞], last = [start, end]) to find
  // the single continuous session containing now. This correctly handles chains
  // like: A(11:03–12:03) + B(11:36–2:14) + C(12:19–now) → session from 11:03.
  const hasActive = projects.some(p => activeEntries[p.id]);
  let sessionStart = null;
  if (hasActive) {
    const now = Date.now();
    const intervals = [];
    for (const p of projects) {
      if (activeEntries[p.id]) {
        intervals.push([new Date(activeEntries[p.id].start_time).getTime(), Infinity]);
      } else if (lastEntries[p.id]) {
        intervals.push([
          new Date(lastEntries[p.id].start_time).getTime(),
          new Date(lastEntries[p.id].end_time).getTime(),
        ]);
      }
    }
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [s, e] of intervals) {
      if (merged.length && s <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
      } else {
        merged.push([s, e]);
      }
    }
    const seg = merged.find(([s, e]) => s <= now && now <= e);
    sessionStart = seg ? seg[0] : null;
  }

  useEffect(() => {
    if (!sessionStart) { setBilledSecs(0); return; }
    const tick = () => setBilledSecs((Date.now() - sessionStart) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  const billed = billedHours(billedSecs);

  return (
    <div className="company-group">
      <div className="company-group-header">
        <span className="company-group-name">{company?.name ?? 'No Company'}</span>
        {sessionStart && (
          <span className="company-billing-badge" style={{ marginLeft: 10 }}>
            {billed} hr{billed !== 1 ? 's' : ''} billable
          </span>
        )}
      </div>
      <div className="projects-grid">
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            activeEntry={activeEntries[project.id] || null}
            lastEntry={lastEntries[project.id] || null}
            companies={companies}
            notificationsEnabled={notificationsEnabled}
            onStart={onStart}
            onStop={onStop}
            onDelete={onDelete}
            onArchive={onArchive}
            onEdit={onEdit}
            onAddDescription={onAddDescription}
            onViewSessions={onViewSessions}
          />
        ))}
      </div>
    </div>
  );
}
