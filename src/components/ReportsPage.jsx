import { useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import Report from './Report';

export default function ReportsPage() {
  const [filterCompany, setFilterCompany] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/projects/archived').then(r => r.json()),
    ]).then(([active, archived]) => {
      const all = [...active, ...archived];
      setProjects(all);
      setCompanies([...new Set(all.map(p => p.company).filter(Boolean))].sort());
    });
  }, []);

  const projectsForCompany = filterCompany
    ? projects.filter(p => p.company === filterCompany)
    : projects;

  return (
    <div>
      {(companies.length > 0 || projects.length > 0) && (
        <div className="report-filters">
          {companies.length > 0 && (
            <select
              className="filter-select"
              value={filterCompany}
              onChange={e => { setFilterCompany(e.target.value); setFilterProjectId(''); }}
            >
              <option value="">All Companies</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select
            className="filter-select"
            value={filterProjectId}
            onChange={e => setFilterProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
            {projectsForCompany.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      <Dashboard filterCompany={filterCompany} filterProjectId={filterProjectId} />
      <div className="reports-divider" />
      <Report filterCompany={filterCompany} filterProjectId={filterProjectId} />
    </div>
  );
}
