'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Crown, AlertTriangle, Clock, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'warning' | 'urgent' | 'info' | 'expired';
  title: string;
  description: string;
  action?: { label: string; href: string };
}

function getNotifications(plan: 'free' | 'pro', planDaysLeft: number): Notification[] {
  const notifications: Notification[] = [];

  if (plan === 'pro') {
    if (planDaysLeft <= 0) {
      notifications.push({
        id: 'expired',
        type: 'expired',
        title: 'Pro Plan Expired',
        description: 'Your Pro plan has ended. Renew now to keep unlimited access to all features.',
        action: { label: 'Renew Plan', href: '/plans' },
      });
    } else if (planDaysLeft <= 3) {
      notifications.push({
        id: 'urgent',
        type: 'urgent',
        title: `${planDaysLeft} Day${planDaysLeft !== 1 ? 's' : ''} Left`,
        description: `Your Pro plan expires in ${planDaysLeft} day${planDaysLeft !== 1 ? 's' : ''}. Renew now to avoid losing access.`,
        action: { label: 'Renew Plan', href: '/plans' },
      });
    } else if (planDaysLeft <= 7) {
      notifications.push({
        id: 'warning',
        type: 'warning',
        title: `${planDaysLeft} Days Remaining`,
        description: 'Your Pro plan is expiring soon. Renew to keep unlimited AI generations and projects.',
        action: { label: 'Renew Plan', href: '/plans' },
      });
    } else {
      notifications.push({
        id: 'info',
        type: 'info',
        title: `${planDaysLeft} Days Left`,
        description: `Your Pro plan is active. Auto-renews on the expiry date unless cancelled.`,
      });
    }
  }

  return notifications;
}

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'expired':
      return <AlertTriangle className="size-4 text-red-500" />;
    case 'urgent':
      return <AlertTriangle className="size-4 text-amber-500" />;
    case 'warning':
      return <Clock className="size-4 text-amber-500" />;
    case 'info':
      return <Crown className="size-4 text-primary" />;
  }
}

function getNotificationBg(type: Notification['type']) {
  switch (type) {
    case 'expired':
      return 'bg-red-500/5 border-red-500/20';
    case 'urgent':
      return 'bg-amber-500/5 border-amber-500/20';
    case 'warning':
      return 'bg-amber-500/5 border-amber-500/20';
    case 'info':
      return 'bg-primary/5 border-primary/20';
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);

  if (!user || user.plan === 'free') return null;

  const notifications = getNotifications(user.plan, user.planDaysLeft);
  const hasUrgent = notifications.some((n) => n.type === 'expired' || n.type === 'urgent');

  // Badge count = number of non-info notifications
  const badgeCount = notifications.filter((n) => n.type !== 'info').length;

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
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-background">
              {badgeCount}
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
          </div>
          {user.plan === 'pro' && (
            <Badge
              variant={hasUrgent ? 'destructive' : 'secondary'}
              className="text-[10px]"
            >
              {user.planDaysLeft} day{user.planDaysLeft !== 1 ? 's' : ''} left
            </Badge>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-72 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className={cn(
                    'mx-2 mt-2 rounded-lg border p-3',
                    getNotificationBg(notif.type)
                  )}
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
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
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

        {notifications.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No notifications
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
