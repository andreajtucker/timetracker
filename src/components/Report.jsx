import { useEffect, useState } from 'react';
import { formatDuration, formatTime } from '../utils/time';

function getDateRange(entries) {
  if (!entries.length) return '—';
  const times = entries.map(e => new Date(e.start_time).getTime());
  const min = new Date(Math.min(...times));
  const max = new Date(Math.max(...times));
  const fmt = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return fmt(min) === fmt(max) ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged = [[...sorted[0]]];
  for (const [s, e] of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

function dailyBilling(entries) {
  const map = {};
  for (const e of entries) {
    const date = e.start_time.slice(0, 10);
    if (!map[date]) map[date] = { logged: 0, intervals: [] };
    map[date].logged += e.duration_seconds;
    map[date].intervals.push([new Date(e.start_time).getTime(), new Date(e.end_time).getTime()]);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { logged, intervals }]) => {
      const wall = mergeIntervals(intervals).reduce((s, [st, en]) => s + (en - st) / 1000, 0);
      return { date, seconds: logged, billed: Math.ceil(wall / 3600) };
    });
}

function fmtDay(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Report({ filterCompanies = [], filterProjectIds = [], period, startDate, endDate }) {
  const [projects, setProjects] = useState([]);
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
    if (filterProjectIds.length > 0 && !filterProjectIds.includes(String(p.project_id))) return false;
    return p.entries.length > 0;
  });

  // Build company-level groups
  const groupMap = {};
  for (const p of filteredProjects) {
    const key = p.project_company_id ?? '__none__';
    if (!groupMap[key]) {
      groupMap[key] = {
        key,
        company_id: p.project_company_id,
        company_name: p.project_company,
        total_logged_seconds: 0,
        all_entries: [],
        projects: [],
      };
    }
    groupMap[key].total_logged_seconds += p.total_seconds;
    // Attach project info to each entry for day-level grouping in expanded view
    groupMap[key].all_entries.push(...p.entries.map(e => ({ ...e, project_id: p.project_id, project_name: p.project_name })));
    groupMap[key].projects.push(p);
  }

  for (const g of Object.values(groupMap)) {
    g.projects.sort((a, b) => a.project_name.localeCompare(b.project_name));
    g.billing_days = g.company_id ? dailyBilling(g.all_entries) : [];
    g.total_billed = g.billing_days.reduce((s, d) => s + d.billed, 0);
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
      av = a.total_billed;
      bv = b.total_billed;
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalLoggedSeconds = filteredProjects.reduce((s, p) => s + p.total_seconds, 0);
  const totalBilledHours = groups.reduce((s, g) => s + g.total_billed, 0);

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
        <SortHeader col="time" label="Project Time Logged" />
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
              {group.company_id
                ? `${group.total_billed} hr${group.total_billed !== 1 ? 's' : ''}`
                : '—'}
            </span>
            <button className="expand-btn" onClick={e => { e.stopPropagation(); toggleExpand(group.key); }}>
              {expanded[group.key] ? '▲' : '▼'}
            </button>
          </div>

          {expanded[group.key] && (
            <div className="report-entries">
              {group.company_id ? (
                group.billing_days.map(day => {
                  const dayEntries = group.all_entries.filter(e => e.start_time.slice(0, 10) === day.date);
                  const projectsForDay = {};
                  for (const e of dayEntries) {
                    if (!projectsForDay[e.project_id]) {
                      projectsForDay[e.project_id] = { project_name: e.project_name, entries: [], total_seconds: 0 };
                    }
                    projectsForDay[e.project_id].entries.push(e);
                    projectsForDay[e.project_id].total_seconds += e.duration_seconds;
                  }
                  const dayProjects = Object.values(projectsForDay).sort((a, b) => a.project_name.localeCompare(b.project_name));

                  return (
                    <div key={day.date} className="report-day-group">
                      <div className="report-day-header">
                        <span className="report-day-label">{fmtDay(day.date)}</span>
                        <span className="report-date">{formatDuration(day.seconds)}</span>
                        <span className="report-billed report-day-billed">{day.billed} hr{day.billed !== 1 ? 's' : ''} billable</span>
                      </div>
                      {dayProjects.map(proj => (
                        <div key={proj.project_name} className="report-project-subgroup">
                          <div className="report-project-subheader-row">
                            <span className="report-subrow-name">{proj.project_name}</span>
                            <span />
                            <span className="entry-duration">{formatDuration(proj.total_seconds)}</span>
                          </div>
                          {proj.entries.map(entry => (
                            <div key={entry.id} className="report-entry-row">
                              <div className="report-entry-timestamps">
                                <div><span className="report-entry-label">Start</span>{formatTime(entry.start_time)}</div>
                                <div><span className="report-entry-label">End</span>{formatTime(entry.end_time)}</div>
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
                  );
                })
              ) : (
                group.projects.map(project => (
                  <div key={project.project_id} className="report-project-subgroup">
                    <div className="report-project-subheader-row">
                      <span className="report-subrow-name">{project.project_name}</span>
                      <span className="report-date">{getDateRange(project.entries)}</span>
                      <span className="entry-duration">{formatDuration(project.total_seconds)}</span>
                    </div>
                    {project.entries.map(entry => (
                      <div key={entry.id} className="report-entry-row">
                        <div className="report-entry-timestamps">
                          <div><span className="report-entry-label">Start</span>{formatTime(entry.start_time)}</div>
                          <div><span className="report-entry-label">End</span>{formatTime(entry.end_time)}</div>
                        </div>
                        <span className="report-entry-duration">{formatDuration(entry.duration_seconds)}</span>
                        {entry.description
                          ? <span className="entry-desc">{entry.description}</span>
                          : <span className="entry-desc-empty">No description</span>
                        }
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}

      <div className="report-total-row">
        <span>Total</span>
        <span />
        <span>{formatDuration(totalLoggedSeconds)}</span>
        <span>{totalBilledHours} hr{totalBilledHours !== 1 ? 's' : ''} billable</span>
        <span />
      </div>
    </div>
  );
}
