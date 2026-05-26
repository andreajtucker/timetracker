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

export default function Report({ filterCompany, filterProjectId, period, startDate, endDate }) {
  const [projects, setProjects] = useState([]);
  const [companySessions, setCompanySessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [sortBy, setSortBy] = useState('project');
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

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const filteredProjects = projects.filter(p => {
    if (filterCompany && p.project_company !== filterCompany) return false;
    if (filterProjectId && p.project_id !== Number(filterProjectId)) return false;
    return true;
  });

  const sessionByCompanyId = Object.fromEntries(
    companySessions.map(cs => [cs.company_id, cs])
  );

  // Build company groups
  const groupMap = {};
  for (const p of filteredProjects) {
    if (!p.entries.length) continue;
    const key = p.project_company_id ?? '__none__';
    if (!groupMap[key]) {
      groupMap[key] = {
        company_id: p.project_company_id,
        company_name: p.project_company,
        session: p.project_company_id ? (sessionByCompanyId[p.project_company_id] ?? null) : null,
        projects: [],
      };
    }
    groupMap[key].projects.push(p);
  }

  // Sort projects within each group
  for (const group of Object.values(groupMap)) {
    group.projects.sort((a, b) => {
      let av, bv;
      if (sortBy === 'project') {
        av = a.project_name.toLowerCase(); bv = b.project_name.toLowerCase();
      } else if (sortBy === 'date') {
        av = a.entries.length ? Math.max(...a.entries.map(e => new Date(e.start_time).getTime())) : 0;
        bv = b.entries.length ? Math.max(...b.entries.map(e => new Date(e.start_time).getTime())) : 0;
      } else {
        av = a.total_seconds; bv = b.total_seconds;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const groups = Object.values(groupMap).sort((a, b) => {
    if (!a.company_name && b.company_name) return 1;
    if (a.company_name && !b.company_name) return -1;
    return (a.company_name || '').localeCompare(b.company_name || '');
  });

  const totalLoggedSeconds = filteredProjects.reduce((s, p) => s + p.total_seconds, 0);
  const totalBilledHrs = filteredProjects.reduce((s, p) => s + billedHours(p.total_seconds), 0);
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
        <SortHeader col="project" label="Project" />
        <SortHeader col="date" label="Date Logged" />
        <SortHeader col="time" label="Time Logged" />
        <SortHeader col="billed" label="Billed Hours" />
        <span />
      </div>

      {groups.map(group => (
        <div key={group.company_id ?? '__none__'} className="report-company-group">
          <div className="report-company-header">
            <span className="report-company-name">{group.company_name ?? 'No Company'}</span>
            {group.session && (
              <span className="report-company-billing">
                {billedHours(group.session.total_session_seconds)} hr{billedHours(group.session.total_session_seconds) !== 1 ? 's' : ''} billed (session)
              </span>
            )}
          </div>

          {group.projects.map(project => (
            <div key={project.project_id} className="report-project-row">
              <div
                className="report-project-summary"
                onClick={() => project.entries.length && toggleExpand(project.project_id)}
              >
                <div className="report-project-name">{project.project_name}</div>
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
        </div>
      ))}

      <div className="report-total-row">
        <span>Total</span>
        <span />
        <span>{formatDuration(totalLoggedSeconds)}</span>
        <span>{totalBilledHrs} hr{totalBilledHrs !== 1 ? 's' : ''} billed</span>
        <span />
      </div>
    </div>
  );
}
