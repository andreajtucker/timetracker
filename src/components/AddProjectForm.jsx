import { useState } from 'react';

export default function AddProjectForm({ projectCount, onAdd }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  if (projectCount >= 10) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = name.trim();
    if (!trimmed) { setError('Enter a project name.'); return; }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || `Server error ${res.status}`); return; }
      onAdd(data);
      setName('');
      setExpanded(false);
    } catch (err) {
      setError('Cannot reach server — is it running? (' + err.message + ')');
    }
  }

  return (
    <div className="add-project-card">
      {!expanded ? (
        <div className="add-project-placeholder">
          <button className="plus-icon" onClick={() => setExpanded(true)}>+</button>
          <span>Add Project</span>
          <span className="project-count">{projectCount}/10 projects</span>
        </div>
      ) : (
        <form className="add-project-form" onSubmit={handleSubmit} style={{ flexDirection: 'column', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, width: '100%', minWidth: 0 }}>
            <input
              className="add-project-input"
              placeholder="Project name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              maxLength={100}
            />
            <button type="submit" className="add-project-submit">Add</button>
            <button type="button" className="btn-secondary" style={{ borderRadius: 8, padding: '10px 14px' }}
              onClick={() => { setExpanded(false); setError(''); setName(''); }}>✕</button>
          </div>
          {error && <span className="error-msg">{error}</span>}
        </form>
      )}
    </div>
  );
}
