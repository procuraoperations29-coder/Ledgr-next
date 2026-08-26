'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCheck } from 'lucide-react';
import { markAllReadAction } from './actions';
import { Button } from '@/components/ui/button';

export function MarkAllRead() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markAllReadAction();
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
      Mark all read
    </Button>
  );
}
