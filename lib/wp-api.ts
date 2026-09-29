export interface WPAuthConfig {
  url: string;
  username: string;
  password: string;
}

export interface WPPluginConfig {
  url: string;
  pluginKey: string;
}

function authHeader(config: WPAuthConfig): string {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
}

function baseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

// ── Plugin-based auth (pb-publisher plugin) ───────────────────────────────────

export async function testConnectionPlugin(config: WPPluginConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${baseUrl(config.url)}/wp-json/pb-publisher/v1/status`, {
      headers: { 'X-PB-Key': config.pluginKey },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      return { ok: true, message: `Connected to "${data.site_name}"` };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Invalid plugin key — check the key under WP Admin → Settings → PB Publisher' };
    }
    if (res.status === 404) {
      return { ok: false, message: 'Plugin not found — make sure the Pitch Black Publisher plugin is installed and active' };
    }
    return { ok: false, message: `Plugin connection failed: ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Cannot reach site: ${msg}` };
  }
}

export async function publishPostPlugin(
  config: WPPluginConfig,
  payload: WPPostPayload
): Promise<{ ok: boolean; postId?: number; postUrl?: string; error?: string }> {
  return pluginPost(config, '/wp-json/pb-publisher/v1/posts', payload);
}

export async function updatePostPlugin(
  config: WPPluginConfig,
  postId: number,
  payload: Partial<WPPostPayload>
): Promise<{ ok: boolean; postId?: number; postUrl?: string; error?: string }> {
  return pluginPatch(config, `/wp-json/pb-publisher/v1/posts/${postId}`, payload);
}

export async function deletePostPlugin(
  config: WPPluginConfig,
  postId: number
): Promise<{ ok: boolean; error?: string }> {
  return pluginDelete(config, `/wp-json/pb-publisher/v1/posts/${postId}`);
}

export async function listPostsPlugin(
  config: WPPluginConfig,
  params?: { status?: string; per_page?: number; page?: number }
): Promise<{ ok: boolean; posts?: WPPostSummary[]; error?: string }> {
  try {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    const res = await pluginFetch(config, `/wp-json/pb-publisher/v1/posts${qs ? `?${qs}` : ''}`, 'GET');
    if (res.ok) return { ok: true, posts: await res.json() };
    return { ok: false, error: `${res.status}: ${await res.text()}` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function createPagePlugin(
  config: WPPluginConfig,
  payload: WPPostPayload & { parent_id?: number }
): Promise<{ ok: boolean; postId?: number; postUrl?: string; error?: string }> {
  return pluginPost(config, '/wp-json/pb-publisher/v1/pages', payload);
}

export async function updatePagePlugin(
  config: WPPluginConfig,
  pageId: number,
  payload: Partial<WPPostPayload> & { parent_id?: number }
): Promise<{ ok: boolean; postId?: number; postUrl?: string; error?: string }> {
  return pluginPatch(config, `/wp-json/pb-publisher/v1/pages/${pageId}`, payload);
}

export async function listPagesPlugin(
  config: WPPluginConfig,
  params?: { per_page?: number }
): Promise<{ ok: boolean; pages?: WPPostSummary[]; error?: string }> {
  try {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    const res = await pluginFetch(config, `/wp-json/pb-publisher/v1/pages${qs ? `?${qs}` : ''}`, 'GET');
    if (res.ok) return { ok: true, pages: await res.json() };
    return { ok: false, error: `${res.status}: ${await res.text()}` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function uploadMediaPlugin(
  config: WPPluginConfig,
  payload: {
    file_data: string;   // base64
    file_name: string;
    mime_type?: string;
    alt_text?: string;
    caption?: string;
    post_id?: number;
  }
): Promise<{ ok: boolean; attachmentId?: number; url?: string; error?: string }> {
  try {
    const res = await pluginFetch(config, '/wp-json/pb-publisher/v1/media', 'POST', payload);
    if (res.ok) {
      const data = await res.json();
      return { ok: true, attachmentId: data.attachment_id, url: data.url };
    }
    return { ok: false, error: `${res.status}: ${await res.text()}` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function listMediaPlugin(
  config: WPPluginConfig,
  params?: { per_page?: number; page?: number }
): Promise<{ ok: boolean; media?: WPMediaItem[]; error?: string }> {
  try {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    const res = await pluginFetch(config, `/wp-json/pb-publisher/v1/media${qs ? `?${qs}` : ''}`, 'GET');
    if (res.ok) return { ok: true, media: await res.json() };
    return { ok: false, error: `${res.status}: ${await res.text()}` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

// A non-2xx from a WP site is sometimes a real PHP fatal error rendered as an HTML
// page (a plugin/theme hook crashing), not a REST error — surface that plainly
// instead of dumping the raw HTML page into the error message.
async function summarizeWpError(res: Response): Promise<string> {
  const text = await res.text();
  const isHtml = (res.headers.get('content-type') ?? '').includes('html') || text.trim().startsWith('<');
  if (isHtml) {
    const looksFatal = /critical error|fatal error/i.test(text);
    return looksFatal
      ? `${res.status}: WordPress hit a fatal error processing this request (likely a plugin/theme conflict on that site) — check the site's PHP error log`
      : `${res.status}: Site returned an HTML page instead of a REST response — check the site is reachable and the REST API isn't being blocked`;
  }
  return `${res.status}: ${text.slice(0, 500)}`;
}

