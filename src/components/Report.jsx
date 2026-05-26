import { useEffect, useState } from 'react';
import { formatDuration, formatDateTime, billedHours } from '../utils/time';

const PERIODS = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range' },
];

export default function Report() {
  const [period, setPeriod] = useState('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [filterCompany, setFilterCompany] = useState('');
  const [filterProject, setFilterProject] = useState('');

  useEffect(() => {
    if (period !== 'custom') loadReport();
  }, [period]);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/reports?period=${period}`;
      if (period === 'custom') {
        if (!startDate || !endDate) return;
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setData(json);
      setExpanded({});
      setFilterCompany('');
      setFilterProject('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const companies = [...new Set(data.map(p => p.project_company).filter(Boolean))].sort();
  const projectsForCompany = filterCompany
    ? data.filter(p => p.project_company === filterCompany)
    : data;

  const filteredData = data.filter(p => {
    if (filterCompany && p.project_company !== filterCompany) return false;
    if (filterProject && p.project_id !== Number(filterProject)) return false;
    return true;
  });

  const totalSeconds = filteredData.reduce((s, p) => s + p.total_seconds, 0);
  const totalBilled = filteredData.reduce((s, p) => s + billedHours(p.total_seconds), 0);
  const hasData = filteredData.some(p => p.entries.length > 0);

  return (
    <div>
      <div className="report-controls">
        {PERIODS.map(p => (
          <button
            key={p.id}
            className={`period-btn${period === p.id ? ' active' : ''}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <div className="date-range-inputs">
            <input
              type="date"
              className="date-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="date-input"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
            <button className="btn-primary" style={{ borderRadius: 8, padding: '8px 16px', fontSize: '0.9rem' }}
              onClick={loadReport}>Go</button>
          </div>
        )}
      </div>

      {data.length > 0 && (
        <div className="report-filters">
          {companies.length > 0 && (
            <select
              className="filter-select"
              value={filterCompany}
              onChange={e => { setFilterCompany(e.target.value); setFilterProject(''); }}
            >
              <option value="">All Companies</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select
            className="filter-select"
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
          >
            <option value="">All Projects</option>
            {projectsForCompany.map(p => (
              <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading report…</div>
      ) : error ? (
        <div className="report-table">
          <div className="report-empty">Error loading report: {error}</div>
        </div>
      ) : !hasData ? (
        <div className="report-table">
          <div className="report-empty">No time entries found for this period.</div>
        </div>
      ) : (
        <div className="report-table">
          <div className="report-header-row">
            <span>Project</span>
            <span>Time Logged</span>
            <span>Billed Hours</span>
            <span>Details</span>
          </div>

          {filteredData.map(project => (
            <div key={project.project_id} className="report-project-row">
              <div
                className="report-project-summary"
                onClick={() => project.entries.length && toggleExpand(project.project_id)}
              >
                <div>
                  <div className="report-project-name">{project.project_name}</div>
                  {project.project_company && (
                    <div className="report-project-company">{project.project_company}</div>
                  )}
                </div>
                <span className="report-hours">{formatDuration(project.total_seconds)}</span>
                <span className="report-billed">
                  {billedHours(project.total_seconds)} hr{billedHours(project.total_seconds) !== 1 ? 's' : ''}
                </span>
                {project.entries.length > 0 ? (
                  <button className="expand-btn" onClick={e => { e.stopPropagation(); toggleExpand(project.project_id); }}>
                    {expanded[project.project_id] ? '▲' : '▼'}
                  </button>
                ) : <span />}
              </div>

              {expanded[project.project_id] && (
                <div className="report-entries">
                  {project.entries.map(entry => (
                    <div key={entry.id} className="report-entry">
                      <div className="entry-time">
                        <div>{formatDateTime(entry.start_time)}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→ {formatDateTime(entry.end_time)}</div>
                      </div>
                      <div className="entry-duration">{formatDuration(entry.duration_seconds)}</div>
                      <div>
                        {entry.description
                          ? <span className="entry-desc">{entry.description}</span>
                          : <span className="entry-desc-empty">No description</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {hasData && (
            <div className="report-total-row">
              <span>Total</span>
              <span>{formatDuration(totalSeconds)}</span>
              <span>{totalBilled} hr{totalBilled !== 1 ? 's' : ''} billed</span>
              <span />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
