'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, Crown, Zap, Search, Loader2, ChevronDown,
  Edit3, Trash2, X, Check, Clock, Star, UserCog,
  AlertTriangle, RefreshCw, Plus, Minus, CalendarDays, Settings, Eye, Bell, Send,
  Wrench, Youtube, ToggleLeft, ToggleRight, Save,
  BrainCircuit, Mic, MessageSquare, Sparkles, Trash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  provider: string;
  role: string;
  plan: string;
  isVerified: boolean;
  isCustomPlan: boolean;
  customPlan: { isCustom: boolean; customLabel: string; customDays: number };
  planExpiresAt: number;
  planDaysLeft: number;
  stripe: { customerId: string; subscriptionId: string; currentPeriodEnd: number; cancelAtPeriodEnd: boolean };
  dailyUsage: { date: string; projectsCreated: number; aiGenerations: number };
  createdAt: string;
  updatedAt: string;
}

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

// ── AI Model types ──
interface AIModelItem {
  _id: string;
  name: string;
  modelId: string;
  category: 'text' | 'voice';
  description: string;
  isActive: boolean;
  sortOrder: number;
}

// ── Days editing mode ──
type DaysEditMode = 'add' | 'reduce' | 'set';

export default function AdminPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notifyUser, setNotifyUser] = useState<AdminUser | null>(null);
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'warning' | 'urgent'>('info');

  // Tools config state
  const [toolsConfig, setToolsConfig] = useState({ youtube: true });
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsSaving, setToolsSaving] = useState(false);

  // AI Models state
  const [aiModels, setAiModels] = useState<AIModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModelItem | null>(null);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelName, setModelName] = useState('');
  const [modelId, setModelId] = useState('');
  const [modelCategory, setModelCategory] = useState<'text' | 'voice'>('text');
  const [modelDescription, setModelDescription] = useState('');
  const [modelIsActive, setModelIsActive] = useState(true);
  const [deletingModel, setDeletingModel] = useState<AIModelItem | null>(null);
  const [deletingModelLoading, setDeletingModelLoading] = useState(false);

  // Edit form state
  const [editPlan, setEditPlan] = useState('free');
  const [editIsCustom, setEditIsCustom] = useState(false);
  const [editCustomLabel, setEditCustomLabel] = useState('');
  const [editCustomDays, setEditCustomDays] = useState(0);
  const [editRole, setEditRole] = useState('user');
  const [daysEditMode, setDaysEditMode] = useState<DaysEditMode>('add');
  const [daysValue, setDaysValue] = useState(0);

  // Redirect non-admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
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
    if (user?.role === 'admin') {
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
  const customUsers = users.filter((u) => u.isCustomPlan).length;
  const expiredUsers = users.filter((u) => u.plan === 'pro' && u.planDaysLeft <= 0).length;

  // Open edit dialog
  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setEditPlan(u.plan);
    setEditIsCustom(u.isCustomPlan);
    setEditCustomLabel(u.customPlan?.customLabel || '');
    setEditCustomDays(u.customPlan?.customDays || 0);
    setEditRole(u.role);
    setDaysEditMode('add');
    setDaysValue(0);
  };

  // ── Compute preview of what days will be after save ──
  const previewDaysLeft = (): number => {
    if (!editUser) return 0;
    if (editPlan === 'free') return 0;

    // If custom is ON and has custom days, those take priority
    if (editIsCustom && editCustomDays > 0) {
      return editCustomDays;
    }

    // Base expiry
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
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const previewExpiryDate = (): string => {
    if (!editUser) return '—';
    if (editPlan === 'free') return 'N/A';

    if (editIsCustom && editCustomDays > 0) {
      const d = new Date(Date.now() + editCustomDays * 24 * 60 * 60 * 1000);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

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

  // Save user
  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        plan: editPlan,
        role: editRole,
        isCustomPlan: editIsCustom,
        customPlan: {
          isCustom: editIsCustom,
          customLabel: editCustomLabel,
          customDays: editCustomDays,
        },
      };

      // Days operations (only when not custom, since custom takes priority)
      if (!editIsCustom || editCustomDays <= 0) {
        if (daysEditMode === 'add' && daysValue > 0) {
          body.addDays = daysValue;
        } else if (daysEditMode === 'reduce' && daysValue > 0) {
          body.reduceDays = daysValue;
        } else if (daysEditMode === 'set') {
          body.setDays = daysValue;
        }
      }

      const res = await fetch(`/api/admin/users/${editUser.id}`, {
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

  // Delete user
  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Deleted ${deleteUser.email}`);
        setDeleteUser(null);
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Quick add 30 days
  const quickAddDays = async (u: AdminUser, days: number) => {
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
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
      const res = await fetch('/api/admin/notify', {
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

  // ── Tools Management ──
  const fetchToolsConfig = useCallback(async () => {
    setToolsLoading(true);
    try {
      const res = await fetch('/api/admin/config');
      if (res.ok) {
        const data = await res.json();
        setToolsConfig(data.config?.tools || { youtube: true });
      }
    } catch {
      // silent
    } finally {
      setToolsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchToolsConfig();
    }
  }, [user, fetchToolsConfig]);

  const handleToggleTool = async (tool: 'youtube') => {
    const newValue = !toolsConfig[tool];
    const updated = { ...toolsConfig, [tool]: newValue };
    setToolsConfig(updated);
    setToolsSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools: updated }),
      });
      if (res.ok) {
        toast.success(`${tool === 'youtube' ? 'YouTube' : tool} ${newValue ? 'enabled' : 'disabled'}`);
      } else {
        // Revert on failure
        setToolsConfig(toolsConfig);
        toast.error('Failed to update tool setting');
      }
    } catch {
      setToolsConfig(toolsConfig);
      toast.error('Network error');
    } finally {
      setToolsSaving(false);
    }
  };

  // ── AI Models Management ──
  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const res = await fetch('/api/admin/models');
      if (res.ok) {
        const data = await res.json();
        setAiModels(data.models || []);
      }
    } catch {
      // silent
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchModels();
    }
  }, [user, fetchModels]);

  const openModelDialog = (model?: AIModelItem) => {
    if (model) {
      setEditingModel(model);
      setModelName(model.name);
      setModelId(model.modelId);
      setModelCategory(model.category);
      setModelDescription(model.description);
      setModelIsActive(model.isActive);
    } else {
      setEditingModel(null);
      setModelName('');
      setModelId('');
      setModelCategory('text');
      setModelDescription('');
      setModelIsActive(true);
    }
    setModelDialogOpen(true);
  };

  const handleSaveModel = async () => {
    if (!modelName.trim() || !modelId.trim()) {
      toast.error('Name and Model ID are required');
      return;
    }
    setModelSaving(true);
    try {
      const body = {
        name: modelName.trim(),
        modelId: modelId.trim(),
        category: modelCategory,
        description: modelDescription.trim(),
        isActive: modelIsActive,
      };
      const res = editingModel
        ? await fetch(`/api/admin/models/${editingModel._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/admin/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (res.ok) {
        toast.success(editingModel ? 'Model updated' : 'Model added');
        setModelDialogOpen(false);
        fetchModels();
      } else {
        toast.error(data.error || 'Failed to save model');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setModelSaving(false);
    }
  };

  const handleToggleModel = async (model: AIModelItem) => {
    try {
      const res = await fetch(`/api/admin/models/${model._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !model.isActive }),
      });
      if (res.ok) {
        toast.success(`${model.name} ${!model.isActive ? 'activated' : 'deactivated'}`);
        fetchModels();
      } else {
        toast.error('Failed to toggle model');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleDeleteModel = async () => {
    if (!deletingModel) return;
    setDeletingModelLoading(true);
    try {
      const res = await fetch(`/api/admin/models/${deletingModel._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Deleted ${deletingModel.name}`);
        setDeletingModel(null);
        fetchModels();
      } else {
        toast.error(data.error || 'Failed to delete model');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingModelLoading(false);
    }
  };

  const handleSeedModels = async () => {
    try {
      const res = await fetch('/api/admin/models/seed', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Models seeded');
        fetchModels();
      } else {
        toast.error(data.error || 'Failed to seed models');
      }
    } catch {
      toast.error('Network error');
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="shrink-0">
            <ChevronDown className="h-5 w-5 rotate-90" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
            </div>
            <p className="text-sm text-muted-foreground">Manage users, plans, and subscriptions</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/5' },
          { label: 'Pro Users', value: proUsers, icon: Crown, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Custom Plans', value: customUsers, icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/5' },
          { label: 'Expired Plans', value: expiredUsers, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/5' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{stat.value}</p>
                </div>
                <div className={cn('size-9 rounded-lg flex items-center justify-center', stat.bg)}>
                  <stat.icon className={cn('size-4', stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or email..."
              className="pl-10 h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── Tools Management ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="size-4" />
            Tools Management
            {toolsSaving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </CardTitle>
          <CardDescription>
            Enable or disable tools. Disabled tools are hidden from all users.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {toolsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading tools...</span>
            </div>
          ) : (
            <div className="divide-y">
              {/* YouTube Tool */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'size-9 rounded-lg flex items-center justify-center',
                    toolsConfig.youtube ? 'bg-red-500/10' : 'bg-muted/50'
                  )}>
                    <Youtube className={cn('size-4', toolsConfig.youtube ? 'text-red-500' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">YouTube</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {toolsConfig.youtube
                        ? 'Users can connect channels, view stats, and manage videos'
                        : 'YouTube page, sidebar item, and connect option are hidden'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={toolsConfig.youtube ? 'default' : 'secondary'} className="text-[10px]">
                    {toolsConfig.youtube ? 'Active' : 'Disabled'}
                  </Badge>
                  <Switch
                    checked={toolsConfig.youtube}
                    onCheckedChange={() => handleToggleTool('youtube')}
                    disabled={toolsSaving}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── AI Models Management ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="size-4" />
                AI Models
                <Badge variant="secondary" className="text-[10px]">{aiModels.length}</Badge>
              </CardTitle>
              <CardDescription>
                Manage text generation and voice AI models. Only active models are used in generation.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleSeedModels} disabled={modelsLoading}>
                <Sparkles className="size-3" />
                Seed Defaults
              </Button>
              <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => openModelDialog()}>
                <Plus className="size-3" />
                Add Model
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {modelsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading models...</span>
            </div>
          ) : aiModels.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <BrainCircuit className="size-8 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm text-muted-foreground">No AI models configured.</p>
                <p className="text-xs text-muted-foreground mt-1">Click &quot;Seed Defaults&quot; to add the default models.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {/* Text Models */}
              {aiModels.filter(m => m.category === 'text').length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/30">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="size-3" />
                      Text Generation Models
                    </p>
                  </div>
                  {aiModels.filter(m => m.category === 'text').map((model) => (
                    <div key={model._id} className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'size-9 rounded-lg flex items-center justify-center shrink-0',
                          model.isActive ? 'bg-blue-500/10' : 'bg-muted/50'
                        )}>
                          <Sparkles className={cn('size-4', model.isActive ? 'text-blue-500' : 'text-muted-foreground')} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{model.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{model.modelId}</p>
                          {model.description && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{model.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Badge variant={model.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {model.isActive ? 'Active' : 'Off'}
                        </Badge>
                        <Switch checked={model.isActive} onCheckedChange={() => handleToggleModel(model)} />
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openModelDialog(model)}>
                          <Edit3 className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => setDeletingModel(model)}>
                          <Trash className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {/* Voice Models */}
              {aiModels.filter(m => m.category === 'voice').length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/30">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Mic className="size-3" />
                      Voice (TTS) Models
                    </p>
                  </div>
                  {aiModels.filter(m => m.category === 'voice').map((model) => (
                    <div key={model._id} className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'size-9 rounded-lg flex items-center justify-center shrink-0',
                          model.isActive ? 'bg-purple-500/10' : 'bg-muted/50'
                        )}>
                          <Mic className={cn('size-4', model.isActive ? 'text-purple-500' : 'text-muted-foreground')} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{model.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{model.modelId}</p>
                          {model.description && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{model.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Badge variant={model.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {model.isActive ? 'Active' : 'Off'}
                        </Badge>
                        <Switch checked={model.isActive} onCheckedChange={() => handleToggleModel(model)} />
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openModelDialog(model)}>
                          <Edit3 className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => setDeletingModel(model)}>
                          <Trash className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add/Edit Model Dialog ── */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingModel ? 'Edit AI Model' : 'Add AI Model'}</DialogTitle>
            <DialogDescription>
              {editingModel ? 'Update the model configuration.' : 'Add a new AI model for text generation or voice synthesis.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Category</Label>
              <Select value={modelCategory} onValueChange={(v: string) => setModelCategory(v as 'text' | 'voice')}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="size-3.5" />
                      Text Generation
                    </div>
                  </SelectItem>
                  <SelectItem value="voice">
                    <div className="flex items-center gap-2">
                      <Mic className="size-3.5" />
                      Voice (TTS)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Display Name</Label>
              <Input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. Gemini 2.5 Flash"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Model ID</Label>
              <Input
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="e.g. gemini-2.5-flash"
                className="h-9 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                The exact model identifier used in the API call (e.g. gemini-2.5-flash, gemini-3.1-flash-tts-preview)
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Description</Label>
              <Input
                value={modelDescription}
                onChange={(e) => setModelDescription(e.target.value)}
                placeholder="Brief description of the model"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">Active</Label>
                <p className="text-[10px] text-muted-foreground">Only active models are used in generation</p>
              </div>
              <Switch checked={modelIsActive} onCheckedChange={setModelIsActive} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setModelDialogOpen(false)} className="text-sm">Cancel</Button>
            <Button onClick={handleSaveModel} disabled={modelSaving || !modelName.trim() || !modelId.trim()} className="text-sm gap-1.5">
              {modelSaving && <Loader2 className="size-3 animate-spin" />}
              {editingModel ? 'Update Model' : 'Add Model'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Model Confirmation ── */}
      <Dialog open={!!deletingModel} onOpenChange={() => setDeletingModel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Model</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingModel?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeletingModel(null)} className="text-sm">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteModel} disabled={deletingModelLoading} className="text-sm gap-1.5">
              {deletingModelLoading && <Loader2 className="size-3 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" />
            All Users
            <Badge variant="secondary" className="text-[10px]">{filteredUsers.length}</Badge>
          </CardTitle>
          <CardDescription>Click edit to change plans, add/reduce days, or set custom plans</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading users...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {search ? 'No users match your search.' : 'No users found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">User</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Days Left</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Custom</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Usage</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Joined</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <motion.tr
                      key={u.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{u.name}</span>
                            {u.role === 'admin' && (
                              <Badge className="text-[9px] px-1.5 py-0 h-4">Admin</Badge>
                            )}
                            {!u.isVerified && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">Unverified</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {u.plan === 'pro' ? (
                            <>
                              <Crown className="size-3.5 text-primary" />
                              <span className="font-medium text-primary">Pro</span>
                            </>
                          ) : (
                            <>
                              <Zap className="size-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Free</span>
                            </>
                          )}
                        </div>
                        {u.stripe?.subscriptionId && (
                          <span className="text-[10px] text-muted-foreground">Stripe</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.plan === 'pro' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={cn(
                              'text-sm font-semibold',
                              u.planDaysLeft <= 3 ? 'text-red-500' : u.planDaysLeft <= 7 ? 'text-amber-500' : 'text-foreground'
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
                        {u.isCustomPlan ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge className="text-[10px] gap-1 w-fit" variant="outline">
                              <Star className="size-2.5" />
                              {u.customPlan?.customLabel || 'Custom'}
                            </Badge>
                            {u.customPlan?.customDays > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {u.customPlan.customDays}d plan
                              </span>
                            )}
                          </div>
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
                            className="size-7 text-blue-500 hover:text-blue-500"
                            title="Send notification"
                            onClick={() => { setNotifyUser(u); setNotifTitle(''); setNotifMessage(''); setNotifType('info'); }}
                          >
                            <Bell className="size-3" />
                          </Button>
                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Edit user"
                            onClick={() => openEdit(u)}
                          >
                            <Edit3 className="size-3" />
                          </Button>
                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            title="Delete user"
                            onClick={() => setDeleteUser(u)}
                            disabled={u.role === 'admin'}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── Edit User Dialog ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-4" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              Modify plan, days, or set custom plan for {editUser?.name}
            </DialogDescription>
          </DialogHeader>

          {editUser && (
            <div className="space-y-4 py-2">
              {/* ── Current Info ── */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-xs">{editUser.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Plan</span>
                  <span className="font-medium">{editUser.plan === 'pro' ? 'Pro' : 'Free'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Days Remaining</span>
                  <span className={cn('font-semibold', editUser.planDaysLeft <= 3 ? 'text-red-500' : 'text-foreground')}>
                    {editUser.plan === 'pro' ? `${editUser.planDaysLeft} days` : '—'}
                  </span>
                </div>
                {editUser.planExpiresAt > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expires On</span>
                    <span className="text-xs">{formatExpiryDate(editUser.planExpiresAt)}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* ── Plan Selector ── */}
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
                        Pro
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Days Editing Section (hidden when plan is Free) ── */}
              {editPlan === 'pro' && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="size-4 text-primary" />
                    Plan Duration
                  </div>

                  {/* Mode selector: Add / Reduce / Set */}
                  <div className="flex items-center gap-1">
                    {([
                      { mode: 'add' as DaysEditMode, label: 'Add', icon: Plus, color: 'text-green-600' },
                      { mode: 'reduce' as DaysEditMode, label: 'Reduce', icon: Minus, color: 'text-red-500' },
                      { mode: 'set' as DaysEditMode, label: 'Set Exact', icon: Settings, color: 'text-blue-500' },
                    ]).map(({ mode, label, icon: Icon, color }) => (
                      <Button
                        key={mode}
                        variant={daysEditMode === mode ? 'default' : 'outline'}
                        size="sm"
                        className={cn('gap-1 text-xs', daysEditMode !== mode && 'text-muted-foreground')}
                        onClick={() => { setDaysEditMode(mode); setDaysValue(0); }}
                      >
                        <Icon className={cn('size-3', daysEditMode === mode ? color : '')} />
                        {label}
                      </Button>
                    ))}
                  </div>

                  {/* Days value input with +/- buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => setDaysValue(Math.max(0, daysValue - (daysEditMode === 'set' ? 1 : 7)))}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      max={daysEditMode === 'set' ? 365 : 365}
                      value={daysValue}
                      onChange={(e) => setDaysValue(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-24 text-center"
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => setDaysValue(Math.min(365, daysValue + (daysEditMode === 'set' ? 1 : 7)))}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>

                  {/* Description text per mode */}
                  <p className="text-[11px] text-muted-foreground">
                    {daysEditMode === 'add' && 'Add days to the current expiry. If expired, starts from today.'}
                    {daysEditMode === 'reduce' && 'Reduce days from the current expiry. Will not go below today.'}
                    {daysEditMode === 'set' && 'Set the exact number of days from today. Replaces current expiry.'}
                  </p>

                  {/* Quick preset buttons */}
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

              {/* ── Custom Plan Toggle ── */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Star className="size-3.5 text-amber-500" />
                  Custom Plan
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    variant={editIsCustom ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setEditIsCustom(true); if (editPlan !== 'pro') setEditPlan('pro'); }}
                  >
                    <Check className="size-3 mr-1" />
                    Yes
                  </Button>
                  <Button
                    variant={!editIsCustom ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEditIsCustom(false)}
                  >
                    <X className="size-3 mr-1" />
                    No
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, custom plan days take priority over regular add/reduce/set days.
                </p>
              </div>

              {/* ── Custom Plan Details ── */}
              <AnimatePresence>
                {editIsCustom && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <Star className="size-3.5" />
                        Custom Plan Configuration
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium">Plan Label</label>
                        <Input
                          placeholder="e.g. Team Plan, Agency Plan, VIP"
                          value={editCustomLabel}
                          onChange={(e) => setEditCustomLabel(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium">Custom Duration (days)</label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={() => setEditCustomDays(Math.max(0, editCustomDays - 1))}
                          >
                            <Minus className="size-3" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            max={365}
                            value={editCustomDays}
                            onChange={(e) => setEditCustomDays(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-24 text-center"
                          />
                          <span className="text-xs text-muted-foreground">days</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={() => setEditCustomDays(Math.min(365, editCustomDays + 1))}
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70">
                          This will set the plan expiry to exactly this many days from now, overriding any other day changes.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Live Preview ── */}
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
                  {editIsCustom && editCustomDays > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Custom</span>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Star className="size-2.5" />
                        {editCustomLabel || 'Custom'} ({editCustomDays}d)
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* ── Role ── */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
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
      {/* ── Delete Confirm Dialog ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All data for this user will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          {deleteUser && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <p className="text-sm font-medium">{deleteUser.name}</p>
              <p className="text-xs text-muted-foreground">{deleteUser.email}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Delete
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
              {/* Recipient */}
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

              {/* Notification Type */}
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

              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="e.g. Welcome to Pro!"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Message */}
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
