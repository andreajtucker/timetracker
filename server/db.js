import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const schema = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql'),
  'utf8'
);

await pool.query(schema);

export default pool;
