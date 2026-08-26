'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { PERIOD_OPTIONS, type PeriodType } from '@/lib/accounting/periods';

export function PeriodSelect({ value }: { value: PeriodType }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set('period', next);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-auto min-w-[9rem]"
      aria-label="Reporting period"
    >
      {PERIOD_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
