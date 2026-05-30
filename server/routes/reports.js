import express from 'express';
import pool from '../db.js';

const router = express.Router();

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

function getDateRange(period, start_date, end_date, tzOffset = 0) {
  // Shift "now" into the user's local time using UTC methods
  const localNow = new Date(Date.now() - tzOffset * 60 * 1000);
  const y = localNow.getUTCFullYear();
  const mo = localNow.getUTCMonth();
  const d = localNow.getUTCDate();
  const dow = localNow.getUTCDay();

  // Start of a local calendar day expressed as a UTC Date
  const midnight = (year, month, date) =>
    new Date(Date.UTC(year, month, date) + tzOffset * 60 * 1000);
  // End of a local calendar day expressed as a UTC Date
  const endOfDay = (year, month, date) =>
    new Date(Date.UTC(year, month, date + 1) + tzOffset * 60 * 1000 - 1);

  if (period === 'today') {
    return { start: midnight(y, mo, d), end: endOfDay(y, mo, d) };
  }
  if (period === 'month') {
    return { start: midnight(y, mo, 1), end: endOfDay(y, mo + 1, 0) };
  }
  if (period === 'last_month') {
    return { start: midnight(y, mo - 1, 1), end: endOfDay(y, mo, 0) };
  }
  if (period === 'custom' && start_date && end_date) {
    const [sy, sm, sd] = start_date.split('-').map(Number);
    const [ey, em, ed] = end_date.split('-').map(Number);
    return { start: midnight(sy, sm - 1, sd), end: endOfDay(ey, em - 1, ed) };
  }

  // Default: current week (Mon–Sun)
  const diff = dow === 0 ? -6 : 1 - dow;
  return {
    start: midnight(y, mo, d + diff),
    end: endOfDay(y, mo, d + diff + 6),
  };
}

router.get('/summary', async (req, res) => {
  try {
    const companyRaw = req.query.company;
    const companies = companyRaw
      ? (Array.isArray(companyRaw) ? companyRaw : [companyRaw])
      : [];
    const projectIdsRaw = req.query.project_id;
    const projectIds = projectIdsRaw
      ? (Array.isArray(projectIdsRaw) ? projectIdsRaw.map(Number) : [parseInt(projectIdsRaw)])
      : [];
    const { period, start_date, end_date, tz_offset } = req.query;
    const tzOffsetMinutes = parseInt(tz_offset) || 0;
    const { start, end } = getDateRange(period, start_date, end_date, tzOffsetMinutes);

    const [totalResult, rawEntries] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(EXTRACT(EPOCH FROM (te.end_time - te.start_time))), 0) AS total_seconds,
          COUNT(DISTINCT te.project_id) AS project_count
        FROM time_entries te
        JOIN projects p ON p.id = te.project_id
        LEFT JOIN companies c ON c.id = p.company_id
        WHERE te.end_time IS NOT NULL
          AND te.start_time >= $3 AND te.start_time <= $4
          AND (cardinality($1::text[]) = 0 OR c.name = ANY($1::text[]))
          AND (cardinality($2::int[]) = 0 OR te.project_id = ANY($2::int[]))
      `, [companies, projectIds, start, end]),
      pool.query(`
        SELECT
          c.id AS company_id,
          c.name AS company,
          te.start_time,
          te.end_time,
          EXTRACT(EPOCH FROM (te.end_time - te.start_time)) AS duration_seconds
        FROM time_entries te
        JOIN projects p ON p.id = te.project_id
        LEFT JOIN companies c ON c.id = p.company_id
        WHERE te.end_time IS NOT NULL
          AND te.start_time >= $3 AND te.start_time <= $4
          AND (cardinality($1::text[]) = 0 OR c.name = ANY($1::text[]))
          AND (cardinality($2::int[]) = 0 OR te.project_id = ANY($2::int[]))
        ORDER BY c.id, te.start_time
      `, [companies, projectIds, start, end]),
    ]);

    // Group by company → local day → intervals, then merge overlaps before billing
    const companyMap = {};
    for (const row of rawEntries.rows) {
      const cKey = row.company_id ?? '__none__';
      if (!companyMap[cKey]) {
        companyMap[cKey] = { company: row.company || null, total_seconds: 0, days: {} };
      }
      const localMs = new Date(row.start_time).getTime() - tzOffsetMinutes * 60 * 1000;
      const local = new Date(localMs);
      const dayKey = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
      if (!companyMap[cKey].days[dayKey]) companyMap[cKey].days[dayKey] = [];
      companyMap[cKey].total_seconds += parseFloat(row.duration_seconds);
      companyMap[cKey].days[dayKey].push([new Date(row.start_time).getTime(), new Date(row.end_time).getTime()]);
    }

    const by_company = Object.values(companyMap).map(c => {
      let billed_hours = 0;
      for (const intervals of Object.values(c.days)) {
        const wall = mergeIntervals(intervals).reduce((s, [st, en]) => s + (en - st) / 1000, 0);
        billed_hours += Math.ceil(wall / 3600);
      }
      return { company: c.company, total_seconds: c.total_seconds, billed_hours };
    }).sort((a, b) => b.total_seconds - a.total_seconds);

    res.json({
      total_seconds: parseFloat(totalResult.rows[0].total_seconds),
      project_count: parseInt(totalResult.rows[0].project_count),
      by_company,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { period, start_date, end_date, tz_offset } = req.query;
    const { start, end } = getDateRange(period, start_date, end_date, parseInt(tz_offset) || 0);

    const entriesResult = await pool.query(`
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        p.company_id AS project_company_id,
        c.name AS project_company,
        te.id AS entry_id,
        te.start_time,
        te.end_time,
        te.description,
        EXTRACT(EPOCH FROM (te.end_time - te.start_time)) AS duration_seconds
      FROM projects p
      LEFT JOIN companies c ON c.id = p.company_id
      LEFT JOIN time_entries te
        ON te.project_id = p.id
        AND te.start_time >= $1
        AND te.start_time <= $2
        AND te.end_time IS NOT NULL
      ORDER BY c.name NULLS LAST, p.name, te.start_time
    `, [start, end]);

    const projects = {};
    for (const row of entriesResult.rows) {
      if (!projects[row.project_id]) {
        projects[row.project_id] = {
          project_id: row.project_id,
          project_name: row.project_name,
          project_company_id: row.project_company_id,
          project_company: row.project_company || null,
          total_seconds: 0,
          entries: [],
        };
      }
      if (row.entry_id) {
        const secs = parseFloat(row.duration_seconds || 0);
        projects[row.project_id].total_seconds += secs;
        projects[row.project_id].entries.push({
          id: row.entry_id,
          start_time: row.start_time,
          end_time: row.end_time,
          description: row.description,
          duration_seconds: secs,
        });
      }
    }

    res.json({ projects: Object.values(projects) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
