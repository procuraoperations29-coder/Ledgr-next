'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Rocket,
  Trash2,
  Wallet,
} from 'lucide-react';
import { createBusinessAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import { LogoMark } from '@/components/brand/logo';

const BUSINESS_TYPES = [
  'Sole Proprietor', 'Limited Company', 'Partnership', 'NGO / Non-profit', 'Other',
];
const INDUSTRIES = [
  'Retail', 'Wholesale / Trading', 'Restaurant / Food', 'Services',
  'Professional Firm', 'Manufacturing', 'Online Business', 'Freelancer', 'Other',
];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface AccountRow {
  name: string;
  kind: 'cash' | 'bank';
  openingMajor: string; // keep as string for the input
}

const STEPS = ['Welcome', 'Your business', 'Bank & cash', 'Review'];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState('Sole Proprietor');
  const [industry, setIndustry] = useState('Retail');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [fyStartMonth, setFyStartMonth] = useState(1);
  const [accounts, setAccounts] = useState<AccountRow[]>([
    { name: 'Cash', kind: 'cash', openingMajor: '' },
    { name: 'Bank', kind: 'bank', openingMajor: '' },
  ]);

  const currency = 'NGN';

  function next() {
    setError(null);
    if (step === 1 && name.trim() === '') {
      setError('Please enter your business name.');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function updateAccount(i: number, patch: Partial<AccountRow>) {
    setAccounts((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addAccount() {
    setAccounts((rows) => [...rows, { name: '', kind: 'bank', openingMajor: '' }]);
  }
  function removeAccount(i: number) {
    setAccounts((rows) => rows.filter((_, idx) => idx !== i));
  }

  const totalOpening = accounts.reduce(
    (s, a) => s + (Number(a.openingMajor) || 0),
    0
  );

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await createBusinessAction({
        name,
        businessType,
        industry,
        phone,
        address,
        currency,
        fyStartMonth,
        accounts: accounts
          .filter((a) => a.name.trim() !== '')
          .map((a) => ({
            name: a.name.trim(),
            kind: a.kind,
            openingMajor: Number(a.openingMajor) || 0,
          })),
      });
      if (result?.error && !result.orgId) {
        setError(result.error);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-secondary/40">
      <header className="container flex h-16 items-center justify-between">
        <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <LogoMark className="size-8" />
          Ledgr
        </span>
        <span className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </span>
      </header>

      {/* Progress */}
      <div className="container">
        <div className="flex gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-colors',
                  i <= step ? 'bg-primary' : 'bg-border'
                )}
              />
              <span
                className={cn(
                  'mt-2 hidden text-xs sm:block',
                  i <= step ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <main className="flex flex-1 items-start justify-center px-4 py-8">
        <Card className="w-full max-w-xl shadow-elevated">
          <CardContent className="p-6 sm:p-8">
            {error && (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Step 0 — Welcome */}
            {step === 0 && (
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Rocket className="size-7" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Welcome to Ledgr
                </h1>
                <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
                  Let&apos;s set up your business in a couple of minutes. We&apos;ll
                  create your accounts and get you ready to record your first
                  transaction.
                </p>
              </div>
            )}

            {/* Step 1 — Business info */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    Tell us about your business
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    This appears on your reports and invoices.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bname">Business name</Label>
                  <Input
                    id="bname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tayo Foods Limited"
                    autoFocus
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="btype">Business type</Label>
                    <Select
                      id="btype"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                    >
                      {BUSINESS_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bind">Industry</Label>
                    <Select
                      id="bind"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                    >
                      {INDUSTRIES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bphone">Phone (optional)</Label>
                    <Input
                      id="bphone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0801 234 5678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bfy">Financial year starts</Label>
                    <Select
                      id="bfy"
                      value={fyStartMonth}
                      onChange={(e) => setFyStartMonth(Number(e.target.value))}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baddr">Address (optional)</Label>
                  <Input
                    id="baddr"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Lagos, Nigeria"
                  />
                </div>
              </div>
            )}

            {/* Step 2 — Bank & cash */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    Where&apos;s your money?
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Add your cash and bank accounts, and how much is in each today.
                    You can change these later.
                  </p>
                </div>
                <div className="space-y-3">
                  {accounts.map((acc, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_7rem_9rem_auto] sm:items-end"
                    >
                      <div className="space-y-1.5">
                        <Label className="text-xs">Account name</Label>
                        <Input
                          value={acc.name}
                          onChange={(e) => updateAccount(i, { name: e.target.value })}
                          placeholder="e.g. GTBank"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={acc.kind}
                          onChange={(e) =>
                            updateAccount(i, { kind: e.target.value as 'cash' | 'bank' })
                          }
                        >
                          <option value="bank">Bank</option>
                          <option value="cash">Cash</option>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Balance today (₦)</Label>
                        <Input
                          type="number"
                          min={0}
                          inputMode="decimal"
                          value={acc.openingMajor}
                          onChange={(e) =>
                            updateAccount(i, { openingMajor: e.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAccount(i)}
                        disabled={accounts.length <= 1}
                        aria-label="Remove account"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addAccount}>
                  <Plus className="size-4" /> Add another account
                </Button>
                <div className="flex items-center justify-between rounded-lg bg-accent px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-accent-foreground">
                    <Wallet className="size-4" /> Total starting balance
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(Math.round(totalOpening * 100), currency)}
                  </span>
                </div>
              </div>
            )}

            {/* Step 3 — Review */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    Ready to go
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    We&apos;ll create your business and a standard chart of accounts.
                  </p>
                </div>
                <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                  <Row label="Business" value={name || '—'} />
                  <Row label="Type" value={businessType} />
                  <Row label="Industry" value={industry} />
                  <Row label="Financial year starts" value={MONTHS[fyStartMonth - 1]} />
                  <Row
                    label="Accounts"
                    value={`${accounts.filter((a) => a.name.trim()).length} account(s)`}
                  />
                  <Row
                    label="Starting balance"
                    value={formatMoney(Math.round(totalOpening * 100), currency)}
                  />
                </dl>
              </div>
            )}

            {/* Nav */}
            <div className="mt-8 flex items-center justify-between">
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={back} disabled={pending}>
                  <ArrowLeft className="size-4" /> Back
                </Button>
              ) : (
                <span />
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={next}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button type="button" onClick={finish} disabled={pending}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Create my business
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
