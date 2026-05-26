import { useEffect, useState } from 'react';
import { formatDuration, billedHours } from '../utils/time';

export default function Dashboard({ filterCompanies = [], filterProjectId, period, startDate, endDate }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!period) return;
    if (period === 'custom' && (!startDate || !endDate)) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        filterCompanies.forEach(c => params.append('company', c));
        if (filterProjectId) params.set('project_id', filterProjectId);
        if (period) params.set('period', period);
        if (period === 'custom') {
          params.set('start_date', startDate);
          params.set('end_date', endDate);
        }
        const res = await fetch(`/api/reports/summary?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load summary');
        setSummary(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filterCompanies.join(','), filterProjectId, period, startDate, endDate]);

  if (loading) return <div className="loading">Loading dashboard…</div>;
  if (error) return <div className="report-table"><div className="report-empty">Error: {error}</div></div>;

  const { total_seconds, project_count, by_company } = summary;
  const totalBilled = by_company
    .filter(row => row.company !== null)
    .reduce((sum, row) => sum + billedHours(row.total_seconds), 0);
  const companyCount = by_company.filter(c => c.company).length;

  return (
    <div className="dashboard">
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-label">Total Hours Billable</div>
          <div className="stat-value">{totalBilled} hr{totalBilled !== 1 ? 's' : ''}</div>
          <div className="stat-sub">{formatDuration(total_seconds)} logged</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Companies</div>
          <div className="stat-value">{companyCount}</div>
          <div className="stat-sub">with logged time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Projects</div>
          <div className="stat-value">{project_count}</div>
          <div className="stat-sub">tracked</div>
        </div>
      </div>

      {by_company.length > 0 && (
        <div className="dashboard-section">
          <h3 className="dashboard-section-title">Hours by Company</h3>
          <div className="company-breakdown">
            {by_company.map(row => {
              const pct = total_seconds > 0 ? (row.total_seconds / total_seconds) * 100 : 0;
              const billed = billedHours(row.total_seconds);
              return (
                <div key={row.company ?? '__none__'} className="company-row">
                  <div className="company-row-header">
                    <span className="company-row-name">
                      {row.company ?? <span className="company-row-none">No company</span>}
                    </span>
                    <span className="company-row-time">
                      {formatDuration(row.total_seconds)}
                      {row.company && (
                        <span className="company-row-billed">{billed} hr{billed !== 1 ? 's' : ''} billable</span>
                      )}
                    </span>
                  </div>
                  <div className="company-bar-track">
                    <div className="company-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {by_company.length === 0 && (
        <div className="report-table" style={{ marginTop: 24 }}>
          <div className="report-empty">No time entries logged yet.</div>
        </div>
      )}
    </div>
  );
}
