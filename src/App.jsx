import { useEffect, useState } from 'react';
import './App.css';
import ProjectCard from './components/ProjectCard';
import ArchivedCard from './components/ArchivedCard';
import AddProjectForm from './components/AddProjectForm';
import DescriptionModal from './components/DescriptionModal';
import ReportsPage from './components/ReportsPage';

export default function App() {
  const [tab, setTab] = useState('tracker');
  const [projects, setProjects] = useState([]);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [activeEntries, setActiveEntries] = useState({});
  const [lastEntries, setLastEntries] = useState({});
  const [descModal, setDescModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestNotificationPermission();
    loadData();
  }, []);

  async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [projRes, archivedRes, activeRes, lastRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/projects/archived'),
        fetch('/api/time-entries/active'),
        fetch('/api/time-entries/last'),
      ]);
      const projs = await projRes.json();
      const archived = await archivedRes.json();
      const active = await activeRes.json();
      const lastAll = await lastRes.json();

      const activeMap = {};
      for (const entry of active) {
        activeMap[entry.project_id] = entry;
      }

      const lastMap = {};
      for (const entry of lastAll) {
        if (!activeMap[entry.project_id]) {
          lastMap[entry.project_id] = entry;
        }
      }

      setProjects(projs);
      setArchivedProjects(archived);
      setActiveEntries(activeMap);
      setLastEntries(lastMap);
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(projectId) {
    const res = await fetch('/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    });
    if (!res.ok) return;
    const entry = await res.json();
    setActiveEntries(prev => ({ ...prev, [projectId]: entry }));
  }

  async function handleStop(projectId, entryId, description) {
    const res = await fetch(`/api/time-entries/${entryId}/stop`, { method: 'PUT' });
    if (!res.ok) return;
    const entry = await res.json();
    setActiveEntries(prev => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    if (description?.trim()) {
      await fetch(`/api/time-entries/${entryId}/description`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      });
      entry.description = description.trim();
    }
    setLastEntries(prev => ({ ...prev, [projectId]: entry }));
  }

  async function handleDelete(projectId) {
    if (!confirm('Delete this project and all its time entries? This cannot be undone.')) return;
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setActiveEntries(prev => { const n = { ...prev }; delete n[projectId]; return n; });
    setLastEntries(prev => { const n = { ...prev }; delete n[projectId]; return n; });
  }

  async function handleDeleteArchived(projectId) {
    if (!confirm('Delete this project and all its time entries? This cannot be undone.')) return;
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    setArchivedProjects(prev => prev.filter(p => p.id !== projectId));
  }

  async function handleArchive(projectId) {
    const res = await fetch(`/api/projects/${projectId}/archive`, { method: 'PATCH' });
    if (!res.ok) return;
    const project = projects.find(p => p.id === projectId);
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setArchivedProjects(prev => [...prev, project]);
  }

  async function handleUnarchive(projectId) {
    const res = await fetch(`/api/projects/${projectId}/unarchive`, { method: 'PATCH' });
    if (!res.ok) return;
    const project = archivedProjects.find(p => p.id === projectId);
    setArchivedProjects(prev => prev.filter(p => p.id !== projectId));
    setProjects(prev => [...prev, project]);
  }

  async function handleEdit(projectId, name, company) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updated } : p));
  }

  function handleProjectAdded(project) {
    setProjects(prev => [...prev, project]);
  }

  function handleDescSave(entryId, description) {
    const modal = descModal;
    setDescModal(null);
    if (modal) {
      setLastEntries(prev => {
        const updated = { ...prev };
        for (const [pid, entry] of Object.entries(updated)) {
          if (entry.id === entryId) {
            updated[pid] = { ...entry, description };
          }
        }
        return updated;
      });
    }
  }

  function handleAddDescription(entry, projectName) {
    setDescModal({ entry, projectName });
  }

  const allCompanies = [...new Set(
    [...projects, ...archivedProjects].map(p => p.company).filter(Boolean)
  )];

  const projectsWithLastEntry = projects.map(p => ({
    ...p,
    lastEntry: lastEntries[p.id] || null,
  }));

  return (
    <>
      <header className="app-header">
        <h1>⏱ TimeTracker</h1>
        <nav className="app-nav">
          <button className={`nav-btn${tab === 'tracker' ? ' active' : ''}`} onClick={() => setTab('tracker')}>
            Tracker
          </button>
          <button className={`nav-btn${tab === 'reports' ? ' active' : ''}`} onClick={() => setTab('reports')}>
            Reports
          </button>
        </nav>
      </header>

      <main className="app-body">
        {tab === 'tracker' && (
          <>
            <div className="tracker-header">
              <h2>Projects</h2>
            </div>

            {loading ? (
              <div className="loading">Loading…</div>
            ) : (
              <>
                <div className="projects-grid">
                  {projectsWithLastEntry.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      activeEntry={activeEntries[project.id] || null}
                      onStart={handleStart}
                      onStop={handleStop}
                      onDelete={handleDelete}
                      onArchive={handleArchive}
                      onEdit={handleEdit}
                      onAddDescription={handleAddDescription}
                    />
                  ))}
                  <AddProjectForm
                    companies={allCompanies}
                    onAdd={handleProjectAdded}
                  />
                </div>

                {archivedProjects.length > 0 && (
                  <div className="archived-section">
                    <button className="archived-toggle" onClick={() => setShowArchived(o => !o)}>
                      <span>Archived Projects ({archivedProjects.length})</span>
                      <span>{showArchived ? '▲' : '▼'}</span>
                    </button>
                    {showArchived && (
                      <div className="projects-grid" style={{ marginTop: 16 }}>
                        {archivedProjects.map(project => (
                          <ArchivedCard
                            key={project.id}
                            project={project}
                            onUnarchive={handleUnarchive}
                            onDelete={handleDeleteArchived}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'reports' && (
          <>
            <div className="tracker-header">
              <h2>Reports</h2>
            </div>
            <ReportsPage />
          </>
        )}
      </main>

      {descModal && (
        <DescriptionModal
          entry={descModal.entry}
          projectName={descModal.projectName}
          onSave={handleDescSave}
          onSkip={() => setDescModal(null)}
        />
      )}
    </>
  );
}
