'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Site { id: string; name: string; url: string; status: string; }

const TONES = ['Professional', 'Conversational', 'Authoritative', 'Educational', 'Persuasive', 'Casual'];
const WORD_COUNTS = [500, 800, 1000, 1500, 2000, 3000];
const IMAGE_COUNTS = [0, 1, 2, 3, 4, 5, 6];
const IMAGE_STYLES = ['Photographic', 'Illustration', 'Flat vector', '3D render', 'Minimal / abstract'];
const MAX_LINKS = [1, 2, 3, 4, 5, 6, 8];

export default function GenerateForm() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState({
    topic: '',
    site_ids: [] as string[],
    tone: 'Professional',
    word_count_target: 1000,
    image_count: 3,
    image_style: 'Photographic',
    crosslink_enabled: true,
    crosslink_site_id: '',
    crosslink_max: 3,
  });
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'article' | 'images'>('article');
  const [warning, setWarning] = useState('');
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

  const selectedSites = sites.filter(s => form.site_ids.includes(s.id));
  const linkSiteId = selectedSites.some(s => s.id === form.crosslink_site_id) ? form.crosslink_site_id : (selectedSites[0]?.id ?? '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.site_ids.length) { setError('Select at least one target site'); return; }
    setLoading(true);
    setError('');
    setWarning('');
    setPhase('article');
    const res = await fetch('/api/articles/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: form.topic,
        site_ids: form.site_ids,
        tone: form.tone,
        word_count_target: form.word_count_target,
        image_count: form.image_count,
        image_style: form.image_style.toLowerCase(),
        crosslink_site_id: form.crosslink_enabled && linkSiteId ? linkSiteId : null,
        crosslink_max: form.crosslink_enabled ? form.crosslink_max : 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error?.formErrors?.[0] ?? data.error ?? 'Generation failed');
      return;
    }

    let delay = 1500;
    if (form.image_count > 0 && data.image_plan?.length) {
      setPhase('images');
      const imgRes = await fetch(`/api/articles/${data.id}/images`, { method: 'POST' });
      const imgData = await imgRes.json().catch(() => ({}));
      if (!imgRes.ok) {
        setWarning(`Article saved, but images were skipped: ${imgData.error ?? 'image generation failed'}`);
        delay = 5000;
      } else if (imgData.failed > 0) {
        setWarning(`Article saved. ${imgData.failed} of ${imgData.generated + imgData.failed} images failed and were left out.`);
        delay = 5000;
      }
    }
    setLoading(false);
    setSuccess(true);
    setTimeout(() => router.push('/queue'), delay);
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

        <fieldset className="flex flex-col gap-3 p-4 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <legend className="px-1.5 text-xs font-semibold" style={{ color: 'var(--text)' }}>Images</legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Number of images</label>
              <select
                value={form.image_count}
                onChange={e => setForm({ ...form, image_count: Number(e.target.value) })}
                className="px-3 py-2 rounded-md text-sm border outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                {IMAGE_COUNTS.map(n => <option key={n} value={n}>{n === 0 ? 'None' : n}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Style</label>
              <select
                value={form.image_style}
                onChange={e => setForm({ ...form, image_style: e.target.value })}
                disabled={form.image_count === 0}
                className="px-3 py-2 rounded-md text-sm border outline-none disabled:opacity-40"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                {IMAGE_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {form.image_count === 0
              ? 'No images will be generated.'
              : `Image 1 becomes the featured image (larger); the other ${Math.max(form.image_count - 1, 0)} are placed inside the article. Images are uploaded to each site's media library on publish.`}
          </p>
        </fieldset>

        <fieldset className="flex flex-col gap-3 p-4 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <legend className="px-1.5 text-xs font-semibold" style={{ color: 'var(--text)' }}>Internal linking</legend>
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={form.crosslink_enabled}
              onChange={e => setForm({ ...form, crosslink_enabled: e.target.checked })}
            />
            Link to other blog posts on the website
          </label>
          {form.crosslink_enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Link to posts from</label>
                  <select
                    value={linkSiteId}
                    onChange={e => setForm({ ...form, crosslink_site_id: e.target.value })}
                    disabled={selectedSites.length === 0}
                    className="px-3 py-2 rounded-md text-sm border outline-none disabled:opacity-40"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    {selectedSites.length === 0 && <option value="">Select a target site first</option>}
                    {selectedSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Maximum links</label>
                  <select
                    value={form.crosslink_max}
                    onChange={e => setForm({ ...form, crosslink_max: Number(e.target.value) })}
                    className="px-3 py-2 rounded-md text-sm border outline-none"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    {MAX_LINKS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                Claude reads that site&apos;s latest 100 published posts and links only where a post is genuinely relevant.
                {selectedSites.length > 1 && ' The same article (with these links) is published to every selected site, so links to one site will appear on the others too.'}
              </p>
            </>
          )}
        </fieldset>

        {error && (
          <p className="text-xs px-3 py-2 rounded-md" style={{ background: '#ef444420', color: '#f87171' }}>
            {error}
          </p>
        )}

        {success ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#4ade80' }}>
              <CheckCircle size={16} />
              Article generated — redirecting to queue…
            </div>
            {warning && <p className="text-xs" style={{ color: '#fbbf24' }}>{warning}</p>}
          </div>
        ) : (
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 w-fit"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? (phase === 'images' ? 'Generating images…' : 'Generating…') : 'Generate Article'}
          </button>
        )}

        {loading && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {phase === 'images'
              ? 'Article written — now generating images, this can take up to a minute…'
              : 'Claude is writing your article — this typically takes 15–30 seconds…'}
          </p>
        )}
      </form>
    </div>
  );
}
