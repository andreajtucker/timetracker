-- companies must exist before projects references it
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotent additions for existing databases
ALTER TABLE projects ADD COLUMN IF NOT EXISTS company VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS time_entries (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tracks wall-clock billing per company: starts when first project timer starts,
-- ends when last project timer stops.
CREATE TABLE IF NOT EXISTS company_sessions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate existing free-text company names into the companies table
INSERT INTO companies (name)
SELECT DISTINCT TRIM(company) FROM projects
WHERE company IS NOT NULL AND TRIM(company) != ''
ON CONFLICT (name) DO NOTHING;

-- Backfill company_id from the legacy text column
UPDATE projects SET company_id = c.id
FROM companies c
WHERE TRIM(projects.company) = c.name AND projects.company_id IS NULL AND projects.company IS NOT NULL;
