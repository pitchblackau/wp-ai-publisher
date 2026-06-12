'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Site { id: string; name: string; url: string; status: string; }

const TONES = ['Professional', 'Conversational', 'Authoritative', 'Educational', 'Persuasive', 'Casual'];
const WORD_COUNTS = [500, 800, 1000, 1500, 2000, 3000];

export default function GenerateForm() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState({
    topic: '',
    site_ids: [] as string[],
    tone: 'Professional',
    word_count_target: 1000,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then(data => setSites(Array.isArray(data) ? data : []));
  }, []);

  function toggleSite(id: string) {
    setForm(f => ({
      ...f,
      site_ids: f.site_ids.includes(id) ? f.site_ids.filter(s => s !== id) : [...f.site_ids, id],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.site_ids.length) { setError('Select at least one target site'); return; }
    setLoading(true);
    setError('');
    const res = await fetch('/api/articles/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push('/queue'), 1500);
    } else {
      setError(data.error?.formErrors?.[0] ?? data.error ?? 'Generation failed');
    }
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Topic / Title idea</label>
          <textarea
            rows={3}
            placeholder="e.g. 10 best SEO strategies for local businesses in 2025"
            value={form.topic}
            onChange={e => setForm({ ...form, topic: e.target.value })}
            required
            className="w-full px-3 py-2.5 rounded-md text-sm border outline-none resize-none focus:ring-1"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Target sites</label>
          {sites.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No sites added yet — add sites in the Sites tab first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sites.map(site => {
                const selected = form.site_ids.includes(site.id);
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => toggleSite(site.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-all"
                    style={{
                      background: selected ? '#6366f120' : 'var(--surface)',
                      borderColor: selected ? 'var(--accent)' : 'var(--border)',
                      color: selected ? 'var(--accent-hover)' : 'var(--text-muted)',
                    }}
                  >
                    {site.name}
                    {site.status === 'active' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tone</label>
            <select
              value={form.tone}
              onChange={e => setForm({ ...form, tone: e.target.value })}
              className="px-3 py-2 rounded-md text-sm border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Target word count</label>
            <select
              value={form.word_count_target}
              onChange={e => setForm({ ...form, word_count_target: Number(e.target.value) })}
              className="px-3 py-2 rounded-md text-sm border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              {WORD_COUNTS.map(w => <option key={w} value={w}>{w.toLocaleString()} words</option>)}
            </select>
          </div>
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-md" style={{ background: '#ef444420', color: '#f87171' }}>
            {error}
          </p>
        )}

        {success ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: '#4ade80' }}>
            <CheckCircle size={16} />
            Article generated — redirecting to queue…
          </div>
        ) : (
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 w-fit"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Generating…' : 'Generate Article'}
          </button>
        )}

        {loading && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Claude is writing your article — this typically takes 15–30 seconds…
          </p>
        )}
      </form>
    </div>
  );
}
