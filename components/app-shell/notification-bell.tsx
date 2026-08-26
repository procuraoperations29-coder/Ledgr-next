import Link from 'next/link';
import { Bell } from 'lucide-react';

export function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      href="/notifications"
      className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
    >
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
