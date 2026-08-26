'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  setOrgStatusAction,
  setSubscriptionStatusAction,
  extendTrialAction,
} from '../../actions';
import { Button } from '@/components/ui/button';

export function AdminControls({
  orgId,
  status,
}: {
  orgId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>, success: string) {
    startTransition(async () => {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      else {
        toast.success(success);
        router.refresh();
      }
    });
  }

  const suspended = status === 'suspended';

  return (
    <div className="flex flex-wrap gap-2">
      {suspended ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => setOrgStatusAction({ orgId, status: 'active' }), 'Business activated')}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Activate business
        </Button>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => run(() => setOrgStatusAction({ orgId, status: 'suspended' }), 'Business suspended')}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Suspend business
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => extendTrialAction({ orgId, days: 14 }), 'Trial extended 14 days')}
      >
        Extend trial +14d
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => setSubscriptionStatusAction({ orgId, status: 'active' }), 'Subscription activated')}
      >
        Mark subscription active
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => setSubscriptionStatusAction({ orgId, status: 'cancelled' }), 'Subscription cancelled')}
      >
        Cancel subscription
      </Button>
    </div>
  );
}
