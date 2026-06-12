'use client';

import { useEffect, useState } from 'react';
import { Save, Send, Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { Article } from '@/types';
import Badge from '@/components/ui/badge';

interface Site { id: string; name: string; url: string; }

interface Props { id: string; }

export default function ArticleEditor({ id }: Props) {
  const [article, setArticle] = useState<Article | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/articles/${id}`).then(r => r.json()),
      fetch('/api/sites').then(r => r.json()),
    ]).then(([art, s]) => {
      setArticle(art);
      setSites(Array.isArray(s) ? s : []);
      setLoading(false);
    });
  }, [id]);

  async function save() {
    if (!article) return;
    setSaving(true);
    const res = await fetch(`/api/articles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: article.title,
        body: article.body,
        meta_description: article.meta_description,
        tags: article.tags,
        category: article.category,
        site_ids: article.site_ids,
      }),
    });
    setSaving(false);
    setNotice({ ok: res.ok, message: res.ok ? 'Saved' : 'Save failed' });
    setTimeout(() => setNotice(null), 2000);
  }

  async function publish(scheduled?: string) {
    setPublishing(true);
    const res = await fetch(`/api/articles/${id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: scheduled || null }),
    });
    const data = await res.json();
    setPublishing(false);
    if (res.ok) {
      setNotice({ ok: data.anyOk, message: data.anyOk ? `Published to ${data.jobs.filter((j: { ok: boolean }) => j.ok).length} site(s)` : 'Publish failed on all sites' });
      const updated = await fetch(`/api/articles/${id}`).then(r => r.json());
      setArticle(updated);
    } else {
      setNotice({ ok: false, message: data.error ?? 'Publish failed' });
    }
    setTimeout(() => setNotice(null), 4000);
  }

  function toggleSite(siteId: string) {
    if (!article) return;
    const ids = article.site_ids.includes(siteId)
      ? article.site_ids.filter(s => s !== siteId)
      : [...article.site_ids, siteId];
    setArticle({ ...article, site_ids: ids });
  }

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  if (!article) return <div className="py-20 text-center text-sm" style={{ color: 'var(--error)' }}>Article not found</div>;

  const statusMap = { draft: 'neutral', scheduled: 'warning', published: 'success', discarded: 'error' } as const;

  return (
    <div className="max-w-4xl flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge
            label={article.status.charAt(0).toUpperCase() + article.status.slice(1)}
            variant={statusMap[article.status]}
          />
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            Topic: {article.topic}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {notice && (
            <span className="flex items-center gap-1 text-xs" style={{ color: notice.ok ? '#4ade80' : '#f87171' }}>
              {notice.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
              {notice.message}
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
          <button
            onClick={() => publish()}
            disabled={publishing || article.status === 'published'}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50 font-medium"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {publishing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Publish Now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Schedule (optional)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="px-2.5 py-1.5 rounded text-xs border outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => scheduledAt && publish(new Date(scheduledAt).toISOString())}
            disabled={!scheduledAt || publishing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            <Clock size={12} />
            Schedule
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Title</label>
        <input
          value={article.title}
          onChange={e => setArticle({ ...article, title: e.target.value })}
          className="w-full px-3 py-2 rounded-md text-sm border outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Meta description <span style={{ color: 'var(--text-dim)' }}>({article.meta_description.length}/160)</span></label>
        <textarea
          rows={2}
          value={article.meta_description}
          onChange={e => setArticle({ ...article, meta_description: e.target.value })}
          maxLength={160}
          className="w-full px-3 py-2 rounded-md text-sm border outline-none resize-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Category</label>
          <input
            value={article.category}
            onChange={e => setArticle({ ...article, category: e.target.value })}
            className="px-3 py-2 rounded-md text-sm border outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tags (comma-separated)</label>
          <input
            value={article.tags.join(', ')}
            onChange={e => setArticle({ ...article, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
            className="px-3 py-2 rounded-md text-sm border outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Target sites</label>
        <div className="flex flex-wrap gap-2">
          {sites.map(site => {
            const selected = article.site_ids.includes(site.id);
            return (
              <button
                key={site.id}
                type="button"
                onClick={() => toggleSite(site.id)}
                className="text-xs px-3 py-1.5 rounded-md border transition-all"
                style={{
                  background: selected ? '#6366f120' : 'var(--surface)',
                  borderColor: selected ? 'var(--accent)' : 'var(--border)',
                  color: selected ? 'var(--accent-hover)' : 'var(--text-muted)',
                }}
              >
                {site.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Article body (HTML)</label>
        <textarea
          rows={20}
          value={article.body}
          onChange={e => setArticle({ ...article, body: e.target.value })}
          className="w-full px-3 py-2 rounded-md text-sm border outline-none resize-y font-mono"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            fontFamily: 'var(--font-geist-mono)',
            fontSize: '12px',
            lineHeight: '1.6',
          }}
        />
      </div>
    </div>
  );
}
