/* ---------- Item ---------- */
function Item({
  href,
  label,
  sub,
  icon,
  active,
  disabled,
  collapsed,
}: {
  href: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  collapsed: boolean;
}) {
  const body = (
    <div
      className={cn(
        'group rounded-xl flex items-center transition-colors duration-200',
        'px-3 py-2.5',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'hover:translate-x-[1px]'
      )}
      style={{
        border: `1px solid ${
          active ? 'rgba(0,255,194,0.28)' : 'rgba(255,255,255,0.06)'
        }`,
        background: active
          ? 'rgba(0,255,194,0.06)'
          : 'rgba(15,18,20,0.55)',
        boxShadow: active
          ? '0 0 12px rgba(0,255,194,0.16) inset, 0 0 8px rgba(0,255,194,0.04)'
          : 'inset 0 0 10px rgba(0,0,0,0.28)',
      }}
      title={collapsed ? label : undefined}
    >
      {/* Icon */}
      <div
        className={cn(
          'shrink-0 flex items-center justify-center text-white/90',
          collapsed ? 'w-full' : 'w-5 h-5'
        )}
        style={collapsed ? { minWidth: 40, minHeight: 40 } : {}}
      >
        {icon}
      </div>

      {/* Text + Sub */}
      <div
        className={cn(
          'overflow-hidden ml-3 transition-all duration-500 ease-in-out',
          collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'
        )}
      >
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-white/95">
            {label}
          </div>
          {sub && (
            <div className="text-[11px] text-white/55 mt-[3px] group-hover:text-white/70">
              {sub}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (disabled) return <div>{body}</div>;
  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}
