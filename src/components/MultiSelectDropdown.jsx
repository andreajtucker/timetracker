import { useEffect, useRef, useState } from 'react';

export default function MultiSelectDropdown({ options, selected, onChange, placeholder = 'All' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selected`;

  function toggle(value) {
    onChange(selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value]
    );
  }

  return (
    <div className="multiselect" ref={ref}>
      <button className="multiselect-btn" onClick={() => setOpen(o => !o)}>
        <span>{label}</span>
        <span className="multiselect-arrow">▾</span>
      </button>
      {open && (
        <div className="multiselect-dropdown">
          {selected.length > 0 && (
            <button className="multiselect-clear" onClick={() => onChange([])}>Clear selection</button>
          )}
          {options.map(opt => (
            <label key={opt.value} className="multiselect-option">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
