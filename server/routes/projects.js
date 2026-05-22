import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /projects]', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });
    const count = await pool.query('SELECT COUNT(*) FROM projects');
    if (parseInt(count.rows[0].count) >= 10) {
      return res.status(400).json({ error: 'Maximum of 10 projects allowed' });
    }
    const result = await pool.query(
      'INSERT INTO projects (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /projects]', err);
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
