import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PeriodSelect } from './period-select';
import type { PeriodType } from '@/lib/accounting/periods';

export function ReportHeader({
  title,
  rangeLabel,
  period,
  showPeriod = true,
  action,
}: {
  title: string;
  rangeLabel: string;
  period: PeriodType;
  showPeriod?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <Link
        href="/reports"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Reports
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {showPeriod && <PeriodSelect value={period} />}
          {action}
        </div>
      </div>
    </div>
  );
}
