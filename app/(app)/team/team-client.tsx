'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2, UserPlus, KeyRound, Copy } from 'lucide-react';
import {
  createSubUserAction,
  removeMemberAction,
  updateMemberRoleAction,
} from './actions';
import type { TeamMember } from '@/lib/team';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

const ROLE_HELP: Record<string, string> = {
  admin: 'Full access to run the business.',
  accountant: 'Full financial records and reports.',
  staff: 'Record transactions; reports only if allowed.',
  viewer: 'Read-only access.',
};

export function TeamClient({
  members,
  planName,
  maxUsers,
  atLimit,
}: {
  members: TeamMember[];
  planName: string;
  maxUsers: number;
  atLimit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [role, setRole] = useState('staff');
  const [canView, setCanView] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '');
    const fullName = String(fd.get('fullName') ?? '');
    startTransition(async () => {
      const r = await createSubUserAction({ email, fullName, role: role as any, canViewReports: canView });
      if (r?.error) return setError(r.error);
      setOpen(false);
      if (r.tempPassword) setCreated({ email, password: r.tempPassword });
      else toast.success('Added to your team');
      router.refresh();
    });
  }

  function changeRole(userId: string, newRole: string) {
    startTransition(async () => {
      const r = await updateMemberRoleAction({
        userId, role: newRole as any, canViewReports: newRole === 'staff',
      });
      if (r?.error) toast.error(r.error);
      else { toast.success('Role updated'); router.refresh(); }
    });
  }

  function remove(userId: string, name: string) {
    startTransition(async () => {
      const r = await removeMemberAction(userId);
      if (r?.error) toast.error(r.error);
      else { toast.success(`Removed ${name}`); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      {created && (
        <Alert variant="info">
          <KeyRound className="size-4" />
          <AlertDescription>
            <div className="font-medium text-foreground">{created.email} was added.</div>
            Share this temporary password — they can change it in Settings:
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded bg-background px-2 py-1 text-sm">{created.password}</code>
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard?.writeText(created.password); toast.success('Copied');
              }}><Copy className="size-3.5" /> Copy</Button>
              <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>Dismiss</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-medium">
              {members.length} of {maxUsers} seats used
            </p>
            <p className="text-xs text-muted-foreground">On the {planName} plan.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={atLimit}>
                <UserPlus className="size-4" /> Add user
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a team member</DialogTitle>
                <DialogDescription>
                  We&apos;ll create their account — you share the temporary password.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="t-name">Name</Label>
                    <Input id="t-name" name="fullName" autoFocus required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t-email">Email</Label>
                    <Input id="t-email" name="email" type="email" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-role">Role</Label>
                  <Select id="t-role" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="admin">Admin</option>
                    <option value="accountant">Accountant</option>
                    <option value="staff">Staff</option>
                    <option value="viewer">Viewer</option>
                  </Select>
                  <p className="text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
                </div>
                {role === 'staff' && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={canView} onChange={(e) => setCanView(e.target.checked)}
                      className="size-4 rounded border-input" />
                    Allow this staff member to view financial reports
                  </label>
                )}
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={pending}>
                    {pending && <Loader2 className="size-4 animate-spin" />} Add user
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {atLimit && (
        <Alert variant="info">
          <AlertDescription>
            You&apos;ve used all {maxUsers} seats on the {planName} plan.{' '}
            {planName === 'Standard' && <>Upgrade to <b>Growth</b> for up to 10 users.</>}
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {members.map((m) => (
          <div key={m.userId} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.fullName || m.email || 'Member'}</p>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
            </div>
            {m.role === 'owner' ? (
              <Badge>Owner</Badge>
            ) : (
              <>
                <Select
                  value={m.role}
                  onChange={(e) => changeRole(m.userId, e.target.value)}
                  disabled={pending}
                  className="h-9 w-auto min-w-[8rem]"
                  aria-label={`Role for ${m.fullName ?? m.email}`}
                >
                  <option value="admin">Admin</option>
                  <option value="accountant">Accountant</option>
                  <option value="staff">Staff</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <Button
                  size="icon" variant="ghost" disabled={pending}
                  onClick={() => remove(m.userId, m.fullName || m.email || 'member')}
                  aria-label="Remove member"
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
