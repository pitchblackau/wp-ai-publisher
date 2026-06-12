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
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, message: `Connected as "${data.name}"` };
    }
    return { ok: false, message: `Auth failed: ${res.status} ${res.statusText}` };
  } catch (e) {
    return { ok: false, message: `Connection error: ${e instanceof Error ? e.message : String(e)}` };
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
