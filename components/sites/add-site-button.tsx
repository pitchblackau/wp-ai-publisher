'use client';

import { useState } from 'react';
import { Plus, X, Check, AlertCircle, Loader2 } from 'lucide-react';

export default function AddSiteButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', wp_username: '', wp_password: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult({ ok: data.connection.ok, message: data.connection.message });
      window.dispatchEvent(new Event('sites-updated'));
      if (data.connection.ok) {
        setTimeout(() => { setOpen(false); setForm({ name: '', url: '', wp_username: '', wp_password: '' }); setResult(null); }, 1500);
      }
    } else {
      setResult({ ok: false, message: data.error?.formErrors?.[0] ?? data.error ?? 'Failed to add site' });
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--accent)', color: 'white' }}
      >
        <Plus size={13} />
        Add Site
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: '#000000cc' }}>
          <div
            className="w-full max-w-md rounded-xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Add WordPress Site</h2>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
              {[
                { key: 'name', label: 'Site Name', placeholder: 'My Blog', type: 'text' },
                { key: 'url', label: 'WordPress URL', placeholder: 'https://example.com', type: 'url' },
                { key: 'wp_username', label: 'WP Username', placeholder: 'admin', type: 'text' },
                { key: 'wp_password', label: 'Application Password', placeholder: 'xxxx xxxx xxxx xxxx', type: 'password' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-md text-sm border outline-none focus:ring-1"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: 'var(--border)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              ))}

              {result && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-md text-xs"
                  style={{
                    background: result.ok ? '#15803d20' : '#ef444420',
                    color: result.ok ? '#4ade80' : '#f87171',
                  }}
                >
                  {result.ok ? <Check size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                  {result.message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 mt-1"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Testing & saving…' : 'Add Site'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
