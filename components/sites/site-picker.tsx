'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

interface Site { id: string; name: string; url: string; status?: string; }

interface Props {
  sites: Site[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

// Scales to any number of sites — a flat wall of toggle buttons falls apart past
// a handful of entries, let alone the 50+ this app is meant to manage.
export default function SitePicker({ sites, selected, onChange }: Props) {
  const [query, setQuery] = useState('');
  const filtered = query
    ? sites.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) || s.url.toLowerCase().includes(query.toLowerCase()))
    : sites;
  const selectedSet = new Set(selected);

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }
  function selectAllFiltered() {
    const ids = new Set(selected);
    filtered.forEach(s => ids.add(s.id));
    onChange([...ids]);
  }
  function clearFiltered() {
    const filteredIds = new Set(filtered.map(s => s.id));
    onChange(selected.filter(id => !filteredIds.has(id)));
  }

  if (sites.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--error)' }}>No sites configured — add one in the Sites tab first.</p>;
  }

  return (
    <div className="flex flex-col rounded-md border" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
      <div className="flex items-center gap-2 px-2.5 pt-2">
        <Search size={13} style={{ color: 'var(--text-dim)' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${sites.length} sites…`}
          className="flex-1 bg-transparent text-xs outline-none py-1"
          style={{ color: 'var(--text)' }}
        />
        <span className="text-xs whitespace-nowrap" style={{ color: selected.length ? 'var(--accent-hover)' : 'var(--text-dim)' }}>
          {selected.length} selected
        </span>
      </div>
      <div className="flex gap-3 px-2.5 pt-1.5 pb-1">
        <button type="button" onClick={selectAllFiltered} className="text-xs hover:underline" style={{ color: 'var(--accent-hover)' }}>
          Select {query ? 'filtered' : 'all'} ({filtered.length})
        </button>
        <button type="button" onClick={clearFiltered} className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>
          Clear {query ? 'filtered' : 'all'}
        </button>
      </div>
      <div className="max-h-56 overflow-auto flex flex-col gap-0.5 px-1.5 pb-2">
        {filtered.length === 0 ? (
          <p className="text-xs px-2 py-3" style={{ color: 'var(--text-dim)' }}>No sites match &quot;{query}&quot;</p>
        ) : (
          filtered.map(site => (
            <label
              key={site.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors"
              style={{ color: 'var(--text)', background: selectedSet.has(site.id) ? '#6366f115' : 'transparent' }}
            >
              <input
                type="checkbox"
                checked={selectedSet.has(site.id)}
                onChange={() => toggle(site.id)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="flex-1 truncate">{site.name}</span>
              {site.status === 'error' && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--error)' }} title="Connection error" />}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
