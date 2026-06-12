'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    const TEAL = '0,255,249';
    const NODE_COUNT = 72;
    const CONNECT_DIST = 160;
    const TRI_DIST = 130;

    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    let nodes: Node[] = [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        r: Math.random() * 2.2 + 0.8,
      }));
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const W = canvas!.width, H = canvas!.height;
      ctx!.clearRect(0, 0, W, H);

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }

      const edges: [number, number, number][] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT_DIST) edges.push([i, j, d]);
        }
      }

      const adj = new Set<string>();
      for (const [i, j, d] of edges) if (d < TRI_DIST) adj.add(`${i}-${j}`);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (!adj.has(`${i}-${j}`)) continue;
          for (let k = j + 1; k < nodes.length; k++) {
            if (!adj.has(`${i}-${k}`) || !adj.has(`${j}-${k}`)) continue;
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.lineTo(nodes[k].x, nodes[k].y);
            ctx!.closePath();
            ctx!.fillStyle = `rgba(${TEAL},0.04)`;
            ctx!.fill();
            ctx!.strokeStyle = `rgba(${TEAL},0.08)`;
            ctx!.lineWidth = 0.4;
            ctx!.stroke();
          }
        }
      }

      for (const [i, j, d] of edges) {
        ctx!.beginPath();
        ctx!.strokeStyle = `rgba(${TEAL},${0.22 * (1 - d / CONNECT_DIST)})`;
        ctx!.lineWidth = 0.7;
        ctx!.moveTo(nodes[i].x, nodes[i].y);
        ctx!.lineTo(nodes[j].x, nodes[j].y);
        ctx!.stroke();
      }

      for (const n of nodes) {
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${TEAL},0.55)`;
        ctx!.fill();
        if (n.r > 2.2) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, n.r + 3, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${TEAL},0.12)`;
          ctx!.lineWidth = 1.5;
          ctx!.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) { setError('Invalid username or password.'); setLoading(false); return; }
      router.push('/sites');
      router.refresh();
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  }

  const disabled = loading || !password || !username;

  return (
    <>
      <style>{`
        @keyframes pb-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pb-login-card { animation: pb-fade-up 0.7s ease both; }
        .pb-input:focus { border-color: #00fff9 !important; box-shadow: 0 0 0 3px rgba(0,255,249,0.1); }
        .pb-btn:not(:disabled):hover { background: #33fffc !important; box-shadow: 0 0 24px rgba(0,255,249,0.35); transform: translateY(-1px); }
        .pb-btn { transition: all 0.2s ease; }
      `}</style>

      <div style={{
        position: 'relative', minHeight: '100vh', background: '#020303',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-geist-sans, Inter, sans-serif)', overflow: 'hidden',
      }}>
        <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

        <div className="pb-login-card" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, padding: '0 24px' }}>

          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(0,255,249,0.06)', border: '1.5px solid rgba(0,255,249,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(0,255,249,0.1)',
              }}>
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <circle cx="13" cy="13" r="5" fill="#00fff9" opacity="0.9"/>
                  <circle cx="13" cy="13" r="10" stroke="#00fff9" strokeWidth="1.2" opacity="0.4"/>
                  <line x1="13" y1="3" x2="13" y2="0" stroke="#00fff9" strokeWidth="1.5" opacity="0.6"/>
                  <line x1="13" y1="23" x2="13" y2="26" stroke="#00fff9" strokeWidth="1.5" opacity="0.6"/>
                  <line x1="3" y1="13" x2="0" y2="13" stroke="#00fff9" strokeWidth="1.5" opacity="0.6"/>
                  <line x1="23" y1="13" x2="26" y2="13" stroke="#00fff9" strokeWidth="1.5" opacity="0.6"/>
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                  Pitch Black
                </div>
                <div style={{ color: '#00fff9', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2, opacity: 0.85 }}>
                  WP AI Publisher
                </div>
              </div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0, letterSpacing: '0.02em' }}>
              Sign in to your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{
            background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(0,255,249,0.12)',
            borderRadius: 20, padding: '36px 32px', backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                Username
              </label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Your username" autoFocus autoComplete="username"
                className="pb-input"
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(0,255,249,0.15)', borderRadius: 12, padding: '14px 18px', color: '#fff', fontSize: 15, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••" autoComplete="current-password"
                className="pb-input"
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.35)', border: `1px solid ${error ? 'rgba(255,77,106,0.5)' : 'rgba(0,255,249,0.15)'}`, borderRadius: 12, padding: '14px 18px', color: '#fff', fontSize: 15, outline: 'none', letterSpacing: '0.12em', transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit' }}
              />
              {error && <p style={{ color: 'rgba(255,77,106,0.9)', fontSize: 12, margin: '10px 0 0', letterSpacing: '0.01em' }}>{error}</p>}
            </div>

            <button
              type="submit" disabled={disabled} className="pb-btn"
              style={{ width: '100%', background: disabled ? 'rgba(0,255,249,0.08)' : '#00fff9', color: disabled ? 'rgba(0,255,249,0.3)' : '#000', border: disabled ? '1px solid rgba(0,255,249,0.15)' : '1px solid #00fff9', borderRadius: 12, padding: '15px', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {loading ? 'Authenticating…' : 'Access Dashboard'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 10, marginTop: 28, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Pitch Black © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </>
  );
}
