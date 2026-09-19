'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { setBillingStatusAction, extendTrialAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Status = 'active' | 'suspended' | 'cancelled';

const STATUS_BUTTONS: { status: Status; label: string; variant: 'default' | 'destructive' | 'outline' }[] = [
  { status: 'active', label: 'Activate', variant: 'default' },
  { status: 'suspended', label: 'Suspend', variant: 'destructive' },
  { status: 'cancelled', label: 'Cancel subscription', variant: 'outline' },
];

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

  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_BUTTONS.map((btn) => {
        const isCurrent = status === btn.status;
        return (
          <Button
            key={btn.status}
            size="sm"
            variant={btn.variant}
            disabled={pending || isCurrent}
            className={cn(isCurrent && 'opacity-50')}
            onClick={() =>
              run(
                () => setBillingStatusAction({ orgId, status: btn.status }),
                `Business ${btn.label.toLowerCase()}d`
              )
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isCurrent ? `Currently ${btn.label.toLowerCase()}` : btn.label}
          </Button>
        );
      })}

      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => extendTrialAction({ orgId, days: 7 }), 'Trial extended 7 days')}
      >
        Extend trial +7d
      </Button>
    </div>
  );
}
