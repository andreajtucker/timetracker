import { useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import Report from './Report';
import MultiSelectDropdown from './MultiSelectDropdown';

const PERIODS = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range' },
];

export default function ReportsPage() {
  const [filterCompanies, setFilterCompanies] = useState([]);
  const [filterProjectId, setFilterProjectId] = useState('');
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [period, setPeriod] = useState('week');
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [committedStart, setCommittedStart] = useState('');
  const [committedEnd, setCommittedEnd] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/projects/archived').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]).then(([active, archived, companiesList]) => {
      setProjects([...active, ...archived]);
      setCompanies(Array.isArray(companiesList) ? companiesList : []);
    });
  }, []);

  const projectsForCompany = filterCompanies.length > 0
    ? projects.filter(p => filterCompanies.includes(p.company))
    : projects;

  function handleCompaniesChange(val) {
    setFilterCompanies(val);
    setFilterProjectId('');
  }

  function handlePeriodChange(p) {
    setPeriod(p);
    if (p !== 'custom') {
      setCommittedStart('');
      setCommittedEnd('');
    }
  }

  return (
    <div>
      <div className="report-filters">
        {companies.length > 0 && (
          <MultiSelectDropdown
            options={companies.map(c => ({ value: c.name, label: c.name }))}
            selected={filterCompanies}
            onChange={handleCompaniesChange}
            placeholder="All Companies"
          />
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

        <div className="filter-divider" />

        {PERIODS.map(p => (
          <button
            key={p.id}
            className={`period-btn${period === p.id ? ' active' : ''}`}
            onClick={() => handlePeriodChange(p.id)}
          >
            {p.label}
          </button>
        ))}

        {period === 'custom' && (
          <div className="date-range-inputs">
            <input
              type="date"
              className="date-input"
              value={draftStart}
              onChange={e => setDraftStart(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="date-input"
              value={draftEnd}
              onChange={e => setDraftEnd(e.target.value)}
            />
            <button
              className="btn-primary"
              style={{ borderRadius: 8, padding: '8px 16px', fontSize: '0.9rem' }}
              onClick={() => { setCommittedStart(draftStart); setCommittedEnd(draftEnd); }}
            >
              Go
            </button>
          </div>
        )}
      </div>

      <Dashboard
        filterCompanies={filterCompanies}
        filterProjectId={filterProjectId}
        period={period}
        startDate={committedStart}
        endDate={committedEnd}
      />
      <div className="reports-divider" />
      <Report
        filterCompanies={filterCompanies}
        filterProjectId={filterProjectId}
        period={period}
        startDate={committedStart}
        endDate={committedEnd}
      />
    </div>
  );
}
