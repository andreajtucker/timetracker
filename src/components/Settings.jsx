import { useState } from 'react';

function CompanyRow({ company, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(company.name);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) return;
    const err = await onRename(company.id, name.trim());
    if (err) { setError(err); return; }
    setEditing(false);
    setError('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setEditing(false); setName(company.name); setError(''); }
  }

  return (
    <div className="settings-company-row">
      {editing ? (
        <div className="settings-company-edit">
          <input
            className="add-project-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            maxLength={100}
          />
          <button className="btn-primary" style={{ borderRadius: 8, padding: '8px 14px', fontSize: '0.875rem' }} onClick={handleSave}>Save</button>
          <button className="btn-secondary" style={{ borderRadius: 8, padding: '8px 14px', fontSize: '0.875rem' }} onClick={() => { setEditing(false); setName(company.name); setError(''); }}>Cancel</button>
          {error && <span className="error-msg">{error}</span>}
        </div>
      ) : (
        <>
          <span className="settings-company-name">{company.name}</span>
          <div className="settings-company-actions">
            <button className="menu-item" style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.875rem' }} onClick={() => setEditing(true)}>Rename</button>
            <button className="menu-item menu-item-danger" style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.875rem' }} onClick={() => onDelete(company.id, company.name)}>Delete</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Settings({ companies, onCompanyAdded, onCompanyRenamed, onCompanyDeleted }) {
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error); return; }
      onCompanyAdded(data);
      setNewName('');
      setAddError('');
    } catch {
      setAddError('Could not reach server.');
    }
  }

  async function handleRename(id, name) {
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) return data.error;
      onCompanyRenamed(data);
      return null;
    } catch {
      return 'Could not reach server.';
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? Projects assigned to this company will be unassigned.`)) return;
    await fetch(`/api/companies/${id}`, { method: 'DELETE' });
    onCompanyDeleted(id);
  }

  return (
    <div className="settings-page">
      <div className="settings-section">
        <h3 className="settings-section-title">Companies</h3>
        <p className="settings-section-desc">Companies are assigned to projects and used to group billing.</p>

        <div className="settings-company-list">
          {companies.length === 0 && (
            <div className="settings-empty">No companies yet. Add one below.</div>
          )}
          {companies.map(c => (
            <CompanyRow key={c.id} company={c} onRename={handleRename} onDelete={handleDelete} />
          ))}
        </div>

        <form className="settings-add-form" onSubmit={handleAdd}>
          <input
            className="add-project-input"
            placeholder="New company name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={100}
          />
          <button type="submit" className="add-project-submit">Add Company</button>
        </form>
        {addError && <span className="error-msg" style={{ marginTop: 8, display: 'block' }}>{addError}</span>}
      </div>
    </div>
  );
}
