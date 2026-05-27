import { useState } from 'react';

export default function AddProjectForm({ companies, onAdd }) {
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = name.trim();
    if (!trimmed) { setError('Enter a project name.'); return; }
    if (!companyId) { setError('Select a company.'); return; }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, company_id: companyId ? parseInt(companyId) : null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || `Server error ${res.status}`); return; }
      onAdd(data);
      setName('');
      setCompanyId('');
      setExpanded(false);
    } catch (err) {
      setError('Cannot reach server — is it running? (' + err.message + ')');
    }
  }

  function handleCancel() {
    setExpanded(false);
    setError('');
    setName('');
    setCompanyId('');
  }

  return (
    <div className="add-project-card">
      {!expanded ? (
        <div className="add-project-placeholder">
          <button className="plus-icon" onClick={() => setExpanded(true)}>+</button>
          <span>Add Project</span>
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
            <button type="button" className="btn-secondary" style={{ borderRadius: 8, padding: '10px 14px' }} onClick={handleCancel}>✕</button>
          </div>
          <select
            className="add-project-input"
            value={companyId}
            onChange={e => setCompanyId(e.target.value)}
            style={{ fontSize: '0.95rem' }}
          >
            <option value="" disabled>Select a company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {error && <span className="error-msg">{error}</span>}
        </form>
      )}
    </div>
  );
}
