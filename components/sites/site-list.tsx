'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Globe, RefreshCw, Trash2, ExternalLink, Pencil, X, Check, Loader2, Search, AlertTriangle } from 'lucide-react';
import Badge from '@/components/ui/badge';

type AuthMode = 'plugin' | 'apppassword';

interface Site {
  id: string;
  name: string;
  url: string;
  login_url: string | null;
  plugin_key_encrypted: string | null;
  plugin_version: string | null;
  wp_username: string | null;
  status: 'active' | 'error' | 'unchecked';
  last_checked_at: string | null;
  last_error: string | null;
}

interface EditForm {
  name: string;
  url: string;
  login_url: string;
  auth_mode: AuthMode;
  plugin_key: string;
  wp_username: string;
  wp_password: string;
}

function versionCmp(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
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
  const [editForm, setEditForm] = useState<EditForm>({ name: '', url: '', login_url: '', auth_mode: 'plugin', plugin_key: '', wp_username: '', wp_password: '' });
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const versionsChecked = useRef(false);
  const [latest, setLatest] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [updateNote, setUpdateNote] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/sites');
    const data = await res.json();
    setSites(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch('/api/plugin/latest').then(r => r.json()).then(d => setLatest(d.version ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('sites-updated', load);
    return () => window.removeEventListener('sites-updated', load);
  }, [load]);

  // Plugin versions are only recorded when a site is tested — fill in any that are unknown, once per visit.
  useEffect(() => {
    if (versionsChecked.current || loading) return;
    const staleMs = 10 * 60 * 1000;
    const unknown = sites.filter(s => s.plugin_key_encrypted && (!s.plugin_version || !s.last_checked_at || Date.now() - new Date(s.last_checked_at).getTime() > staleMs));
    versionsChecked.current = true;
    if (!unknown.length) return;
    (async () => {
      const queue = [...unknown];
      await Promise.all(Array.from({ length: 4 }, async () => {
        for (let s = queue.shift(); s; s = queue.shift()) {
          await fetch(`/api/sites/${s.id}/test`, { method: 'POST' }).catch(() => {});
        }
      }));
      await load();
    })();
  }, [sites, loading, load]);

  function openEdit(site: Site) {
    setEditForm({
      name: site.name,
      url: site.url,
      login_url: site.login_url ?? '',
      auth_mode: site.plugin_key_encrypted ? 'plugin' : 'apppassword',
      plugin_key: '',
      wp_username: site.wp_username ?? '',
      wp_password: '',
    });
    setEditingId(site.id);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    const body: Record<string, string> = {
      name: editForm.name,
      url: editForm.url,
      login_url: editForm.login_url,
      auth_mode: editForm.auth_mode,
    };
    if (editForm.auth_mode === 'plugin') {
      if (editForm.plugin_key) body.plugin_key = editForm.plugin_key;
    } else {
      body.wp_username = editForm.wp_username;
      if (editForm.wp_password) body.wp_password = editForm.wp_password;
    }
    await fetch(`/api/sites/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setEditingId(null);
    await load();
    await testSite(editingId);
  }

  async function testSite(id: string) {
    setTesting(id);
    await fetch(`/api/sites/${id}/test`, { method: 'POST' });
    await load();
    setTesting(null);
  }

  const isOutdated = (s: Site) =>
    !!s.plugin_key_encrypted && !!latest && (!s.plugin_version || versionCmp(s.plugin_version, latest) < 0);

  async function updateOne(id: string): Promise<{ ok: boolean; message: string; manual?: boolean }> {
    const data = await fetch(`/api/sites/${id}/update-plugin`, { method: 'POST' }).then(r => r.json()).catch(() => ({ ok: false, error: 'Request failed' }));
    if (!data.ok) return { ok: false, message: data.error ?? 'Update failed', manual: /cannot update itself/.test(data.error ?? '') };
    return { ok: true, message: data.message ?? (data.updated ? `Updated to v${data.version}` : `Already on v${data.version}`) };
  }

  async function updatePlugin(site: Site) {
    setUpdatingId(site.id);
    const r = await updateOne(site.id);
    setUpdateNote({ ok: r.ok, message: `${site.name}: ${r.message}` });
    await load();
    setUpdatingId(null);
  }

  async function updateAllOutdated() {
    const targets = sites.filter(isOutdated);
    if (!targets.length) return;
    if (!confirm(`Update the plugin on ${targets.length} site(s) to v${latest}?`)) return;
    setBulkUpdating(true);
    setUpdateNote(null);
    let done = 0; const manual: string[] = []; const failed: string[] = [];
    const queue = [...targets];
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        const r = await updateOne(s.id);
        if (r.ok) done++; else if (r.manual) manual.push(s.name); else failed.push(`${s.name} (${r.message})`);
      }
    }));
    await load();
    setBulkUpdating(false);
    const parts = [`${done} updated`];
    if (manual.length) parts.push(`${manual.length} need a one-time manual ZIP upload: ${manual.join(', ')}`);
    if (failed.length) parts.push(`${failed.length} failed: ${failed.join('; ')}`);
    setUpdateNote({ ok: !manual.length && !failed.length, message: parts.join(' — ') });
  }

  async function deleteSite(id: string, name: string) {
    setDeleting(id);
    const articles: { id: string; status: string; site_ids: string[] }[] = await fetch('/api/articles')
      .then(r => r.json()).catch(() => []);
    const referencing = (Array.isArray(articles) ? articles : []).filter(
      a => a.status !== 'discarded' && a.site_ids?.includes(id)
    );
    const publishedCount = referencing.filter(a => a.status === 'published').length;

    let message = `Delete "${name}"? This cannot be undone.`;
    if (referencing.length) {
      message = `"${name}" is referenced by ${referencing.length} article(s)` +
        (publishedCount ? `, including ${publishedCount} already published there — deleting the site will NOT remove those live posts from WordPress, they'll just become unmanageable from here.` : '.') +
        ` Delete the site anyway?`;
    }
    if (!confirm(message)) { setDeleting(null); return; }

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

  const filtered = query
    ? sites.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) || s.url.toLowerCase().includes(query.toLowerCase()))
    : sites;
  const errorCount = sites.filter(s => s.status === 'error').length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full max-w-xs" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <Search size={13} style={{ color: 'var(--text-dim)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${sites.length} sites…`}
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--text)' }}
          />
        </div>
        {sites.some(isOutdated) && (
          <button
            onClick={updateAllOutdated}
            disabled={bulkUpdating}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {bulkUpdating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Update {sites.filter(isOutdated).length} outdated plugin(s)
          </button>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--error)' }}>
            <AlertTriangle size={13} />
            {errorCount} site(s) with connection errors
          </span>
        )}
      </div>

      {updateNote && (
        <div className="px-4 py-2.5 rounded-lg border text-xs" style={{ background: updateNote.ok ? '#15803d15' : '#f59e0b15', borderColor: updateNote.ok ? '#15803d40' : '#f59e0b40', color: updateNote.ok ? '#4ade80' : '#fbbf24' }}>
          {updateNote.message}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: `1px solid var(--border)` }}>
            {['No.', 'Name', 'URL', 'Login URL', 'Username', 'Plugin', 'Status', 'Last checked', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={9} className="px-4 py-8 text-center text-xs" style={{ color: 'var(--text-dim)' }}>No sites match &quot;{query}&quot;</td></tr>
          )}
          {filtered.map((site, i) => {
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

                {/* Login URL */}
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isEditing ? (
                    <input
                      value={editForm.login_url}
                      onChange={e => setEditForm({ ...editForm, login_url: e.target.value })}
                      className="px-2 py-1 rounded border text-xs w-full outline-none"
                      style={inputStyle}
                      placeholder="/wp-admin"
                    />
                  ) : site.login_url ? (
                    <a href={`${site.url.replace(/\/$/, '')}${site.login_url}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:underline" style={{ color: 'var(--text-muted)' }}>
                      {site.login_url}
                      <ExternalLink size={10} />
                    </a>
                  ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                </td>

                {/* Username / Auth */}
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isEditing ? (
                    <div className="flex flex-col gap-1.5 min-w-[160px]">
                      <div className="flex gap-1">
                        {(['plugin', 'apppassword'] as AuthMode[]).map(mode => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setEditForm({ ...editForm, auth_mode: mode })}
                            className="flex-1 py-1 rounded text-[10px] font-medium transition-colors"
                            style={{
                              background: editForm.auth_mode === mode ? 'var(--accent)' : 'var(--surface-2)',
                              color: editForm.auth_mode === mode ? 'white' : 'var(--text-muted)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {mode === 'plugin' ? 'Plugin Key' : 'App Password'}
                          </button>
                        ))}
                      </div>
                      {editForm.auth_mode === 'plugin' ? (
                        <input
                          value={editForm.plugin_key}
                          onChange={e => setEditForm({ ...editForm, plugin_key: e.target.value })}
                          placeholder="Paste new key (leave blank to keep)"
                          className="px-2 py-1 rounded border text-xs w-full outline-none"
                          style={inputStyle}
                        />
                      ) : (
                        <input
                          value={editForm.wp_username}
                          onChange={e => setEditForm({ ...editForm, wp_username: e.target.value })}
                          placeholder="WP username"
                          className="px-2 py-1 rounded border text-xs w-full outline-none"
                          style={inputStyle}
                        />
                      )}
                    </div>
                  ) : (
                    site.plugin_key_encrypted ? <span style={{ color: 'var(--accent-hover)' }}>Plugin Key</span> : (site.wp_username ?? '—')
                  )}
                </td>

                {/* Plugin version */}
                <td className="px-4 py-3 text-xs">
                  {!site.plugin_key_encrypted ? (
                    <span style={{ color: 'var(--text-dim)' }}>—</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span style={{ color: isOutdated(site) ? '#fbbf24' : 'var(--text-muted)' }}>
                        {site.plugin_version ? `v${site.plugin_version}` : 'unknown'}
                      </span>
                      {isOutdated(site) && (
                        <button
                          onClick={() => updatePlugin(site)}
                          disabled={updatingId === site.id || bulkUpdating}
                          className="px-2 py-0.5 rounded text-[10px] font-medium hover:opacity-80 disabled:opacity-50"
                          style={{ background: 'var(--accent)', color: 'white' }}
                        >
                          {updatingId === site.id ? 'Updating…' : `Update to v${latest}`}
                        </button>
                      )}
                    </div>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  {isEditing ? (
                    editForm.auth_mode === 'apppassword' ? (
                      <input
                        value={editForm.wp_password}
                        onChange={e => setEditForm({ ...editForm, wp_password: e.target.value })}
                        type="password"
                        placeholder="New password (leave blank to keep)"
                        className="px-2 py-1 rounded border text-xs w-40 outline-none"
                        style={inputStyle}
                      />
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Leave key blank to keep current</span>
                    )
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
                          onClick={() => deleteSite(site.id, site.name)}
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
    </div>
  );
}
