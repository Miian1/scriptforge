'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, AlertTriangle, Clock, ChevronRight, MessageSquare } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'warning' | 'urgent' | 'info';
  title: string;
  description: string;
  action?: { label: string; href: string };
  read: boolean;
  createdAt: number;
}

function getSystemNotifications(plan: 'free' | 'pro', planDaysLeft: number, planExpiresAt: number): Notification[] {
  const notifications: Notification[] = [];

  if (plan === 'pro' && planExpiresAt > 0) {
    if (planDaysLeft <= 3 && planDaysLeft > 0) {
      notifications.push({
        id: 'sys-urgent',
        type: 'urgent',
        title: `${planDaysLeft} Day${planDaysLeft !== 1 ? 's' : ''} Left`,
        description: `Your Pro plan expires in ${planDaysLeft} day${planDaysLeft !== 1 ? 's' : ''}. Renew now to avoid losing access.`,
        action: { label: 'Renew Plan', href: '/plans' },
        read: false,
        createdAt: Date.now(),
      });
    } else if (planDaysLeft <= 7 && planDaysLeft > 3) {
      notifications.push({
        id: 'sys-warning',
        type: 'warning',
        title: `${planDaysLeft} Days Remaining`,
        description: 'Your Pro plan is expiring soon. Renew to keep unlimited AI generations and projects.',
        action: { label: 'Renew Plan', href: '/plans' },
        read: false,
        createdAt: Date.now(),
      });
    }
  }

  return notifications;
}

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'urgent':
      return <AlertTriangle className="size-4 text-amber-500" />;
    case 'warning':
      return <Clock className="size-4 text-amber-500" />;
    case 'info':
      return <MessageSquare className="size-4 text-blue-500" />;
  }
}

function getNotificationBg(type: Notification['type']) {
  switch (type) {
    case 'urgent':
      return 'bg-amber-500/5 border-amber-500/20';
    case 'warning':
      return 'bg-amber-500/5 border-amber-500/20';
    case 'info':
      return 'bg-blue-500/5 border-blue-500/20';
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const checkSession = useAuthStore((s) => s.checkSession);
  const [open, setOpen] = useState(false);
  const [adminNotifs, setAdminNotifs] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // Auto-downgrade check
  useEffect(() => {
    if (
      user?.plan === 'pro' &&
      user.planExpiresAt > 0 &&
      user.planDaysLeft <= 0
    ) {
      checkSession();
    }
  }, [user?.plan, user?.planExpiresAt, user?.planDaysLeft, checkSession]);

  // Fetch admin-sent notifications
  const fetchNotifications = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setAdminNotifs(data.notifications || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Open popover → refetch
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  if (!user) return null;

  // Merge system + admin notifications
  const systemNotifs = getSystemNotifications(user.plan, user.planDaysLeft, user.planExpiresAt);
  const allNotifs = [...adminNotifs, ...systemNotifs];
  const unreadCount = allNotifs.filter((n) => !n.read).length;
  const hasUrgent = allNotifs.some((n) => n.type === 'urgent' && !n.read);

  // Mark as read
  const markRead = async (notifId: string) => {
    setAdminNotifs((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
    try {
      await fetch(`/api/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notifId }),
      });
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    setAdminNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch(`/api/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readAll: true }),
      });
    } catch {
      // silent
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex min-size-4 h-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge
                variant={hasUrgent ? 'destructive' : 'secondary'}
                className="text-[10px]"
              >
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-[320px] overflow-y-auto">
          {allNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="size-6 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No notifications</p>
            </div>
          ) : (
            allNotifs.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  'mx-2 mt-2 rounded-lg border p-3 transition-opacity',
                  getNotificationBg(notif.type),
                  notif.read && 'opacity-50',
                )}
                onClick={() => !notif.read && markRead(notif.id)}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">{getNotificationIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{notif.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {notif.description}
                    </p>
                    {notif.action && (
                      <button
                        onClick={() => {
                          setOpen(false);
                          router.push(notif.action!.href);
                        }}
                        className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {notif.action.label}
                        <ChevronRight className="size-3" />
                      </button>
                    )}
                  </div>
                  {!notif.read && (
                    <div className="size-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {user.plan === 'pro' && (
          <>
            <Separator />
            <div className="px-4 py-2.5">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/plans');
                }}
                className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Manage Subscription
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
