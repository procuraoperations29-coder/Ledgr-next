import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  FileText,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/logo';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
      <LogoMark className="size-8" />
      Ledgr
    </span>
  );
}

const REPORTS = [
  { icon: BarChart3, title: 'Profit & Loss', body: 'See exactly how much you made — and where it went.' },
  { icon: Wallet, title: 'Balance Sheet', body: 'What you own, what you owe, at any point in time.' },
  { icon: PiggyBank, title: 'Cash Flow', body: 'Follow the money in and out, week by week.' },
  { icon: FileText, title: 'Management Accounts', body: 'A boardroom-ready report, generated every month.' },
];

const STEPS = [
  { n: '1', title: 'Add your cash & bank balances', body: 'Tell Ledgr where your money sits today.' },
  { n: '2', title: 'Record your transactions', body: 'Money in, money out — in plain language. No accounting jargon.' },
  { n: '3', title: 'Get your numbers', body: 'Ledgr builds your accounts and reports automatically.' },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Start free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--accent))_0%,transparent_70%)]" />
        <div className="container flex flex-col items-center py-20 text-center md:py-28">
          <Badge variant="success" className="mb-5 gap-1">
            <Sparkles className="size-3.5" /> Financial operating system for small business
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Know your numbers.{' '}
            <span className="text-primary">Run your business.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Record your transactions, track your money and automatically generate
            professional management accounts, P&amp;L, balance sheets and cash flow
            statements — without needing an accountant.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Start free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">See how it works</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            ₦3,000/month after your free trial · No card required to start
          </p>
        </div>
      </section>

      {/* The questions a business owner actually asks */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container py-16">
          <p className="text-center text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Ledgr answers the questions you actually ask
          </p>
          <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
            {[
              'Did I actually make money this month?',
              'Where did all my money go?',
              'How much do customers owe me?',
              'What do I owe suppliers?',
              'Can I afford to hire someone?',
              'What can I show the bank or an investor?',
            ].map((q) => (
              <div
                key={q}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm"
              >
                <span className="text-primary">“</span>
                {q}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features / reports */}
      <section id="features" className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Every report, from one simple ledger
          </h2>
          <p className="mt-3 text-muted-foreground">
            You enter transactions in plain language. Ledgr does the double-entry
            accounting in the background and keeps every report perfectly consistent.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {REPORTS.map((r) => (
            <Card key={r.title}>
              <CardContent className="pt-6">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <r.icon className="size-5" />
                </div>
                <h3 className="font-semibold">{r.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{r.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border bg-secondary/40">
        <div className="container py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Up and running in minutes
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {s.n}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container py-20">
        <div className="mx-auto max-w-md">
          <Card className="border-primary/30 shadow-elevated">
            <CardContent className="p-8 text-center">
              <Badge className="mb-4">Standard</Badge>
              <div className="flex items-end justify-center gap-1">
                <span className="text-5xl font-semibold tracking-tight">₦3,000</span>
                <span className="mb-1.5 text-muted-foreground">/month</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Everything a growing business needs to know its numbers.
              </p>
              <ul className="mt-6 space-y-2.5 text-left text-sm">
                {[
                  'Unlimited transactions',
                  'P&L, Balance Sheet & Cash Flow',
                  'Automatic monthly management accounts',
                  'Weekly business summaries',
                  'Invoicing & expense tracking',
                  'Up to 3 users',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="mt-8 w-full">
                <Link href="/signup">Start your free trial</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} Ledgr. Built for Nigerian businesses.</p>
          <div className="flex items-center gap-1.5">
            <ReceiptText className="size-4" /> Know Your Numbers.
          </div>
        </div>
      </footer>
    </div>
  );
}
