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

router.get('/', async (req, res) => {
  try {
    const { period, start_date, end_date } = req.query;
    const { start, end } = getDateRange(period, start_date, end_date);

    const result = await pool.query(
      `SELECT
        p.id AS project_id,
        p.name AS project_name,
        te.id AS entry_id,
        te.start_time,
        te.end_time,
        te.description,
        EXTRACT(EPOCH FROM (te.end_time - te.start_time)) AS duration_seconds
      FROM projects p
      LEFT JOIN time_entries te
        ON te.project_id = p.id
        AND te.start_time >= $1
        AND te.start_time <= $2
        AND te.end_time IS NOT NULL
      ORDER BY p.name, te.start_time`,
      [start, end]
    );

    const projects = {};
    for (const row of result.rows) {
      if (!projects[row.project_id]) {
        projects[row.project_id] = {
          project_id: row.project_id,
          project_name: row.project_name,
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

    res.json(Object.values(projects));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
