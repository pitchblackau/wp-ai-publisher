interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-6 h-14 border-b shrink-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <div>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </h1>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
