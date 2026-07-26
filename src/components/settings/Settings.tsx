'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Shield, ShieldCheck, Youtube, Unplug, Loader2, ExternalLink, CheckCircle2, AlertTriangle, Palette, Pen, Eye, Globe, Users, FileText, Radio, Edit3, Plus, Trash2, UserCircle, Sparkles } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { AppSettings } from '@/lib/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuthStore, type AuthChannelCharacter } from '@/lib/auth-store';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  autoSave: true,
};

const SETTINGS_KEY = 'scriptforge_settings';

const THEME_OPTIONS = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'system' as const, label: 'System', icon: Monitor },
];

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

function persistSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

function Sun(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function Moon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function Monitor(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

interface NicheFormData {
  visualTheme: string;
  writingStyle: string;
  audience: string;
  language: string;
  description: string;
  channelName: string;
  channelDescription: string;
  channelCategory: string;
  channelUrl: string;
  characters: AuthChannelCharacter[];
}

const EMPTY_NICHE: NicheFormData = {
  visualTheme: '',
  writingStyle: '',
  audience: '',
  language: '',
  description: '',
  channelName: '',
  channelDescription: '',
  channelCategory: '',
  channelUrl: '',
  characters: [],
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);
  const { user, checkSession } = useAuthStore();
  const { setTheme: applyTheme, theme: nextTheme } = useTheme();
  const { tools, loadTools } = useAppStore();

  const activeTheme = nextTheme ?? 'system';
  const isAdmin = user?.role === 'admin';
  const ytConnected = user?.youtubeConnected === true;

  // YouTube connection states
  const [ytLoading, setYtLoading] = useState(false);
  const [ytChannelName, setYtChannelName] = useState<string | null>(null);

  // Niche dialog
  const [nicheOpen, setNicheOpen] = useState(false);
  const [nicheSaving, setNicheSaving] = useState(false);
  const [nicheForm, setNicheForm] = useState<NicheFormData>(EMPTY_NICHE);

  // Current niche data (from user object)
  const currentNiche = user?.channelNiche;

  // Count filled niche fields
  const filledFields = currentNiche
    ? [currentNiche.visualTheme, currentNiche.writingStyle, currentNiche.audience, currentNiche.language, currentNiche.description, currentNiche.channelName, currentNiche.channelCategory].filter(Boolean).length
    : 0;

  const hasNiche = filledFields > 0;

  // Load settings & fetch YouTube channel name
  useEffect(() => {
    setMounted(true);
    setSettings(loadSettings());
    loadTools();
    if (ytConnected) {
      fetch('/api/youtube/channel')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => data?.channel?.title && setYtChannelName(data.channel.title))
        .catch(() => {});
    }
  }, [ytConnected, loadTools]);

  const autoPersist = useCallback(
    (newSettings: AppSettings) => {
      if (!newSettings.autoSave) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        persistSettings(newSettings);
      }, 500);
    },
    []
  );

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        autoPersist(next);
        return next;
      });
    },
    [autoPersist]
  );

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    applyTheme(newTheme);
    const next = { ...settings, theme: newTheme };
    setSettings(next);
    persistSettings(next);
  };

  const handleConnectYouTube = () => {
    setYtLoading(true);
    window.location.href = '/api/youtube/auth';
  };

  const handleDisconnectYouTube = async () => {
    setYtLoading(true);
    try {
      const res = await fetch('/api/youtube/disconnect', { method: 'POST' });
      if (res.ok) {
        setYtChannelName(null);
        useAuthStore.getState().checkSession();
        toast.success('YouTube channel disconnected');
      } else {
        toast.error('Failed to disconnect');
      }
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setYtLoading(false);
    }
  };

  // Open niche editor — pre-fill from current data
  const openNicheEditor = () => {
    setNicheForm({
      visualTheme: currentNiche?.visualTheme || '',
      writingStyle: currentNiche?.writingStyle || '',
      audience: currentNiche?.audience || '',
      language: currentNiche?.language || '',
      description: currentNiche?.description || '',
      channelName: currentNiche?.channelName || '',
      channelDescription: currentNiche?.channelDescription || '',
      channelCategory: currentNiche?.channelCategory || '',
      channelUrl: currentNiche?.channelUrl || '',
      characters: Array.isArray(currentNiche?.characters)
        ? currentNiche.characters.map((c) => ({
            id: c.id || `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: c.name || '',
            role: c.role || '',
            description: c.description || '',
            visualPrompt: c.visualPrompt || '',
            personalityPrompt: c.personalityPrompt || '',
          }))
        : [],
    });
    setNicheOpen(true);
  };

  // Save niche
  const handleSaveNiche = async () => {
    setNicheSaving(true);
    try {
      const res = await fetch('/api/channel-niche', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nicheForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Channel niche saved');
        setNicheOpen(false);
        checkSession();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setNicheSaving(false);
    }
  };

  const updateNicheField = (key: keyof NicheFormData, value: string) => {
    setNicheForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Channel Characters helpers ──
  // Each character is a recurring persona the AI can use when generating
  // scene image prompts, narration, and animation prompts.
  const addCharacter = () => {
    setNicheForm((prev) => ({
      ...prev,
      characters: [
        ...prev.characters,
        {
          id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: '',
          role: '',
          description: '',
          visualPrompt: '',
          personalityPrompt: '',
        },
      ],
    }));
  };

  const updateCharacter = (id: string, patch: Partial<AuthChannelCharacter>) => {
    setNicheForm((prev) => ({
      ...prev,
      characters: prev.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const removeCharacter = (id: string) => {
    setNicheForm((prev) => ({
      ...prev,
      characters: prev.characters.filter((c) => c.id !== id),
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6"
    >
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>
        <p className="text-muted-foreground">Configure your application preferences</p>
      </div>

      <Separator />

      {/* Account info */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{user.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <div className="pt-1">
              <Badge variant={isAdmin ? 'default' : 'secondary'} className="gap-1.5">
                {isAdmin ? <ShieldCheck className="size-3.5" /> : <Shield className="size-3.5" />}
                {isAdmin ? 'Admin' : user.plan === 'pro' ? 'Pro' : 'Free'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* Channel Niche & Style — ALWAYS visible, even when YouTube is disabled */}
      {/* The niche is a per-user setting used by AI script generation and */}
      {/* does not require a connected YouTube channel. */}
      {/* ══════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="size-5 text-primary" />
                Channel Niche &amp; Style
              </CardTitle>
              <CardDescription>
                Define your channel&apos;s visual theme, writing style, audience, and language so AI generates scripts tailored to your brand
              </CardDescription>
            </div>
            {hasNiche && (
              <Badge variant="outline" className="text-[10px] gap-1 text-primary border-primary/30">
                <Palette className="size-2.5" />
                {filledFields} niche fields set
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Palette className="size-4 text-primary" />
                Niche Profile
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={openNicheEditor}
              >
                <Edit3 className="size-3.5" />
                {hasNiche ? 'Edit Niche' : 'Set Up Niche'}
              </Button>
            </div>

            {hasNiche ? (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentNiche?.channelName && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Radio className="size-3" /> Channel
                      </p>
                      <p className="text-sm font-medium">{currentNiche.channelName}</p>
                    </div>
                  )}
                  {currentNiche?.channelCategory && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <FileText className="size-3" /> Category
                      </p>
                      <p className="text-sm font-medium">{currentNiche.channelCategory}</p>
                    </div>
                  )}
                  {currentNiche?.visualTheme && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Eye className="size-3" /> Visual Theme
                      </p>
                      <p className="text-sm">{currentNiche.visualTheme}</p>
                    </div>
                  )}
                  {currentNiche?.writingStyle && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Pen className="size-3" /> Writing Style
                      </p>
                      <p className="text-sm">{currentNiche.writingStyle}</p>
                    </div>
                  )}
                  {currentNiche?.audience && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Users className="size-3" /> Audience
                      </p>
                      <p className="text-sm">{currentNiche.audience}</p>
                    </div>
                  )}
                  {currentNiche?.language && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Globe className="size-3" /> Language
                      </p>
                      <p className="text-sm">{currentNiche.language}</p>
                    </div>
                  )}
                </div>
                {currentNiche?.description && (
                  <div className="pt-1">
                    <p className="text-[11px] text-muted-foreground mb-1">Niche Description</p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{currentNiche.description}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
                <Palette className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No Channel Niche Set</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Define your channel&apos;s visual theme, writing style, audience, and language so AI generates scripts tailored to your brand.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={openNicheEditor}
                >
                  <Edit3 className="size-3.5" />
                  Set Up Your Niche
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════ */}
      {/* YouTube Channel Connection — only visible when YouTube tool is enabled */}
      {/* Admins always see this section (for testing/management), even if disabled. */}
      {/* ══════════════════════════════════════════════════════ */}
      {(isAdmin || (tools && tools.youtube)) && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Youtube className="size-5 text-red-500" />
                YouTube Channel
              </CardTitle>
              <CardDescription>Connect your channel to view stats and manage videos</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          {ytConnected ? (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="size-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Channel Connected</p>
                  {ytChannelName && (
                    <p className="text-sm text-muted-foreground truncate">{ytChannelName}</p>
                  )}
                </div>
                <a
                  href="https://studio.youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <ExternalLink className="size-3.5" />
                    YouTube Studio
                  </Button>
                </a>
              </div>
              <Button
                variant="outline"
                onClick={handleDisconnectYouTube}
                disabled={ytLoading}
                className="w-full gap-2 text-destructive hover:text-destructive"
              >
                {ytLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Unplug className="size-4" />
                )}
                Disconnect YouTube Channel
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                  <AlertTriangle className="size-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Not Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Connect your YouTube channel to view stats, manage videos, and use AI features
                  </p>
                </div>
              </div>
              <Button
                onClick={handleConnectYouTube}
                disabled={ytLoading}
                className="w-full gap-2"
              >
                {ytLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Youtube className="size-4" />
                )}
                Connect YouTube Channel
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appearance</CardTitle>
          <CardDescription>Customize the look and feel of the application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = mounted && activeTheme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleThemeChange(option.value)}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-muted bg-background text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-save">Auto Save</Label>
              <p className="text-sm text-muted-foreground">
                Automatically save changes to local storage
              </p>
            </div>
            <Switch
              id="auto-save"
              checked={settings.autoSave}
              onCheckedChange={(checked) => updateSettings({ autoSave: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════ */}
      {/* Edit Channel Niche Dialog */}
      {/* ══════════════════════════════════════════════════════ */}
      <Dialog open={nicheOpen} onOpenChange={setNicheOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="size-4" />
              Channel Niche & Style
            </DialogTitle>
            <DialogDescription>
              Define your channel&apos;s identity so AI creates content tailored to your brand.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Channel Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Radio className="size-3.5 text-red-500" />
                Channel Details
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Channel Name</Label>
                <Input
                  placeholder="e.g. TechWithAli"
                  value={nicheForm.channelName}
                  onChange={(e) => updateNicheField('channelName', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Channel Category</Label>
                <Input
                  placeholder="e.g. Technology, Education, Gaming, Cooking"
                  value={nicheForm.channelCategory}
                  onChange={(e) => updateNicheField('channelCategory', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Channel URL</Label>
                <Input
                  placeholder="https://youtube.com/@yourchannel"
                  value={nicheForm.channelUrl}
                  onChange={(e) => updateNicheField('channelUrl', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Channel Description</Label>
                <Textarea
                  placeholder="Describe your YouTube channel, what kind of content you create, your upload schedule, and what makes your channel unique..."
                  rows={3}
                  value={nicheForm.channelDescription}
                  onChange={(e) => updateNicheField('channelDescription', e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Niche & Style */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Palette className="size-3.5 text-primary" />
                Niche & Style
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Eye className="size-3" /> Visual Theme
                </Label>
                <Textarea
                  placeholder="e.g. Cinematic dark tones with warm lighting, professional thumbnails with bold white text, minimal backgrounds with vibrant accent colors"
                  rows={2}
                  value={nicheForm.visualTheme}
                  onChange={(e) => updateNicheField('visualTheme', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Pen className="size-3" /> Writing Style
                </Label>
                <Textarea
                  placeholder="e.g. Casual and energetic, uses humor and relatable analogies, speaks directly to the viewer with 'you' language, includes pop culture references"
                  rows={2}
                  value={nicheForm.writingStyle}
                  onChange={(e) => updateNicheField('writingStyle', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Users className="size-3" /> Target Audience
                </Label>
                <Textarea
                  placeholder="e.g. Tech-savvy millennials and Gen Z viewers aged 18-35 interested in AI tools, productivity, and software development"
                  rows={2}
                  value={nicheForm.audience}
                  onChange={(e) => updateNicheField('audience', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Globe className="size-3" /> Language
                </Label>
                <Input
                  placeholder="e.g. English (US), Urdu, Hindi, Spanish"
                  value={nicheForm.language}
                  onChange={(e) => updateNicheField('language', e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Niche Description (the big one) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <FileText className="size-3" /> Detailed Niche Description
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Write as much detail as you want. Describe your niche, content pillars, tone, values, topics you cover, what makes you unique. The AI will use this to generate perfectly tailored scripts.
              </p>
              <Textarea
                placeholder="e.g. My channel focuses on reviewing and demonstrating AI tools for content creators. I cover topics like ChatGPT prompts, AI video generation, automation workflows, and productivity hacks. My content pillars are: 1) Tool Reviews - hands-on testing of new AI tools 2) Tutorials - step-by-step guides 3) News & Trends - covering latest AI developments 4) Comparisons - pitting tools against each other. My tone is friendly yet authoritative. I value practical, actionable content over hype. Viewers come to my channel to learn real skills they can apply immediately..."
                rows={8}
                className="min-h-[160px]"
                value={nicheForm.description}
                onChange={(e) => updateNicheField('description', e.target.value)}
              />
            </div>

            <Separator />

            {/* ── Channel Characters ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <UserCircle className="size-4 text-primary" />
                  Channel Characters
                  {nicheForm.characters.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {nicheForm.characters.length}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addCharacter}
                  disabled={nicheForm.characters.length >= 30}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="size-3" />
                  Add Character
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Define recurring characters (hosts, narrators, experts, animated mascots) that
                the AI can reference when generating scene image prompts, narration voice, and
                animation. Each character&apos;s visual prompt and personality will be matched
                to your channel style automatically.
              </p>

              {nicheForm.characters.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <UserCircle className="size-6 mx-auto text-muted-foreground/40 mb-1.5" />
                  <p className="text-xs text-muted-foreground">
                    No characters yet. Add a host, a narrator, or a recurring guest persona.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {nicheForm.characters.map((char, idx) => (
                    <div
                      key={char.id}
                      className="rounded-lg border bg-card/50 p-3 space-y-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <div className="shrink-0 mt-1.5 size-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </div>
                        <div className="flex-1 grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</Label>
                            <Input
                              placeholder="e.g. Dr. Nova, The Curious Kid"
                              value={char.name}
                              onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Role</Label>
                            <Input
                              placeholder="e.g. Host, Narrator, Expert, Mascot"
                              value={char.role}
                              onChange={(e) => updateCharacter(char.id, { role: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeCharacter(char.id)}
                          className="shrink-0 size-7 text-muted-foreground hover:text-destructive"
                          aria-label="Remove character"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <FileText className="size-2.5" /> Description / Metadata
                        </Label>
                        <Textarea
                          placeholder="Appearance, age, vibe, backstory, signature traits, outfit, accent..."
                          rows={2}
                          value={char.description}
                          onChange={(e) => updateCharacter(char.id, { description: e.target.value })}
                          className="text-xs"
                        />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Eye className="size-2.5" /> Visual Prompt
                          </Label>
                          <Textarea
                            placeholder="e.g. 30-year-old woman with curly hair, lab coat, warm smile, cinematic lighting"
                            rows={2}
                            value={char.visualPrompt}
                            onChange={(e) => updateCharacter(char.id, { visualPrompt: e.target.value })}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Sparkles className="size-2.5" /> Personality Prompt
                          </Label>
                          <Textarea
                            placeholder="e.g. speaks with enthusiasm, asks rhetorical questions, uses analogies from everyday life"
                            rows={2}
                            value={char.personalityPrompt}
                            onChange={(e) => updateCharacter(char.id, { personalityPrompt: e.target.value })}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNicheOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveNiche} disabled={nicheSaving}>
              {nicheSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save Niche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════ */}
      {/* Legal Links */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-center gap-4 py-4 text-xs text-muted-foreground">
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          Privacy Policy
        </a>
        <span className="text-border">·</span>
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          Terms of Service
        </a>
      </div>
    </motion.div>
  );
}
