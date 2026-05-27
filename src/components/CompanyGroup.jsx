import { useEffect, useState } from 'react';
import { billedHours } from '../utils/time';
import ProjectCard from './ProjectCard';

export default function CompanyGroup({ company, projects, activeEntries, lastEntries, companies, notificationsEnabled, onStart, onStop, onDelete, onArchive, onEdit, onAddDescription, onViewSessions }) {
  const [billedSecs, setBilledSecs] = useState(0);

  // Company session start = earliest active project start for this company
  const activeProjects = projects.filter(p => activeEntries[p.id]);
  const sessionStart = activeProjects.length > 0
    ? Math.min(...activeProjects.map(p => new Date(activeEntries[p.id].start_time).getTime()))
    : null;

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
