'use client';

import { useState } from 'react';
import { Plus, X, Check, AlertCircle, Loader2 } from 'lucide-react';

type AuthMode = 'plugin' | 'apppassword';

export default function AddSiteButton() {
  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('plugin');
  const [form, setForm] = useState({
    name: '', url: '', login_url: '',
    plugin_key: '',
    wp_username: '', wp_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function reset() {
    setForm({ name: '', url: '', login_url: '', plugin_key: '', wp_username: '', wp_password: '' });
    setResult(null);
    setAuthMode('plugin');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const payload: Record<string, string> = {
      name: form.name,
      url: form.url,
      login_url: form.login_url,
    };
    if (authMode === 'plugin') {
      payload.plugin_key = form.plugin_key;
    } else {
      payload.wp_username = form.wp_username;
      payload.wp_password = form.wp_password;
    }
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult({ ok: data.connection.ok, message: data.connection.message });
      window.dispatchEvent(new Event('sites-updated'));
      setTimeout(() => { setOpen(false); reset(); }, 1800);
    } else {
      setResult({ ok: false, message: data.error?.formErrors?.[0] ?? data.error ?? 'Failed to add site' });
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-md text-sm border outline-none focus:ring-1';
  const inputStyle = { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' };

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
              <button onClick={() => { setOpen(false); reset(); }} style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
              {/* Basic fields */}
              {[
                { key: 'name', label: 'Site Name', placeholder: 'My Blog', type: 'text' },
                { key: 'url', label: 'WordPress URL', placeholder: 'https://example.com', type: 'url' },
                { key: 'login_url', label: 'Login URL (optional)', placeholder: '/wp-admin', type: 'text' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
                  <input
                    type={type} placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    required={key !== 'login_url'}
                    className={inputCls} style={inputStyle}
                  />
                </div>
              ))}

              {/* Auth mode toggle */}
              <div className="flex gap-2 mt-1">
                {(['plugin', 'apppassword'] as AuthMode[]).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAuthMode(mode)}
                    className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                    style={{
                      background: authMode === mode ? 'var(--accent)' : 'var(--surface-2)',
                      color: authMode === mode ? 'white' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {mode === 'plugin' ? 'PB Plugin Key' : 'Application Password'}
                  </button>
                ))}
              </div>

              {authMode === 'plugin' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Plugin Key</label>
                  <input
                    type="text" placeholder="Paste key from WP Admin → Settings → PB Publisher"
                    value={form.plugin_key}
                    onChange={e => setForm({ ...form, plugin_key: e.target.value })}
                    required
                    className={inputCls} style={inputStyle}
                  />
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    Install <strong>pb-publisher.zip</strong> on the site first, then copy the key from Settings → PB Publisher.
                  </p>
                </div>
              ) : (
                <>
                  {[
                    { key: 'wp_username', label: 'WP Username', placeholder: 'admin', type: 'text' },
                    { key: 'wp_password', label: 'Application Password', placeholder: 'xxxx xxxx xxxx xxxx', type: 'password' },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
                      <input
                        type={type} placeholder={placeholder}
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm({ ...form, [key]: e.target.value })}
                        required
                        className={inputCls} style={inputStyle}
                      />
                    </div>
                  ))}
                </>
              )}

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
