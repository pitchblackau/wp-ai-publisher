'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import Badge from '@/components/ui/badge';

interface Site {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'error' | 'unchecked';
  last_checked_at: string | null;
  last_error: string | null;
}

export default function HealthTable() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/sites');
    const data = await res.json();
    setSites(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function recheck(id: string) {
    setRefreshing(id);
    await fetch(`/api/sites/${id}/test`, { method: 'POST' });
    await load();
    setRefreshing(null);
  }

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  if (sites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed" style={{ borderColor: 'var(--border)' }}>
        <Activity size={32} style={{ color: 'var(--text-dim)' }} className="mb-3" />
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>No sites to monitor</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Add sites in the Sites tab</p>
      </div>
    );
  }

  const online = sites.filter(s => s.status === 'active').length;
  const offline = sites.filter(s => s.status === 'error').length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Sites', value: sites.length, color: 'var(--text)' },
          { label: 'Online', value: online, color: 'var(--success)' },
          { label: 'Issues', value: offline, color: offline > 0 ? 'var(--error)' : 'var(--text-dim)' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="px-4 py-3 rounded-lg border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="text-2xl font-semibold" style={{ color }}>{value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid var(--border)` }}>
              {['Site', 'URL', 'Status', 'Last checked', 'Error', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map(site => (
              <tr key={site.id} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{site.name}</td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new URL(site.url).hostname}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    label={site.status === 'active' ? 'Online' : site.status === 'error' ? 'Offline' : 'Unknown'}
                    variant={site.status === 'active' ? 'success' : site.status === 'error' ? 'error' : 'neutral'}
                  />
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                  {site.last_checked_at ? new Date(site.last_checked_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--error)' }}>
                  {site.last_error ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => recheck(site.id)}
                    disabled={refreshing === site.id}
                    className="p-1.5 rounded transition-colors hover:opacity-80 disabled:opacity-40"
                    style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
                    title="Re-check now"
                  >
                    <RefreshCw size={13} className={refreshing === site.id ? 'animate-spin' : ''} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Auto health check runs daily at 03:00 UTC via Vercel Cron
      </p>
    </div>
  );
}
