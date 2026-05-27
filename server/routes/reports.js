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

function getDateRange(period, start_date, end_date) {
  const now = new Date();

  if (period === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }
  if (period === 'last_month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
    };
  }
  if (period === 'custom' && start_date && end_date) {
    const end = new Date(end_date);
    end.setHours(23, 59, 59, 999);
    return { start: new Date(start_date), end };
  }

  // Default: current week (Mon–Sun)
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

router.get('/summary', async (req, res) => {
  try {
    const companyRaw = req.query.company;
    const companies = companyRaw
      ? (Array.isArray(companyRaw) ? companyRaw : [companyRaw])
      : [];
    const projectId = req.query.project_id ? parseInt(req.query.project_id) : null;
    const { period, start_date, end_date } = req.query;
    const { start, end } = getDateRange(period, start_date, end_date);

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
          AND ($2::int IS NULL OR te.project_id = $2)
      `, [companies, projectId, start, end]),
      pool.query(`
        SELECT
          c.id AS company_id,
          c.name AS company,
          te.start_time::date AS day,
          te.start_time,
          te.end_time,
          EXTRACT(EPOCH FROM (te.end_time - te.start_time)) AS duration_seconds
        FROM time_entries te
        JOIN projects p ON p.id = te.project_id
        LEFT JOIN companies c ON c.id = p.company_id
        WHERE te.end_time IS NOT NULL
          AND te.start_time >= $3 AND te.start_time <= $4
          AND (cardinality($1::text[]) = 0 OR c.name = ANY($1::text[]))
          AND ($2::int IS NULL OR te.project_id = $2)
        ORDER BY c.id, te.start_time::date, te.start_time
      `, [companies, projectId, start, end]),
    ]);

    // Group by company → day → intervals, then merge overlaps before billing
    const companyMap = {};
    for (const row of rawEntries.rows) {
      const cKey = row.company_id ?? '__none__';
      if (!companyMap[cKey]) {
        companyMap[cKey] = { company: row.company || null, total_seconds: 0, days: {} };
      }
      const dayKey = String(row.day);
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
    const { period, start_date, end_date } = req.query;
    const { start, end } = getDateRange(period, start_date, end_date);

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
