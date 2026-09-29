'use client';

import { useEffect, useState } from 'react';
import { Save, Send, Clock, Loader2, CheckCircle, AlertCircle, Eye, Code2, ExternalLink, RotateCcw, Trash2, Sparkles } from 'lucide-react';
import type { Article } from '@/types';
import Badge from '@/components/ui/badge';

interface Site { id: string; name: string; url: string; }
interface PublishJob { siteId: string; ok: boolean; postId?: number; postUrl?: string; error?: string; }

interface Props { id: string; }

export default function ArticleEditor({ id }: Props) {
  const [article, setArticle] = useState<Article | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [removingSite, setRemovingSite] = useState<string | null>(null);
  const [view, setView] = useState<'preview' | 'html'>('preview');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    Promise.all([
      fetch(`/api/articles/${id}`).then(r => (r.ok ? r.json() : Promise.reject(new Error(`Article fetch failed: ${r.status}`)))),
      fetch('/api/sites').then(r => r.json()).catch(() => []),
      fetch(`/api/articles/${id}/jobs`).then(r => (r.ok ? r.json() : [])).catch(() => []),
    ])
      .then(([art, s, j]) => {
        setArticle(art);
        setSites(Array.isArray(s) ? s : []);
        setJobs(Array.isArray(j) ? j : []);
      })
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load article'))
      .finally(() => setLoading(false));
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
    if (!article?.site_ids.length) {
      setNotice({ ok: false, message: 'Select at least one target site below before publishing' });
      setTimeout(() => setNotice(null), 4000);
      return;
    }
    setPublishing(true);
    const res = await fetch(`/api/articles/${id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: scheduled || null }),
    });
    const data = await res.json();
    setPublishing(false);
    if (res.ok) {
      setJobs(data.jobs ?? []);
      setNotice({ ok: data.anyOk, message: data.anyOk ? `Published to ${data.jobs.filter((j: PublishJob) => j.ok).length} of ${data.jobs.length} site(s)` : 'Publish failed on all sites — see details below' });
      const updated = await fetch(`/api/articles/${id}`).then(r => r.json());
      setArticle(updated);
    } else {
      setNotice({ ok: false, message: data.error ?? 'Publish failed' });
    }
    setTimeout(() => setNotice(null), 5000);
  }

  async function regenerate() {
    if (!confirm('Regenerate this article with Claude? The current title, content, and tags will be replaced (topic, tone and length stay the same).')) return;
    setRegenerating(true);
    const res = await fetch(`/api/articles/${id}/regenerate`, { method: 'POST' });
    const data = await res.json();
    setRegenerating(false);
    if (res.ok) {
      setArticle(data);
      setJobs([]);
      setNotice({ ok: true, message: 'Regenerated' });
      if (data.image_plan?.length) {
        fetch(`/api/articles/${id}/images`, { method: 'POST' }).then(() =>
          fetch(`/api/articles/${id}`).then(r => r.json()).then(setArticle)
        );
      }
    } else {
      setNotice({ ok: false, message: data.error ?? 'Regeneration failed' });
    }
    setTimeout(() => setNotice(null), 4000);
  }

  async function removeFromSite(siteId: string) {
    if (!confirm('Remove the live post from this site? The article stays published on any other sites.')) return;
    setRemovingSite(siteId);
    const res = await fetch(`/api/articles/${id}/publish`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: siteId }),
    });
    const data = await res.json();
    setRemovingSite(null);
    if (res.ok) {
      setJobs(jobs.filter(j => j.siteId !== siteId));
      const updated = await fetch(`/api/articles/${id}`).then(r => r.json());
      setArticle(updated);
      setNotice({ ok: true, message: 'Removed from site' });
    } else {
      setNotice({ ok: false, message: data.error ?? 'Failed to remove' });
    }
    setTimeout(() => setNotice(null), 4000);
  }

  async function deleteAndRedo() {
    if (!confirm('Remove the live post(s) from every site and move this article back to draft? This cannot be undone on the WordPress side.')) return;
    setPublishing(true);
    const res = await fetch(`/api/articles/${id}/publish`, { method: 'DELETE' });
    const data = await res.json();
    setPublishing(false);
    if (res.ok) {
      setJobs([]);
      const updated = await fetch(`/api/articles/${id}`).then(r => r.json());
      setArticle(updated);
      setNotice({ ok: true, message: 'Removed from all sites — back to draft' });
    } else {
      setNotice({ ok: false, message: data.error ?? 'Failed to remove' });
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
  if (loadError) return <div className="py-20 text-center text-sm" style={{ color: 'var(--error)' }}>{loadError}</div>;
  if (!article) return <div className="py-20 text-center text-sm" style={{ color: 'var(--error)' }}>Article not found</div>;

  const statusMap = { draft: 'neutral', scheduled: 'warning', published: 'success', discarded: 'error' } as const;
  const canPublish = article.status !== 'published' && article.status !== 'scheduled';

  return (
    <div className="max-w-4xl flex flex-col gap-5">
      {/* Header */}
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
          {article.status !== 'published' && article.status !== 'scheduled' && (
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              title="Re-run Claude on the same topic/tone/length"
            >
              {regenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Regenerate
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save draft
          </button>
          {(article.status === 'published' || article.status === 'scheduled') && (
            <button
              onClick={deleteAndRedo}
              disabled={publishing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: '#ef444420', color: '#f87171' }}
              title="Remove from every site and revert to draft"
            >
              {publishing ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Delete & Redo
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Title</label>
        <input
          value={article.title}
          onChange={e => setArticle({ ...article, title: e.target.value })}
          className="w-full px-3 py-2 rounded-md text-sm border outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      </div>

      {/* Body: Preview / HTML tabs */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Article content</label>
          <div className="flex gap-1 p-0.5 rounded-md" style={{ background: 'var(--surface-2)' }}>
            <button
              onClick={() => setView('preview')}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors"
              style={{ background: view === 'preview' ? 'var(--accent)' : 'transparent', color: view === 'preview' ? 'white' : 'var(--text-muted)' }}
            >
              <Eye size={11} /> Preview
            </button>
            <button
              onClick={() => setView('html')}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors"
              style={{ background: view === 'html' ? 'var(--accent)' : 'transparent', color: view === 'html' ? 'white' : 'var(--text-muted)' }}
            >
              <Code2 size={11} /> HTML
            </button>
          </div>
        </div>

        {view === 'preview' ? (
          <div
            className="wp-preview w-full px-6 py-5 rounded-md border overflow-auto"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', minHeight: 400, maxHeight: 600 }}
            dangerouslySetInnerHTML={{ __html: article.body || '<p style="opacity:.5">No content</p>' }}
          />
        ) : (
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
        )}
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Edit in the HTML tab, then switch back to Preview to see the change — Preview does not auto-save.
        </p>
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

      {/* Publish panel — the main call to action */}
      <div className="flex flex-col gap-4 p-5 rounded-lg border-2" style={{ background: 'var(--surface)', borderColor: 'var(--accent)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Publish</h3>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Target sites</label>
          {sites.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--error)' }}>No sites configured — add one in the Sites tab first.</p>
          ) : (
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
                      background: selected ? '#6366f120' : 'var(--surface-2)',
                      borderColor: selected ? 'var(--accent)' : 'var(--border)',
                      color: selected ? 'var(--accent-hover)' : 'var(--text-muted)',
                    }}
                  >
                    {site.name}
                  </button>
                );
              })}
            </div>
          )}
          {!article.site_ids.length && (
            <p className="text-xs" style={{ color: '#fbbf24' }}>Select at least one site to enable publishing.</p>
          )}
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <button
            onClick={() => publish()}
            disabled={publishing || !canPublish || !article.site_ids.length}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {publishing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {publishing ? 'Publishing…' : article.status === 'published' ? 'Published' : `Publish now to ${article.site_ids.length || 0} site(s)`}
          </button>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Or schedule for later</label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="px-2.5 py-1.5 rounded text-xs border outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              <button
                onClick={() => scheduledAt && publish(new Date(scheduledAt).toISOString())}
                disabled={!scheduledAt || publishing || !canPublish || !article.site_ids.length}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                <Clock size={12} />
                Schedule
              </button>
            </div>
          </div>
        </div>

        {jobs.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Last publish result</span>
            {jobs.map(j => {
              const site = sites.find(s => s.id === j.siteId);
              return (
                <div key={j.siteId} className="flex items-center gap-2 text-xs">
                  {j.ok ? <CheckCircle size={12} style={{ color: '#4ade80' }} /> : <AlertCircle size={12} style={{ color: '#f87171' }} />}
                  <span style={{ color: 'var(--text)' }}>{site?.name ?? j.siteId}</span>
                  {j.ok && j.postUrl ? (
                    <>
                      <a href={j.postUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: 'var(--accent-hover)' }}>
                        View post <ExternalLink size={10} />
                      </a>
                      <button
                        onClick={() => removeFromSite(j.siteId)}
                        disabled={removingSite === j.siteId}
                        className="flex items-center gap-1 hover:underline disabled:opacity-50"
                        style={{ color: '#f87171' }}
                      >
                        {removingSite === j.siteId ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                        Remove from this site
                      </button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-dim)' }}>{j.error}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
