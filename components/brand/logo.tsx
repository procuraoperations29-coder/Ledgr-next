import { cn } from '@/lib/utils';

/**
 * Ledgr logo mark — a rounded badge with three ascending "ledger" bars and a
 * baseline (know your numbers → growth). The badge fill is `currentColor`, so
 * wrapping it in `text-primary` (or an org's custom brand colour) tints it.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Ledgr"
      className={cn('text-primary', className)}
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <g fill="#ffffff">
        <rect x="7.5" y="17" width="4" height="7" rx="2" opacity="0.7" />
        <rect x="14" y="12.5" width="4" height="11.5" rx="2" opacity="0.88" />
        <rect x="20.5" y="8" width="4" height="16" rx="2" />
      </g>
      <rect x="6" y="25" width="20" height="2" rx="1" fill="#ffffff" opacity="0.55" />
    </svg>
  );
}

/**
 * Full logo: mark + "Ledgr" wordmark. `markClassName` controls the mark size.
 */
export function Logo({
  className,
  markClassName,
  wordmark = true,
}: {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={cn('size-8', markClassName)} />
      {wordmark && (
        <span className="font-semibold tracking-tight">Ledgr</span>
      )}
    </span>
  );
}
