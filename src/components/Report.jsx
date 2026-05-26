import { useEffect, useState } from 'react';
import { formatDuration, formatDateTime, billedHours } from '../utils/time';

function getDateRange(entries) {
  if (!entries.length) return '—';
  const times = entries.map(e => new Date(e.start_time).getTime());
  const min = new Date(Math.min(...times));
  const max = new Date(Math.max(...times));
  const fmt = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return fmt(min) === fmt(max) ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

export default function Report({ filterCompanies = [], filterProjectId, period, startDate, endDate }) {
  const [projects, setProjects] = useState([]);
  const [companySessions, setCompanySessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [sortBy, setSortBy] = useState('company');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    if (period === 'custom' && (!startDate || !endDate)) return;
    loadReport();
  }, [period, startDate, endDate]);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/reports?period=${period}`;
      if (period === 'custom') url += `&start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setProjects(json.projects || []);
      setCompanySessions(json.company_sessions || []);
      setExpanded({});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  function toggleExpand(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const filteredProjects = projects.filter(p => {
    if (filterCompanies.length > 0 && !filterCompanies.includes(p.project_company)) return false;
    if (filterProjectId && p.project_id !== Number(filterProjectId)) return false;
    return p.entries.length > 0;
  });

  const sessionByCompanyId = Object.fromEntries(
    companySessions.map(cs => [cs.company_id, cs])
  );

  // Build company-level groups
  const groupMap = {};
  for (const p of filteredProjects) {
    const key = p.project_company_id ?? '__none__';
    if (!groupMap[key]) {
      groupMap[key] = {
        key,
        company_id: p.project_company_id,
        company_name: p.project_company,
        session: p.project_company_id ? (sessionByCompanyId[p.project_company_id] ?? null) : null,
        total_logged_seconds: 0,
        all_entries: [],
        projects: [],
      };
    }
    groupMap[key].total_logged_seconds += p.total_seconds;
    groupMap[key].all_entries.push(...p.entries);
    groupMap[key].projects.push(p);
  }

  for (const g of Object.values(groupMap)) {
    g.projects.sort((a, b) => a.project_name.localeCompare(b.project_name));
  }

  const groups = Object.values(groupMap).sort((a, b) => {
    let av, bv;
    if (sortBy === 'company') {
      if (!a.company_name && b.company_name) return sortDir === 'asc' ? 1 : -1;
      if (a.company_name && !b.company_name) return sortDir === 'asc' ? -1 : 1;
      av = (a.company_name || '').toLowerCase();
      bv = (b.company_name || '').toLowerCase();
    } else if (sortBy === 'date') {
      av = a.all_entries.length ? Math.max(...a.all_entries.map(e => new Date(e.start_time).getTime())) : 0;
      bv = b.all_entries.length ? Math.max(...b.all_entries.map(e => new Date(e.start_time).getTime())) : 0;
    } else if (sortBy === 'time') {
      av = a.total_logged_seconds;
      bv = b.total_logged_seconds;
    } else {
      av = a.session ? a.session.total_session_seconds : 0;
      bv = b.session ? b.session.total_session_seconds : 0;
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalLoggedSeconds = filteredProjects.reduce((s, p) => s + p.total_seconds, 0);
  const totalSessionSeconds = companySessions
    .filter(cs => filterCompanies.length === 0 || filterCompanies.includes(cs.company_name))
    .reduce((s, cs) => s + cs.total_session_seconds, 0);

  const hasData = groups.length > 0;

  function SortHeader({ col, label }) {
    const active = sortBy === col;
    return (
      <button className={`sort-header${active ? ' active' : ''}`} onClick={() => toggleSort(col)}>
        {label}
        <span className="sort-arrow">{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
      </button>
    );
  }

  if (loading) return <div className="loading">Loading report…</div>;

  if (error) return (
    <div className="report-table">
      <div className="report-empty">Error loading report: {error}</div>
    </div>
  );

  if (!hasData) return (
    <div className="report-table">
      <div className="report-empty">
        {period === 'custom' && (!startDate || !endDate)
          ? 'Select a date range and click Go.'
          : 'No time entries found for this period.'}
      </div>
    </div>
  );

  return (
    <div className="report-table">
      <div className="report-header-row">
        <SortHeader col="company" label="Company" />
        <SortHeader col="date" label="Date Logged" />
        <SortHeader col="time" label="Time Logged" />
        <SortHeader col="billed" label="Billable Hours" />
        <span />
      </div>

      {groups.map(group => (
        <div key={group.key} className="report-project-row">
          <div
            className="report-project-summary"
            onClick={() => toggleExpand(group.key)}
          >
            <div className="report-project-name">{group.company_name ?? 'No Company'}</div>
            <span className="report-date">{getDateRange(group.all_entries)}</span>
            <span className="report-hours">{formatDuration(group.total_logged_seconds)}</span>
            <span className="report-billed">
              {group.session
                ? `${billedHours(group.session.total_session_seconds)} hr${billedHours(group.session.total_session_seconds) !== 1 ? 's' : ''}`
                : '—'}
            </span>
            <button className="expand-btn" onClick={e => { e.stopPropagation(); toggleExpand(group.key); }}>
              {expanded[group.key] ? '▲' : '▼'}
            </button>
          </div>

          {expanded[group.key] && (
            <div className="report-entries">
              {group.projects.map(project => (
                <div key={project.project_id} className="report-project-subgroup">
                  <div className="report-project-subheader-row">
                    <span className="report-subrow-name">{project.project_name}</span>
                    <span className="report-date">{getDateRange(project.entries)}</span>
                    <span className="entry-duration">{formatDuration(project.total_seconds)}</span>
                  </div>
                  {project.entries.map(entry => (
                    <div key={entry.id} className="report-entry-row">
                      <div className="report-entry-timestamps">
                        <span>{formatDateTime(entry.start_time)}</span>
                        <span className="report-entry-arrow">→</span>
                        <span>{formatDateTime(entry.end_time)}</span>
                      </div>
                      <span className="report-entry-duration">{formatDuration(entry.duration_seconds)}</span>
                      {entry.description
                        ? <span className="entry-desc">{entry.description}</span>
                        : <span className="entry-desc-empty">No description</span>
                      }
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="report-total-row">
        <span>Total</span>
        <span />
        <span>{formatDuration(totalLoggedSeconds)}</span>
        <span>{billedHours(totalSessionSeconds)} hr{billedHours(totalSessionSeconds) !== 1 ? 's' : ''} billable</span>
        <span />
      </div>
    </div>
  );
}
