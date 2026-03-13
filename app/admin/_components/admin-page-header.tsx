import Link from "next/link";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type AdminPageHeaderProps = {
  eyebrow?: string;
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  details?: React.ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  breadcrumbs = [],
  title,
  description,
  primaryAction,
  secondaryActions,
  details,
}: AdminPageHeaderProps) {
  return (
    <header className="glass-panel admin-page-header">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-3">
            {breadcrumbs.length > 0 ? (
              <nav aria-label="Breadcrumb" className="admin-breadcrumbs">
                <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {breadcrumbs.map((item, index) => (
                    <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                      {index > 0 ? <span className="text-slate-300">/</span> : null}
                      {item.href ? (
                        <Link href={item.href} className="transition hover:text-blue-700">
                          {item.label}
                        </Link>
                      ) : (
                        <span className="text-slate-600">{item.label}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}

            <div>
              {eyebrow ? <p className="hero-kicker">{eyebrow}</p> : null}
              <h1 className="hero-title mt-2">{title}</h1>
              {description ? <p className="hero-copy">{description}</p> : null}
            </div>
          </div>

          {primaryAction || secondaryActions ? (
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {secondaryActions ? <div className="flex flex-wrap gap-2">{secondaryActions}</div> : null}
              {primaryAction ? <div className="flex">{primaryAction}</div> : null}
            </div>
          ) : null}
        </div>

        {details ? <dl className="admin-page-header-details">{details}</dl> : null}
      </div>
    </header>
  );
}
