import { decrypt } from '@/lib/crypto';
import { listPostsPlugin } from '@/lib/wp-api';

export interface LinkCandidate { title: string; url: string; excerpt: string; }

interface SiteRow { url: string; plugin_key_encrypted: string | null; }

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchLinkCandidates(site: SiteRow): Promise<LinkCandidate[]> {
  const base = site.url.replace(/\/$/, '');

  if (site.plugin_key_encrypted) {
    try {
      const res = await listPostsPlugin(
        { url: site.url, pluginKey: decrypt(site.plugin_key_encrypted) },
        { status: 'publish', per_page: 100 }
      );
      if (res.ok && res.posts) {
        return res.posts.map(p => ({ title: p.title, url: p.url, excerpt: stripHtml(p.excerpt || '') }));
      }
    } catch { /* fall through to public REST */ }
  }

  try {
    const res = await fetch(`${base}/wp-json/wp/v2/posts?per_page=100&_fields=title,link,excerpt`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return [];
    const posts = await res.json() as { title: { rendered: string }; link: string; excerpt: { rendered: string } }[];
    return posts.map(p => ({
      title: stripHtml(p.title.rendered),
      url: p.link,
      excerpt: stripHtml(p.excerpt?.rendered ?? ''),
    }));
  } catch {
    return [];
  }
}

// Unwrap same-domain anchors that point at URLs Claude was not given, so no invented internal links get published.
export function sanitizeInternalLinks(html: string, siteUrl: string, allowed: LinkCandidate[]): string {
  let host: string;
  try { host = new URL(siteUrl).hostname.replace(/^www\./, ''); } catch { return html; }
  const allowedSet = new Set(allowed.map(c => c.url.replace(/\/$/, '')));

  return html.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (full, href: string, inner: string) => {
    let u: URL;
    try { u = new URL(href, siteUrl); } catch { return full; }
    if (u.hostname.replace(/^www\./, '') !== host) return full;
    return allowedSet.has(u.toString().replace(/\/$/, '')) ? full : inner;
  });
}
