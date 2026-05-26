import { useEffect, useRef, useState } from 'react';

export default function ArchivedCard({ project, onUnarchive, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="project-card archived-card">
      <div className="card-header">
        <div className="card-title">
          <span className="project-name" title={project.name}>{project.name}</span>
          {project.company && <span className="project-company">{project.company}</span>}
        </div>
        <div className="card-menu" ref={menuRef}>
          <button className="menu-btn" onClick={() => setMenuOpen(o => !o)} title="More options">⋯</button>
          {menuOpen && (
            <div className="menu-dropdown">
              <button className="menu-item" onClick={() => { onUnarchive(project.id); setMenuOpen(false); }}>
                Unarchive
              </button>
              <div className="menu-divider" />
              <button className="menu-item menu-item-danger" onClick={() => { onDelete(project.id); setMenuOpen(false); }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="archived-badge">Archived</div>
    </div>
  );
}
