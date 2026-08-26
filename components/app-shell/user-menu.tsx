'use client';

import { useTransition } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { signOutAction } from '@/app/(auth)/actions';

export function UserMenu({
  name,
  email,
  orgName,
  isPlatformAdmin = false,
}: {
  name: string | null;
  email: string | null;
  orgName: string;
  isPlatformAdmin?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const initials = (name ?? email ?? 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{name ?? 'Account'}</div>
          <div className="text-xs font-normal text-muted-foreground">{email}</div>
          <div className="mt-1 text-xs font-normal text-muted-foreground">
            {orgName}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isPlatformAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck className="size-4" />
              Admin console
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => startTransition(() => void signOutAction())}
          disabled={pending}
        >
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
