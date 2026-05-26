import { useEffect, useState } from 'react';
import './App.css';
import CompanyGroup from './components/CompanyGroup';
import ArchivedCard from './components/ArchivedCard';
import AddProjectForm from './components/AddProjectForm';
import DescriptionModal from './components/DescriptionModal';
import ReportsPage from './components/ReportsPage';
import Settings from './components/Settings';

export default function App() {
  const [tab, setTab] = useState('tracker');
  const [projects, setProjects] = useState([]);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [trackerCompany, setTrackerCompany] = useState('');
  const [companies, setCompanies] = useState([]);
  const [activeEntries, setActiveEntries] = useState({});
  const [lastEntries, setLastEntries] = useState({});
  const [descModal, setDescModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem('notificationsEnabled') !== 'false'
  );

  useEffect(() => {
    loadData();
  }, []);

  function handleToggleNotifications(val) {
    setNotificationsEnabled(val);
    localStorage.setItem('notificationsEnabled', val);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [projRes, archivedRes, activeRes, lastRes, companiesRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/projects/archived'),
        fetch('/api/time-entries/active'),
        fetch('/api/time-entries/last'),
        fetch('/api/companies'),
      ]);
      const [projs, archived, active, lastAll, companiesList] = await Promise.all([
        projRes.json(), archivedRes.json(), activeRes.json(), lastRes.json(), companiesRes.json(),
      ]);

      const activeMap = {};
      for (const entry of active) activeMap[entry.project_id] = entry;

      const lastMap = {};
      for (const entry of lastAll) {
        if (!activeMap[entry.project_id]) lastMap[entry.project_id] = entry;
      }

      setProjects(projs);
      setArchivedProjects(archived);
      setActiveEntries(activeMap);
      setLastEntries(lastMap);
      setCompanies(Array.isArray(companiesList) ? companiesList : []);
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
    setActiveEntries(prev => { const n = { ...prev }; delete n[projectId]; return n; });
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
    const updated = await res.json();
    setArchivedProjects(prev => prev.filter(p => p.id !== projectId));
    setProjects(prev => [...prev, updated].sort((a, b) => {
      if (!a.company && b.company) return 1;
      if (a.company && !b.company) return -1;
      return (a.company || '').localeCompare(b.company || '') || new Date(a.created_at) - new Date(b.created_at);
    }));
  }

  async function handleEdit(projectId, name, companyId) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company_id: companyId }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updated } : p));
  }

  function handleProjectAdded(project) {
    setProjects(prev => [...prev, project]);
  }

  function handleDescSave(entryId, description) {
    setDescModal(null);
    setLastEntries(prev => {
      const updated = { ...prev };
      for (const [pid, entry] of Object.entries(updated)) {
        if (entry.id === entryId) updated[pid] = { ...entry, description };
      }
      return updated;
    });
  }

  function handleAddDescription(entry, projectName) {
    setDescModal({ entry, projectName });
  }

  // Company handlers for Settings
  function handleCompanyAdded(company) {
    setCompanies(prev => [...prev, company].sort((a, b) => a.name.localeCompare(b.name)));
  }
  function handleCompanyRenamed(updated) {
    setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c).sort((a, b) => a.name.localeCompare(b.name)));
    setProjects(prev => prev.map(p => p.company_id === updated.id ? { ...p, company: updated.name } : p));
  }
  function handleCompanyDeleted(id) {
    setCompanies(prev => prev.filter(c => c.id !== id));
    setProjects(prev => prev.map(p => p.company_id === id ? { ...p, company_id: null, company: null } : p));
  }

  // Group active projects by company
  const groupMap = {};
  for (const project of projects) {
    const key = project.company_id ?? '__none__';
    if (!groupMap[key]) {
      groupMap[key] = {
        company: project.company_id ? { id: project.company_id, name: project.company } : null,
        projects: [],
      };
    }
    groupMap[key].projects.push(project);
  }
  const groups = Object.values(groupMap).sort((a, b) => {
    if (!a.company) return 1;
    if (!b.company) return -1;
    return a.company.name.localeCompare(b.company.name);
  });

  const filteredGroups = trackerCompany
    ? groups.filter(g => g.company?.name === trackerCompany)
    : groups;

  const commonCardProps = {
    companies,
    activeEntries,
    lastEntries,
    notificationsEnabled,
    onStart: handleStart,
    onStop: handleStop,
    onDelete: handleDelete,
    onArchive: handleArchive,
    onEdit: handleEdit,
    onAddDescription: handleAddDescription,
  };

  return (
    <>
      <header className="app-header">
        <h1>⏱ TimeTracker</h1>
        <nav className="app-nav">
          {['tracker', 'reports', 'settings'].map(t => (
            <button key={t} className={`nav-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-body">
        {tab === 'tracker' && (
          <>
            <div className="tracker-header">
              <h2>Projects</h2>
              {companies.length > 0 && (
                <select
                  className="filter-select"
                  value={trackerCompany}
                  onChange={e => setTrackerCompany(e.target.value)}
                >
                  <option value="">All Companies</option>
                  {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              )}
            </div>
            {loading ? (
              <div className="loading">Loading…</div>
            ) : (
              <>
                <div className="projects-grid" style={{ marginBottom: filteredGroups.length ? 32 : 0 }}>
                  <AddProjectForm companies={companies} onAdd={handleProjectAdded} />
                </div>
                {filteredGroups.map(group => (
                  <CompanyGroup
                    key={group.company?.id ?? '__none__'}
                    company={group.company}
                    projects={group.projects}
                    {...commonCardProps}
                  />
                ))}

                {archivedProjects.length > 0 && (
                  <div className="archived-section">
                    <button className="archived-toggle" onClick={() => setShowArchived(o => !o)}>
                      <span>Archived Projects ({archivedProjects.length})</span>
                      <span>{showArchived ? '▲' : '▼'}</span>
                    </button>
                    {showArchived && (
                      <div className="projects-grid" style={{ marginTop: 16 }}>
                        {archivedProjects.map(project => (
                          <ArchivedCard key={project.id} project={project} onUnarchive={handleUnarchive} onDelete={handleDeleteArchived} />
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
            <div className="tracker-header"><h2>Reports</h2></div>
            <ReportsPage />
          </>
        )}

        {tab === 'settings' && (
          <>
            <div className="tracker-header"><h2>Settings</h2></div>
            <Settings
              companies={companies}
              onCompanyAdded={handleCompanyAdded}
              onCompanyRenamed={handleCompanyRenamed}
              onCompanyDeleted={handleCompanyDeleted}
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={handleToggleNotifications}
            />
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
