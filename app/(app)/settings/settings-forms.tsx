'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { updateBusinessAction, updateProfileAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const BUSINESS_TYPES = ['Sole Proprietor', 'Limited Company', 'Partnership', 'NGO / Non-profit', 'Other'];
const INDUSTRIES = ['Retail', 'Wholesale / Trading', 'Restaurant / Food', 'Services', 'Professional Firm', 'Manufacturing', 'Online Business', 'Freelancer', 'Other'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'];

export interface BusinessValues {
  name: string;
  businessType: string;
  industry: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  fyStartMonth: number;
}

export function BusinessForm({
  initial,
  canEdit,
}: {
  initial: BusinessValues;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<BusinessValues>(initial);

  function set<K extends keyof BusinessValues>(k: K, val: BusinessValues[K]) {
    setV((prev) => ({ ...prev, [k]: val }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await updateBusinessAction(v);
      if (r?.error) return setError(r.error);
      toast.success('Business settings saved');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-1 font-semibold">Business profile</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Appears on your reports and invoices.
        </p>
        {!canEdit && (
          <Alert variant="info" className="mb-4">
            <AlertDescription>
              Only an owner or admin can change these. You can view them below.
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="b-name">Business name</Label>
            <Input id="b-name" value={v.name} onChange={(e) => set('name', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-type">Business type</Label>
              <Select id="b-type" value={v.businessType} onChange={(e) => set('businessType', e.target.value)} disabled={!canEdit}>
                {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-ind">Industry</Label>
              <Select id="b-ind" value={v.industry} onChange={(e) => set('industry', e.target.value)} disabled={!canEdit}>
                {INDUSTRIES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-phone">Phone</Label>
              <Input id="b-phone" value={v.phone} onChange={(e) => set('phone', e.target.value)} disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-email">Email</Label>
              <Input id="b-email" type="email" value={v.email} onChange={(e) => set('email', e.target.value)} disabled={!canEdit} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-addr">Address</Label>
            <Input id="b-addr" value={v.address} onChange={(e) => set('address', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-cur">Currency</Label>
              <Select id="b-cur" value={v.currency} onChange={(e) => set('currency', e.target.value)} disabled={!canEdit}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-fy">Financial year starts</Label>
              <Select id="b-fy" value={v.fyStartMonth} onChange={(e) => set('fyStartMonth', Number(e.target.value))} disabled={!canEdit}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function PreferencesForm({
  initialName,
  initialAccountantMode,
}: {
  initialName: string;
  initialAccountantMode: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(initialName);
  const [accountantMode, setAccountantMode] = useState(initialAccountantMode);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await updateProfileAction({ fullName, accountantMode });
      if (r?.error) return setError(r.error);
      toast.success('Preferences saved');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-1 font-semibold">Your profile</h2>
        <p className="mb-4 text-sm text-muted-foreground">Personal details and preferences.</p>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="p-name">Your name</Label>
            <Input id="p-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              checked={accountantMode}
              onChange={(e) => setAccountantMode(e.target.checked)}
              className="mt-0.5 size-4 rounded border-input"
            />
            <span>
              <span className="text-sm font-medium">Accountant mode</span>
              <span className="block text-xs text-muted-foreground">
                Show accounting terminology (debits, credits, journals) across the app.
              </span>
            </span>
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
