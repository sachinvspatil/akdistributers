export function PageHeader({ title, subtitle, actions, testid }) {
  return (
    <div data-testid={testid} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children }) {
  return <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1400px] mx-auto">{children}</div>;
}
