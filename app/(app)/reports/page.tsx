import Link from 'next/link';
import {
  Scale,
  BookOpen,
  TrendingUp,
  Wallet,
  PiggyBank,
  FileText,
  LineChart,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Reports' };

type ReportCard = {
  href: string;
  icon: typeof Scale;
  title: string;
  body: string;
  ready: boolean;
  growth?: boolean;
};

const REPORTS: ReportCard[] = [
  {
    href: '/reports/trial-balance',
    icon: Scale,
    title: 'Trial Balance',
    body: 'Every account with its debit or credit balance.',
    ready: true,
  },
  {
    href: '/reports/general-ledger',
    icon: BookOpen,
    title: 'General Ledger',
    body: 'Every posting, grouped by account.',
    ready: true,
  },
  {
    href: '/reports/profit-and-loss',
    icon: TrendingUp,
    title: 'Profit & Loss',
    body: 'Revenue, costs and what you actually made.',
    ready: true,
  },
  {
    href: '/reports/balance-sheet',
    icon: Wallet,
    title: 'Balance Sheet',
    body: 'What you own and what you owe.',
    ready: true,
  },
  {
    href: '/reports/cash-flow',
    icon: PiggyBank,
    title: 'Cash Flow',
    body: 'Where your cash came from and went.',
    ready: true,
  },
  {
    href: '/reports/management-account',
    icon: FileText,
    title: 'Management Account',
    body: 'A full monthly report, board-ready.',
    ready: true,
  },
  {
    href: '/reports/forecast',
    icon: LineChart,
    title: '12-Month Forecast',
    body: 'Project revenue, expenses and profit ahead.',
    ready: true,
    growth: true,
  },
];

export default function ReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Every report is built from the same ledger, so your numbers always agree.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => {
          const inner = (
            <Card
              className={
                r.ready ? 'transition-colors hover:border-primary/40' : 'opacity-60'
              }
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <r.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{r.title}</h3>
                    {!r.ready && <Badge variant="secondary">Soon</Badge>}
                    {r.growth && (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="size-3" /> Growth
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.body}</p>
                </div>
                {r.ready && (
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                )}
              </CardContent>
            </Card>
          );
          return r.ready ? (
            <Link key={r.href} href={r.href}>
              {inner}
            </Link>
          ) : (
            <div key={r.href}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
