'use client';

import { useEffect, useState, useCallback } from 'react';
import { Globe, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
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
      <div
        className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed"
        style={{ borderColor: 'var(--border)' }}
      >
        <Globe size={32} style={{ color: 'var(--text-dim)' }} className="mb-3" />
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>No sites yet</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Add your first WordPress site to get started
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: `1px solid var(--border)` }}>
            {['Name', 'URL', 'Username', 'Status', 'Last checked', ''].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr
              key={site.id}
              className="border-b last:border-0 transition-colors"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>
                {site.name}
              </td>
              <td className="px-4 py-3">
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {new URL(site.url).hostname}
                  <ExternalLink size={10} />
                </a>
              </td>
              <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                {site.wp_username}
              </td>
              <td className="px-4 py-3">
                {statusBadge(site.status)}
                {site.last_error && site.status === 'error' && (
                  <p className="text-xs mt-1 max-w-xs truncate" style={{ color: 'var(--error)' }}>
                    {site.last_error}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                {site.last_checked_at
                  ? new Date(site.last_checked_at).toLocaleString()
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 justify-end">
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
                    title="Delete site"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
