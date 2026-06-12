type BadgeVariant = 'success' | 'error' | 'warning' | 'neutral' | 'info';

const styles: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: '#15803d20', color: '#4ade80' },
  error: { bg: '#ef444420', color: '#f87171' },
  warning: { bg: '#f59e0b20', color: '#fbbf24' },
  neutral: { bg: '#27272a', color: '#a1a1aa' },
  info: { bg: '#6366f120', color: '#818cf8' },
};

export default function Badge({ label, variant = 'neutral' }: { label: string; variant?: BadgeVariant }) {
  const { bg, color } = styles[variant];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}
