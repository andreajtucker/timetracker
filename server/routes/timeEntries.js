import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/active', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT te.*,
        COALESCE((
          SELECT SUM(EXTRACT(EPOCH FROM (end_time - start_time)))
          FROM time_entries t2
          WHERE t2.project_id = te.project_id AND t2.end_time IS NOT NULL
        ), 0) AS total_seconds
      FROM time_entries te WHERE te.end_time IS NULL
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/last', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (project_id) *,
        EXTRACT(EPOCH FROM (end_time - start_time)) AS duration_seconds,
        COALESCE((
          SELECT SUM(EXTRACT(EPOCH FROM (end_time - start_time)))
          FROM time_entries t2
          WHERE t2.project_id = te.project_id AND t2.end_time IS NOT NULL
        ), 0) AS total_seconds
      FROM time_entries te
      WHERE end_time IS NOT NULL
      ORDER BY project_id, start_time DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/project/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *,
        EXTRACT(EPOCH FROM (end_time - start_time)) AS duration_seconds
      FROM time_entries
      WHERE project_id = $1 AND end_time IS NOT NULL
      ORDER BY start_time DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id } = req.body;

    const existing = await pool.query(
      'SELECT id FROM time_entries WHERE project_id = $1 AND end_time IS NULL',
      [project_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Timer already running for this project' });
    }

    const result = await pool.query(
      'INSERT INTO time_entries (project_id, start_time) VALUES ($1, NOW()) RETURNING *',
      [project_id]
    );
    const entry = result.rows[0];

    // Open a company session if this is the first active project for the company
    const proj = await pool.query('SELECT company_id FROM projects WHERE id = $1', [project_id]);
    const company_id = proj.rows[0]?.company_id;
    if (company_id) {
      const otherActive = await pool.query(`
        SELECT te.id FROM time_entries te
        JOIN projects p ON p.id = te.project_id
        WHERE p.company_id = $1 AND te.end_time IS NULL AND te.id != $2
      `, [company_id, entry.id]);

      if (otherActive.rows.length === 0) {
        await pool.query(
          'INSERT INTO company_sessions (company_id, start_time) VALUES ($1, NOW())',
          [company_id]
        );
      }
    }

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/stop', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE time_entries SET end_time = NOW() WHERE id = $1
       RETURNING *, EXTRACT(EPOCH FROM (end_time - start_time)) AS duration_seconds`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found' });
    const entry = result.rows[0];

    // Close the company session if no other projects for this company are still active
    const proj = await pool.query('SELECT company_id FROM projects WHERE id = $1', [entry.project_id]);
    const company_id = proj.rows[0]?.company_id;
    if (company_id) {
      const stillActive = await pool.query(`
        SELECT te.id FROM time_entries te
        JOIN projects p ON p.id = te.project_id
        WHERE p.company_id = $1 AND te.end_time IS NULL
      `, [company_id]);

      if (stillActive.rows.length === 0) {
        await pool.query(
          'UPDATE company_sessions SET end_time = NOW() WHERE company_id = $1 AND end_time IS NULL',
          [company_id]
        );
      }
    }

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM time_entries WHERE id = $1 AND end_time IS NOT NULL RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found or still active' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/description', async (req, res) => {
  try {
    const { description } = req.body;
    const result = await pool.query(
      'UPDATE time_entries SET description = $1 WHERE id = $2 RETURNING *',
      [description, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
