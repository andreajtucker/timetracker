import { useEffect, useState } from 'react';
import { formatDuration, formatDateTime, billedHours } from '../utils/time';

const PERIODS = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range' },
];

function getDateRange(entries) {
  if (!entries.length) return '—';
  const times = entries.map(e => new Date(e.start_time).getTime());
  const min = new Date(Math.min(...times));
  const max = new Date(Math.max(...times));
  const fmt = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return fmt(min) === fmt(max) ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

export default function Report({ filterCompany, filterProjectId }) {
  const [period, setPeriod] = useState('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [sortBy, setSortBy] = useState('project');
  const [sortDir, setSortDir] = useState('asc');

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(col) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const filteredData = data.filter(p => {
    if (filterCompany && p.project_company !== filterCompany) return false;
    if (filterProjectId && p.project_id !== Number(filterProjectId)) return false;
    return true;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let av, bv;
    if (sortBy === 'project') {
      av = a.project_name.toLowerCase();
      bv = b.project_name.toLowerCase();
    } else if (sortBy === 'date') {
      av = a.entries.length ? Math.max(...a.entries.map(e => new Date(e.start_time).getTime())) : 0;
      bv = b.entries.length ? Math.max(...b.entries.map(e => new Date(e.start_time).getTime())) : 0;
    } else if (sortBy === 'time' || sortBy === 'billed') {
      av = a.total_seconds;
      bv = b.total_seconds;
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalSeconds = filteredData.reduce((s, p) => s + p.total_seconds, 0);
  const totalBilled = filteredData.reduce((s, p) => s + billedHours(p.total_seconds), 0);
  const hasData = filteredData.some(p => p.entries.length > 0);

  function SortHeader({ col, label }) {
    const active = sortBy === col;
    return (
      <button
        className={`sort-header${active ? ' active' : ''}`}
        onClick={() => toggleSort(col)}
      >
        {label}
        <span className="sort-arrow">
          {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
        </span>
      </button>
    );
  }

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
            <SortHeader col="project" label="Project" />
            <SortHeader col="date" label="Date Logged" />
            <SortHeader col="time" label="Time Logged" />
            <SortHeader col="billed" label="Billed Hours" />
            <span />
          </div>

          {sortedData.map(project => (
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
                <span className="report-date">{getDateRange(project.entries)}</span>
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
              <span />
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
