'use client';

import { useEffect, useState, useCallback } from 'react';
import { Globe, RefreshCw, Trash2, ExternalLink, Pencil, X, Check, Loader2 } from 'lucide-react';
import Badge from '@/components/ui/badge';

interface Site {
  id: string;
  name: string;
  url: string;
  wp_username: string;
  status: 'active' | 'error' | 'unchecked';
  last_checked_at: string | null;
  last_error: string | null;
}

interface EditForm {
  name: string;
  url: string;
  wp_username: string;
  wp_password: string;
}

function statusBadge(status: Site['status']) {
  if (status === 'active') return <Badge label="Active" variant="success" />;
  if (status === 'error') return <Badge label="Error" variant="error" />;
  return <Badge label="Unchecked" variant="neutral" />;
}

export default function SiteList() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', url: '', wp_username: '', wp_password: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/sites');
    const data = await res.json();
    setSites(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('sites-updated', load);
    return () => window.removeEventListener('sites-updated', load);
  }, [load]);

  function openEdit(site: Site) {
    setEditForm({ name: site.name, url: site.url, wp_username: site.wp_username, wp_password: '' });
    setEditingId(site.id);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    const body: Record<string, string> = {
      name: editForm.name,
      url: editForm.url,
      wp_username: editForm.wp_username,
    };
    if (editForm.wp_password) body.wp_password = editForm.wp_password;
    await fetch(`/api/sites/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setEditingId(null);
    await load();
  }

  async function testSite(id: string) {
    setTesting(id);
    await fetch(`/api/sites/${id}/test`, { method: 'POST' });
    await load();
    setTesting(null);
  }

  async function deleteSite(id: string) {
    if (!confirm('Delete this site? This cannot be undone.')) return;
    setDeleting(id);
    await fetch(`/api/sites/${id}`, { method: 'DELETE' });
    await load();
    setDeleting(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading sites…</div>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed" style={{ borderColor: 'var(--border)' }}>
        <Globe size={32} style={{ color: 'var(--text-dim)' }} className="mb-3" />
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>No sites yet</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Add your first WordPress site to get started</p>
      </div>
    );
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
  };

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: `1px solid var(--border)` }}>
            {['#', 'Name', 'URL', 'Username', 'Status', 'Last checked', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.map((site, i) => {
            const isEditing = editingId === site.id;
            return (
              <tr key={site.id} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>

                {/* Row number */}
                <td className="px-4 py-3 text-xs w-8" style={{ color: 'var(--text-dim)' }}>
                  {i + 1}
                </td>

                {/* Name */}
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>
                  {isEditing ? (
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="px-2 py-1 rounded border text-xs w-full outline-none"
                      style={inputStyle}
                    />
                  ) : site.name}
                </td>

                {/* URL */}
                <td className="px-4 py-3">
                  {isEditing ? (
                    <input
                      value={editForm.url}
                      onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                      className="px-2 py-1 rounded border text-xs w-full outline-none"
                      style={inputStyle}
                      placeholder="https://example.com"
                    />
                  ) : (
                    <a href={site.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>
                      {new URL(site.url).hostname}
                      <ExternalLink size={10} />
                    </a>
                  )}
                </td>

                {/* Username */}
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isEditing ? (
                    <input
                      value={editForm.wp_username}
                      onChange={e => setEditForm({ ...editForm, wp_username: e.target.value })}
                      className="px-2 py-1 rounded border text-xs w-full outline-none"
                      style={inputStyle}
                    />
                  ) : site.wp_username}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  {isEditing ? (
                    <input
                      value={editForm.wp_password}
                      onChange={e => setEditForm({ ...editForm, wp_password: e.target.value })}
                      type="password"
                      placeholder="New password (leave blank to keep)"
                      className="px-2 py-1 rounded border text-xs w-40 outline-none"
                      style={inputStyle}
                    />
                  ) : (
                    <>
                      {statusBadge(site.status)}
                      {site.last_error && site.status === 'error' && (
                        <p className="text-xs mt-1 max-w-xs truncate" style={{ color: 'var(--error)' }}>{site.last_error}</p>
                      )}
                    </>
                  )}
                </td>

                {/* Last checked */}
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                  {site.last_checked_at ? new Date(site.last_checked_at).toLocaleString() : '—'}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    {isEditing ? (
                      <>
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="p-1.5 rounded transition-colors hover:opacity-80 disabled:opacity-40"
                          style={{ color: '#4ade80', background: '#15803d20' }}
                          title="Save"
                        >
                          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded transition-colors hover:opacity-80"
                          style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(site)}
                          className="p-1.5 rounded transition-colors hover:opacity-80"
                          style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => testSite(site.id)}
                          disabled={testing === site.id}
                          className="p-1.5 rounded transition-colors hover:opacity-80 disabled:opacity-40"
                          style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
                          title="Test connection"
                        >
                          <RefreshCw size={13} className={testing === site.id ? 'animate-spin' : ''} />
                        </button>
                        <button
                          onClick={() => deleteSite(site.id)}
                          disabled={deleting === site.id}
                          className="p-1.5 rounded transition-colors hover:opacity-80 disabled:opacity-40"
                          style={{ color: 'var(--error)', background: '#ef444415' }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
