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
  try {
    const res = await fetch(`${baseUrl(config.url)}/wp-json/pb-publisher/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-PB-Key': config.pluginKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, postId: data.post_id, postUrl: data.url };
    }
    const errText = await res.text();
    return { ok: false, error: `${res.status}: ${errText}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Application Password auth (fallback for sites without plugin) ─────────────

async function tryAuth(url: string, config: WPAuthConfig): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: authHeader(config) },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  });
  if (res.status !== 401) return res;

  // Fallback: credentials in URL for hosts that strip Authorization header
  const parsed = new URL(url);
  parsed.username = encodeURIComponent(config.username);
  parsed.password = encodeURIComponent(config.password);
  return fetch(parsed.toString(), {
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
}

export async function publishPost(
  config: WPAuthConfig,
  payload: WPPostPayload
): Promise<{ ok: boolean; postId?: number; postUrl?: string; error?: string }> {
  try {
    const body = JSON.stringify(payload);
    let res = await fetch(`${baseUrl(config.url)}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader(config) },
      body,
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 401) {
      const parsed = new URL(`${baseUrl(config.url)}/wp-json/wp/v2/posts`);
      parsed.username = encodeURIComponent(config.username);
      parsed.password = encodeURIComponent(config.password);
      res = await fetch(parsed.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(30000),
      });
    }
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
