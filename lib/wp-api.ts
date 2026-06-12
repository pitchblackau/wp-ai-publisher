export interface WPAuthConfig {
  url: string;
  username: string;
  password: string;
}

function authHeader(config: WPAuthConfig): string {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
}

function baseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

export async function testConnection(config: WPAuthConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${baseUrl(config.url)}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: authHeader(config) },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    const contentType = res.headers.get('content-type') ?? '';

    if (!contentType.includes('application/json')) {
      const finalUrl = res.url;
      const hint = finalUrl !== `${baseUrl(config.url)}/wp-json/wp/v2/users/me`
        ? ` (redirected to ${finalUrl} — check your URL uses https)`
        : ' — the REST API may be disabled or blocked by a security plugin';
      return { ok: false, message: `Site returned HTML instead of JSON${hint}` };
    }

    if (res.ok) {
      const data = await res.json();
      return { ok: true, message: `Connected as "${data.name}"` };
    }

    if (res.status === 401) {
      return { ok: false, message: 'Authentication failed — check username and Application Password' };
    }
    if (res.status === 403) {
      return { ok: false, message: 'Access denied — ensure the user has the Editor or Administrator role' };
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
}

export async function publishPost(
  config: WPAuthConfig,
  payload: WPPostPayload
): Promise<{ ok: boolean; postId?: number; postUrl?: string; error?: string }> {
  try {
    const res = await fetch(`${baseUrl(config.url)}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(config),
      },
      body: JSON.stringify(payload),
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
