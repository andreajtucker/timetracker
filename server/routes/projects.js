import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE archived = FALSE ORDER BY created_at ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /projects]', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.get('/archived', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE archived = TRUE ORDER BY created_at ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /projects/archived]', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, company } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });
    const result = await pool.query(
      'INSERT INTO projects (name, company) VALUES ($1, $2) RETURNING *',
      [name.trim(), company?.trim() || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /projects]', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, company } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });
    const result = await pool.query(
      'UPDATE projects SET name = $1, company = $2 WHERE id = $3 RETURNING *',
      [name.trim(), company?.trim() || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /projects/:id]', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE projects SET archived = TRUE WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PATCH /projects/:id/archive]', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.patch('/:id/unarchive', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE projects SET archived = FALSE WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PATCH /projects/:id/unarchive]', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /projects]', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
