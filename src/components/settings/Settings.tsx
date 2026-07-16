'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, ShieldCheck, Youtube, Unplug, Loader2, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { AppSettings } from '@/lib/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);
  const { user } = useAuthStore();
  const { setTheme: applyTheme, theme: nextTheme } = useTheme();

  // Active theme selection = next-themes value (single source of truth)
  const activeTheme = nextTheme ?? 'system';

  const isAdmin = user?.role === 'admin';
  const ytConnected = user?.youtubeConnected === true;

  // YouTube connection states
  const [ytLoading, setYtLoading] = useState(false);
  const [ytChannelName, setYtChannelName] = useState<string | null>(null);

  // Load settings & fetch YouTube channel name
  useEffect(() => {
    setMounted(true);
    setSettings(loadSettings());
    if (ytConnected) {
      fetch('/api/youtube/channel')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => data?.channel?.title && setYtChannelName(data.channel.title))
        .catch(() => {});
    }
  }, [ytConnected]);

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

  // Theme: update both next-themes and localStorage immediately
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    applyTheme(newTheme);
    // Persist immediately (no debounce for theme)
    const next = { ...settings, theme: newTheme };
    setSettings(next);
    persistSettings(next);
  };

  // YouTube connect
  const handleConnectYouTube = () => {
    setYtLoading(true);
    window.location.href = '/api/youtube/auth';
  };

  // YouTube disconnect
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6"
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

      {/* YouTube Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Youtube className="size-5 text-red-500" />
            YouTube Channel
          </CardTitle>
          <CardDescription>Connect or disconnect your YouTube channel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
    </motion.div>
  );
}