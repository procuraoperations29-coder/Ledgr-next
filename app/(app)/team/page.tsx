import { ShieldAlert } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { getTeam } from '@/lib/team';
import { getOrgPlan } from '@/lib/plan';
import { EmptyState } from '@/components/ui/empty-state';
import { TeamClient } from './team-client';

export const metadata = { title: 'Team' };

export default async function TeamPage() {
  const session = await requireSession();

  if (session.role !== 'owner' && session.role !== 'admin') {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Team is restricted"
        description="Only an owner or admin can manage users. Ask them for access."
      />
    );
  }

  const [members, plan] = await Promise.all([
    getTeam(session.org.id),
    getOrgPlan(session.org.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Add people to {session.org.name} and choose what each of them can do.
        </p>
      </div>

      <TeamClient
        members={members}
        planName={plan.name}
        maxUsers={plan.maxUsers}
        atLimit={members.length >= plan.maxUsers}
      />
    </div>
  );
}