function pluginFetch(config: WPPluginConfig, path: string, method: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl(config.url)}${path}`, {
    method,
    headers: body
      ? { 'Content-Type': 'application/json', 'X-PB-Key': config.pluginKey }
      : { 'X-PB-Key': config.pluginKey },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
}

async function pluginPost(
  config: WPPluginConfig, path: string, body: unknown
): Promise<{ ok: boolean; postId?: number; postUrl?: string; error?: string }> {
  try {
    const res = await pluginFetch(config, path, 'POST', body);
    if (res.ok) { const d = await res.json(); return { ok: true, postId: d.post_id, postUrl: d.url }; }
    return { ok: false, error: await summarizeWpError(res) };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

async function pluginPatch(
  config: WPPluginConfig, path: string, body: unknown
): Promise<{ ok: boolean; postId?: number; postUrl?: string; error?: string }> {
  try {
    const res = await pluginFetch(config, path, 'PATCH', body);
    if (res.ok) { const d = await res.json(); return { ok: true, postId: d.post_id, postUrl: d.url }; }
    return { ok: false, error: await summarizeWpError(res) };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

async function pluginDelete(
  config: WPPluginConfig, path: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await pluginFetch(config, path, 'DELETE');
    if (res.ok) return { ok: true };
    return { ok: false, error: await summarizeWpError(res) };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export interface WPPostSummary {
  id: number;
  title: string;
  status: string;
  url: string;
  date: string;
  modified: string;
  excerpt: string;
  thumbnail: string | null;
}

export interface WPMediaItem {
  id: number;
  url: string;
  filename: string;
  mime: string;
  alt: string;
  caption: string;
  date: string;
}

// ── Application Password auth (fallback for sites without plugin) ─────────────

async function tryAuth(url: string, config: WPAuthConfig): Promise<Response> {
  // Note: there used to be a fallback here that put credentials in the URL
  // (https://user:pass@host/...) for hosts that strip the Authorization header.
  // Node's fetch (undici) refuses to construct a request from such a URL at all
  // ("Request cannot be constructed from a URL that includes credentials"),
  // so it never worked — it just replaced a clean 401 with a confusing crash.
  return fetch(url, {
    headers: { Authorization: authHeader(config) },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  });
}

export async function testConnection(config: WPAuthConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const endpoint = `${baseUrl(config.url)}/wp-json/wp/v2/users/me`;
    const res = await tryAuth(endpoint, config);

    const contentType = res.headers.get('content-type') ?? '';

    if (!contentType.includes('application/json')) {
      const finalUrl = res.url;
      const hint = !finalUrl.includes('/wp-json/')
        ? ` (redirected to ${finalUrl} — check the site URL is correct and uses https)`
        : ' — the REST API may be disabled or blocked by a security plugin';
      return { ok: false, message: `Site returned HTML instead of JSON${hint}` };
    }

    if (res.ok) {
      const data = await res.json();
      return { ok: true, message: `Connected as "${data.name}"` };
    }

    if (res.status === 401) {
      let code = '';
      let wpMessage = '';
      try { const j = await res.json(); code = j.code ?? ''; wpMessage = j.message ?? ''; } catch { /* ignore */ }
      if (code === 'application_passwords_disabled' || code === 'application_passwords_disabled_for_user') {
        return { ok: false, message: 'Application Passwords are disabled — install the PB Publisher plugin instead' };
      }
      if (code === 'rest_not_logged_in') {
        return { ok: false, message: 'Application Passwords not available on this site — install the PB Publisher plugin instead' };
      }
      if (code === 'rest_invalid_credentials' || code === 'invalid_username' || code === 'incorrect_password') {
        return { ok: false, message: 'Wrong username or Application Password — generate one under WP Admin → Users → Profile → Application Passwords' };
      }
      const detail = wpMessage || code || '401';
      return { ok: false, message: `Authentication failed: ${detail}` };
    }
    if (res.status === 403) {
      return { ok: false, message: 'Access denied — ensure the user has Editor or Administrator role' };
    }
    if (res.status === 404) {
      return { ok: false, message: 'REST API not found — confirm the site URL is correct and permalinks are enabled' };
    }

    return { ok: false, message: `Auth failed: ${res.status} ${res.statusText}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      return { ok: false, message: `Cannot reach site — check the URL is correct and the site is online` };
    }
    return { ok: false, message: `Connection error: ${msg}` };
  }
}

export interface WPPostPayload {
  title: string;
  content: string;
  status: 'publish' | 'future' | 'draft';
  date?: string;
  meta?: Record<string, string>;
  meta_description?: string;
  tags?: string[];
  category?: string;
  featured_image_id?: number;
}

export async function publishPost(
  config: WPAuthConfig,
  payload: WPPostPayload
): Promise<{ ok: boolean; postId?: number; postUrl?: string; error?: string }> {
  try {
    const body = JSON.stringify(payload);
    const res = await fetch(`${baseUrl(config.url)}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader(config) },
      body,
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, postId: data.id, postUrl: data.link };
    }
    const errText = await res.text();
    return { ok: false, error: `${res.status}: ${errText}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deletePost(
  config: WPAuthConfig,
  postId: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Trash, not force-delete — a hard delete triggers more cleanup hooks and is
    // more likely to hit a broken plugin/theme hook (a real PHP fatal error on
    // the site itself, not something this app can catch or retry around).
    const res = await fetch(`${baseUrl(config.url)}/wp-json/wp/v2/posts/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader(config) },
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: await summarizeWpError(res) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function checkHealth(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${baseUrl(url)}/wp-json/wp/v2`, {
      signal: AbortSignal.timeout(10000),
    });
    return { ok: res.ok, message: res.ok ? 'Online' : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Unreachable' };
  }
}
