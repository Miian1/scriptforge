'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, Crown, Zap, Search, Loader2,
  Edit3, X, Check, Clock,
  RefreshCw, Plus, Minus, CalendarDays, Eye, Bell, Send,
  CreditCard, Banknote, UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────

interface ManagerUser {
  id: string;
  name: string;
  email: string;
  provider: string;
  role: string;
  plan: string;
  planSource: 'stripe' | 'manual' | null;
  isVerified: boolean;
  planExpiresAt: number;
  planDaysLeft: number;
  stripe: {
    customerId: string;
    subscriptionId: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  };
  dailyUsage: { date: string; projectsCreated: number; aiGenerations: number };
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ────────────────────────────────────────────

function formatDate(timestamp: string | number): string {
  if (!timestamp) return '—';
  const date = new Date(typeof timestamp === 'number' ? timestamp : timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatExpiryDate(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return '—';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Days editing mode ──
type DaysEditMode = 'add' | 'reduce' | 'set';

// ── Component ──────────────────────────────────────────

export default function ManagerPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<ManagerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<ManagerUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifyUser, setNotifyUser] = useState<ManagerUser | null>(null);
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'warning' | 'urgent'>('info');

  // Edit form state — note: NO role, NO custom plan (managers can't edit those)
  const [editPlan, setEditPlan] = useState('free');
  const [daysEditMode, setDaysEditMode] = useState<DaysEditMode>('add');
  const [daysValue, setDaysValue] = useState(0);

  // Redirect non-managers
  useEffect(() => {
    if (user && user.role !== 'manager') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/manager/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to load users');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'manager') {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  // Filter users by search
  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  // Stats
  const totalUsers = users.length;
  const proUsers = users.filter((u) => u.plan === 'pro').length;
  const manualProUsers = users.filter((u) => u.plan === 'pro' && u.planSource === 'manual').length;
  const expiredUsers = users.filter((u) => u.plan === 'pro' && u.planDaysLeft <= 0).length;

  // Open edit dialog
  const openEdit = (u: ManagerUser) => {
    setEditUser(u);
    setEditPlan(u.plan);
    setDaysEditMode('add');
    setDaysValue(0);
  };

  // ── Compute preview of what days will be after save ──
  const previewDaysLeft = (): number => {
    if (!editUser) return 0;
    if (editPlan === 'free') return 0;

    let baseExpiry = editUser.planExpiresAt && editUser.planExpiresAt > Date.now()
      ? editUser.planExpiresAt
      : Date.now();

    if (daysEditMode === 'add' && daysValue > 0) {
      baseExpiry = baseExpiry + daysValue * 24 * 60 * 60 * 1000;
    } else if (daysEditMode === 'reduce' && daysValue > 0) {
      baseExpiry = Math.max(Date.now(), baseExpiry - daysValue * 24 * 60 * 60 * 1000);
    } else if (daysEditMode === 'set') {
      if (daysValue <= 0) return 0;
      baseExpiry = Date.now() + daysValue * 24 * 60 * 60 * 1000;
    }

    const diff = baseExpiry - Date.now();
    return diff > 0 ? Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24))) : 0;
  };

  const previewExpiryDate = (): string => {
    if (!editUser) return '—';
    if (editPlan === 'free') return 'N/A';

    let baseExpiry = editUser.planExpiresAt && editUser.planExpiresAt > Date.now()
      ? editUser.planExpiresAt
      : Date.now();

    if (daysEditMode === 'add' && daysValue > 0) {
      baseExpiry = baseExpiry + daysValue * 24 * 60 * 60 * 1000;
    } else if (daysEditMode === 'reduce' && daysValue > 0) {
      baseExpiry = Math.max(Date.now(), baseExpiry - daysValue * 24 * 60 * 60 * 1000);
    } else if (daysEditMode === 'set') {
      if (daysValue <= 0) return 'N/A';
      baseExpiry = Date.now() + daysValue * 24 * 60 * 60 * 1000;
    }

    return new Date(baseExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Save user — only plan & days operations. No role, no delete.
  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { plan: editPlan };

      if (daysEditMode === 'add' && daysValue > 0) {
        body.addDays = daysValue;
      } else if (daysEditMode === 'reduce' && daysValue > 0) {
        body.reduceDays = daysValue;
      } else if (daysEditMode === 'set') {
        body.setDays = daysValue;
      }

      const res = await fetch(`/api/manager/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Updated ${editUser.name} successfully`);
        setEditUser(null);
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to update user');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Quick add 30 days
  const quickAddDays = async (u: ManagerUser, days: number) => {
    try {
      const res = await fetch(`/api/manager/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addDays: days }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Added ${days} days to ${u.name}`);
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to add days');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // Send notification to user
  const handleSendNotification = async () => {
    if (!notifyUser || !notifTitle.trim() || !notifMessage.trim()) return;
    setSendingNotif(true);
    try {
      const res = await fetch('/api/manager/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: notifyUser.id,
          title: notifTitle.trim(),
          message: notifMessage.trim(),
          type: notifType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Notification sent to ${notifyUser.name}`);
        setNotifyUser(null);
        setNotifTitle('');
        setNotifMessage('');
        setNotifType('info');
      } else {
        toast.error(data.error || 'Failed to send notification');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSendingNotif(false);
    }
  };

  // Loading gate
  if (user === null || (user && user.role !== 'manager')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <UserCog className="size-7 text-primary" />
            Manager Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user plans and send notifications. Account-deletion and role
            changes are admin-only and not available here.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-2">
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/5' },
          { label: 'Pro Users', value: proUsers, icon: Crown, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Manual Pro', value: manualProUsers, icon: Banknote, color: 'text-amber-500', bg: 'bg-amber-500/5' },
          { label: 'Expired Plans', value: expiredUsers, icon: Clock, color: 'text-red-500', bg: 'bg-red-500/5' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <span className={cn('size-7 rounded-md flex items-center justify-center', stat.bg)}>
                  <stat.icon className={cn('size-3.5', stat.color)} />
                </span>
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <Users className="size-3" />
          {filteredUsers.length} shown
        </Badge>
      </div>

      {/* ── Users table ── */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Plan</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Days Left</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Usage</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Joined</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Loader2 className="size-5 animate-spin inline-block text-muted-foreground" />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{u.name || '—'}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.plan === 'pro' ? (
                        <Badge className="text-[10px] gap-1 w-fit">
                          <Crown className="size-2.5" />
                          Pro
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 w-fit">
                          <Zap className="size-2.5" />
                          Free
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.plan === 'pro' ? (
                        <div className="flex flex-col">
                          <span className={cn(
                            'text-sm font-medium',
                            u.planDaysLeft <= 3 ? 'text-red-500' : u.planDaysLeft <= 7 ? 'text-amber-500' : ''
                          )}>
                            {u.planDaysLeft}d
                          </span>
                          {u.planExpiresAt > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatExpiryDate(u.planExpiresAt)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.plan === 'pro' ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] gap-1 w-fit capitalize',
                            u.planSource === 'stripe'
                              ? 'border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400'
                              : 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400'
                          )}
                        >
                          {u.planSource === 'stripe' ? (
                            <><CreditCard className="size-2.5" />Stripe</>
                          ) : (
                            <><Banknote className="size-2.5" />Manual</>
                          )}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground">
                        <span>{u.dailyUsage?.projectsCreated ?? 0} proj</span>
                        <span className="mx-1">·</span>
                        <span>{u.dailyUsage?.aiGenerations ?? 0} AI</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick add 30 days */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Add 30 days"
                          onClick={() => quickAddDays(u, 30)}
                        >
                          <Plus className="size-3" />
                        </Button>
                        {/* Send notification */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Send notification"
                          onClick={() => {
                            setNotifyUser(u);
                            setNotifTitle('');
                            setNotifMessage('');
                            setNotifType('info');
                          }}
                        >
                          <Bell className="size-3.5" />
                        </Button>
                        {/* Edit */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Edit plan"
                          onClick={() => openEdit(u)}
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── Edit Plan Dialog (manager-scoped) ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="size-4" />
              Edit User Plan
            </DialogTitle>
            <DialogDescription>
              {editUser?.name} ({editUser?.email})
            </DialogDescription>
          </DialogHeader>

          {editUser && (
            <div className="space-y-4 py-2">
              {/* Current state */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Plan</span>
                  <span className={cn('font-medium', editUser.plan === 'pro' && 'text-primary')}>
                    {editUser.plan === 'pro' ? 'Pro' : 'Free'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Days Left</span>
                  <span className="font-medium">{editUser.planDaysLeft}d</span>
                </div>
                {editUser.planExpiresAt > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expires On</span>
                    <span className="text-xs">{formatExpiryDate(editUser.planExpiresAt)}</span>
                  </div>
                )}
              </div>

              {/* Plan select — Free or Pro only */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan</label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">
                      <div className="flex items-center gap-2">
                        <Zap className="size-3.5 text-muted-foreground" />
                        Free
                      </div>
                    </SelectItem>
                    <SelectItem value="pro">
                      <div className="flex items-center gap-2">
                        <Crown className="size-3.5 text-primary" />
                        Pro (manual)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {editPlan === 'pro' && (
                  <p className="text-[11px] text-muted-foreground">
                    Source will be marked as{' '}
                    <span className="font-medium text-amber-600 dark:text-amber-400">Manual</span>{' '}
                    (Easypaisa/JazzCash or staff upgrade).
                  </p>
                )}
              </div>

              {/* Days editing */}
              {editPlan === 'pro' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <CalendarDays className="size-3.5 text-primary" />
                    Days Adjustment
                  </label>
                  <div className="flex items-center gap-1.5">
                    {(['add', 'reduce', 'set'] as const).map((m) => (
                      <Button
                        key={m}
                        variant={daysEditMode === m ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs flex-1 capitalize"
                        onClick={() => setDaysEditMode(m)}
                      >
                        {m === 'add' && <Plus className="size-3 mr-1" />}
                        {m === 'reduce' && <Minus className="size-3 mr-1" />}
                        {m === 'set' && <Check className="size-3 mr-1" />}
                        {m}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => setDaysValue(Math.max(0, daysValue - 1))}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={daysValue}
                      onChange={(e) => setDaysValue(Math.max(0, Math.min(365, parseInt(e.target.value) || 0)))}
                      className="w-24 text-center"
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => setDaysValue(Math.min(365, daysValue + 1))}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {daysEditMode === 'add' && 'Add days to the current expiry. If expired, starts from today.'}
                    {daysEditMode === 'reduce' && 'Reduce days from the current expiry. Will not go below today.'}
                    {daysEditMode === 'set' && 'Set the exact number of days from today. Replaces current expiry.'}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[7, 14, 30, 60, 90].map((d) => (
                      <Button
                        key={d}
                        variant="ghost"
                        size="sm"
                        className="text-[11px] h-7 px-2"
                        onClick={() => setDaysValue(d)}
                      >
                        {d}d
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Preview */}
              {editPlan === 'pro' && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Eye className="size-3.5" />
                    Preview After Save
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium text-primary">Pro</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Days Left</span>
                    <span className={cn(
                      'font-semibold',
                      previewDaysLeft() <= 3 ? 'text-red-500' : previewDaysLeft() <= 7 ? 'text-amber-500' : 'text-foreground'
                    )}>
                      {previewDaysLeft()} days
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expires On</span>
                    <span className="text-xs font-medium">{previewExpiryDate()}</span>
                  </div>
                </div>
              )}

              {/* Notice: managers cannot delete or change roles */}
              <div className="rounded-lg bg-muted/30 border border-border p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
                <ShieldCheck className="size-3.5 mt-0.5 shrink-0" />
                <span>
                  Managers can only adjust plans and days. Role changes and account
                  deletion require admin access.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── Send Notification Dialog ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <Dialog open={!!notifyUser} onOpenChange={() => setNotifyUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-4 text-blue-500" />
              Send Notification
            </DialogTitle>
            <DialogDescription>
              Send a notification to {notifyUser?.name} ({notifyUser?.email})
            </DialogDescription>
          </DialogHeader>

          {notifyUser && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-medium">{notifyUser.name}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Plan</span>
                  <span className={cn(notifyUser.plan === 'pro' && 'text-primary font-medium')}>
                    {notifyUser.plan === 'pro' ? 'Pro' : 'Free'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <div className="flex items-center gap-1.5">
                  {([
                    { value: 'info' as const, label: 'Info', color: 'text-blue-500' },
                    { value: 'warning' as const, label: 'Warning', color: 'text-amber-500' },
                    { value: 'urgent' as const, label: 'Urgent', color: 'text-red-500' },
                  ]).map(({ value, label, color }) => (
                    <Button
                      key={value}
                      variant={notifType === value ? 'default' : 'outline'}
                      size="sm"
                      className={cn('gap-1 text-xs', notifType !== value && 'text-muted-foreground')}
                      onClick={() => setNotifType(value)}
                    >
                      <span className={cn('size-1.5 rounded-full', color === 'text-blue-500' ? 'bg-blue-500' : color === 'text-amber-500' ? 'bg-amber-500' : 'bg-red-500')} />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="e.g. Welcome to Pro!"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  placeholder="Write your notification message..."
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-[11px] text-muted-foreground text-right">{notifMessage.length}/500</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNotifyUser(null)}>Cancel</Button>
            <Button
              onClick={handleSendNotification}
              disabled={sendingNotif || !notifTitle.trim() || !notifMessage.trim()}
              className="gap-2"
            >
              {sendingNotif ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
