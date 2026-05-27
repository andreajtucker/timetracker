import express from 'express';
import pool from '../db.js';

const router = express.Router();

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

    const [totalResult, byCompanyResult] = await Promise.all([
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
        WITH daily AS (
          SELECT
            c.name AS company,
            te.start_time::date AS day,
            SUM(EXTRACT(EPOCH FROM (te.end_time - te.start_time))) AS day_seconds
          FROM time_entries te
          JOIN projects p ON p.id = te.project_id
          LEFT JOIN companies c ON c.id = p.company_id
          WHERE te.end_time IS NOT NULL
            AND te.start_time >= $3 AND te.start_time <= $4
            AND (cardinality($1::text[]) = 0 OR c.name = ANY($1::text[]))
            AND ($2::int IS NULL OR te.project_id = $2)
          GROUP BY c.name, te.start_time::date
        )
        SELECT
          company,
          SUM(day_seconds) AS total_seconds,
          CAST(SUM(CEIL(day_seconds / 3600.0)) AS INTEGER) AS billed_hours
        FROM daily
        GROUP BY company
        ORDER BY total_seconds DESC
      `, [companies, projectId, start, end]),
    ]);

    res.json({
      total_seconds: parseFloat(totalResult.rows[0].total_seconds),
      project_count: parseInt(totalResult.rows[0].project_count),
      by_company: byCompanyResult.rows.map(r => ({
        company: r.company || null,
        total_seconds: parseFloat(r.total_seconds),
        billed_hours: parseInt(r.billed_hours) || 0,
      })),
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
