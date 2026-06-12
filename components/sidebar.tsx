'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, Sparkles, List, Activity, Zap } from 'lucide-react';

const nav = [
  { href: '/sites', label: 'Sites', icon: Globe },
  { href: '/generate', label: 'Generate', icon: Sparkles },
  { href: '/queue', label: 'Review Queue', icon: List },
  { href: '/health', label: 'Health', icon: Activity },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col w-[220px] shrink-0 border-r h-full"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2 px-5 h-14 border-b" style={{ borderColor: 'var(--border)' }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent)' }}
        >
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          WP Publisher
        </span>
      </div>

      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors"
              style={{
                background: active ? 'var(--surface-2)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-4 text-xs" style={{ color: 'var(--text-dim)' }}>
        v1.0.0
      </div>
    </aside>
  );
}
