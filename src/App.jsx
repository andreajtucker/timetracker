import { useEffect, useState } from 'react';
import './App.css';
import ProjectCard from './components/ProjectCard';
import AddProjectForm from './components/AddProjectForm';
import DescriptionModal from './components/DescriptionModal';
import Report from './components/Report';

export default function App() {
  const [tab, setTab] = useState('tracker');
  const [projects, setProjects] = useState([]);
  const [activeEntries, setActiveEntries] = useState({});  // projectId → entry
  const [lastEntries, setLastEntries] = useState({});       // projectId → entry
  const [descModal, setDescModal] = useState(null);         // { entry, projectName }
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
      const [projRes, activeRes, lastRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/time-entries/active'),
        fetch('/api/time-entries/last'),
      ]);
      const projs = await projRes.json();
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

  async function handleStop(projectId, entryId) {
    const res = await fetch(`/api/time-entries/${entryId}/stop`, { method: 'PUT' });
    if (!res.ok) return;
    const entry = await res.json();
    setActiveEntries(prev => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    setLastEntries(prev => ({ ...prev, [projectId]: entry }));
    const project = projects.find(p => p.id === projectId);
    setDescModal({ entry, projectName: project?.name || '' });
  }

  async function handleDelete(projectId) {
    if (!confirm('Remove this project and all its time entries?')) return;
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setActiveEntries(prev => { const n = { ...prev }; delete n[projectId]; return n; });
    setLastEntries(prev => { const n = { ...prev }; delete n[projectId]; return n; });
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
              <div className="projects-grid">
                {projectsWithLastEntry.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    activeEntry={activeEntries[project.id] || null}
                    onStart={handleStart}
                    onStop={handleStop}
                    onDelete={handleDelete}
                    onAddDescription={handleAddDescription}
                  />
                ))}
                <AddProjectForm
                  companies={[...new Set(projects.map(p => p.company).filter(Boolean))]}
                  onAdd={handleProjectAdded}
                />
              </div>
            )}
          </>
        )}

        {tab === 'reports' && (
          <>
            <div className="tracker-header">
              <h2>Time Reports</h2>
            </div>
            <Report />
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
