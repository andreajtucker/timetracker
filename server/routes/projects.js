import express from 'express';
import pool from '../db.js';

const router = express.Router();

const WITH_COMPANY = `
  SELECT p.id, p.name, p.archived, p.created_at, p.company_id,
         c.name AS company
  FROM projects p
  LEFT JOIN companies c ON c.id = p.company_id
`;

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `${WITH_COMPANY} WHERE p.archived = FALSE ORDER BY c.name NULLS LAST, p.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /projects]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/archived', async (req, res) => {
  try {
    const result = await pool.query(
      `${WITH_COMPANY} WHERE p.archived = TRUE ORDER BY c.name NULLS LAST, p.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /projects/archived]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, company_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Project name is required' });
    const ins = await pool.query(
      'INSERT INTO projects (name, company_id) VALUES ($1, $2) RETURNING id',
      [name.trim(), company_id || null]
    );
    const result = await pool.query(`${WITH_COMPANY} WHERE p.id = $1`, [ins.rows[0].id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /projects]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, company_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Project name is required' });
    await pool.query(
      'UPDATE projects SET name = $1, company_id = $2 WHERE id = $3',
      [name.trim(), company_id || null, req.params.id]
    );
    const result = await pool.query(`${WITH_COMPANY} WHERE p.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /projects/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    await pool.query('UPDATE projects SET archived = TRUE WHERE id = $1', [req.params.id]);
    const result = await pool.query(`${WITH_COMPANY} WHERE p.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/unarchive', async (req, res) => {
  try {
    await pool.query('UPDATE projects SET archived = FALSE WHERE id = $1', [req.params.id]);
    const result = await pool.query(`${WITH_COMPANY} WHERE p.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
