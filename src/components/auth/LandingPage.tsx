'use client';

import React, { useState } from 'react';
import { Sparkles, Layers, Zap, Youtube, MessageSquare, Wand2, ArrowRight, Play, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/auth-store';

const features = [
  {
    icon: Sparkles,
    title: 'AI Script Generation',
    description: 'Generate complete scene-by-scene scripts with narration, image prompts, and animation directions using Google Gemini AI.',
  },
  {
    icon: Youtube,
    title: 'YouTube Channel Connect',
    description: 'Connect your YouTube channel to view real-time stats, browse recent videos, and manage everything from your dashboard.',
  },
  {
    icon: MessageSquare,
    title: 'AI Comment Replies',
    description: 'Generate smart, contextual replies to your video comments and post them directly to YouTube with a single click.',
  },
  {
    icon: Wand2,
    title: 'Video Metadata AI',
    description: 'AI-powered description and tag improvement. Get optimized SEO metadata and apply it to your videos instantly.',
  },
  {
    icon: Layers,
    title: 'Scene-by-Scene Editor',
    description: 'Full editing with drag-and-drop reordering, individual scene regeneration, and production-ready script export.',
  },
  {
    icon: BarChart3,
    title: 'Channel Analytics',
    description: 'View subscriber count, total views, video count, and per-video performance metrics right on your dashboard.',
  },
];

const steps = [
  'Connect your YouTube channel',
  'Describe your video idea and settings',
  'AI generates a full scene-by-scene script',
  'Edit, refine, and export your production-ready script',
];

export default function LandingPage() {
  const { login, register, setPendingVerificationEmail } = useAuthStore();
  const [showAuth, setShowAuth] = useState<'login' | 'register' | null>(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setAuthError('');
  };

  const openAuth = (mode: 'login' | 'register') => {
    resetForm();
    setShowAuth(mode);
  };

  const closeAuth = () => {
    resetForm();
    setShowAuth(null);
  };

  const switchMode = (mode: 'login' | 'register') => {
    resetForm();
    setShowAuth(mode);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (showAuth === 'login') {
        const result = await login(email, password);
        if (result.error) {
          if (result.requiresVerification && result.email) {
            setPendingVerificationEmail(result.email);
            setShowAuth(null);
          } else {
            setAuthError(result.error);
          }
          setAuthLoading(false);
        }
      } else {
        const result = await register(name, email, password);
        if (result.error) {
          setAuthError(result.error);
          setAuthLoading(false);
        }
        setShowAuth(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setAuthError(msg);
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="ScriptForge" className="size-8 rounded-lg" />
            <span className="text-lg font-bold tracking-tight">ScriptForge</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => openAuth('login')}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => openAuth('register')}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
              <Youtube className="size-3.5" />
              AI-Powered YouTube Scripting Agent
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Your AI YouTube{' '}
              <span className="text-primary">Content Studio</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
              Generate production-ready scripts, improve video metadata, reply to comments with AI,
              and manage your entire YouTube channel from one dashboard.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="w-full sm:w-auto gap-2" onClick={() => openAuth('register')}>
                Start Creating — Free
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2" onClick={() => openAuth('login')}>
                <Play className="size-4" />
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">How It Works</h2>
            <p className="text-muted-foreground text-lg">Four simple steps to production-ready content</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div
                key={i}
                className="relative flex flex-col items-center text-center p-6 rounded-xl border border-border bg-background"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-4">
                  {i + 1}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground/40" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Everything You Need</h2>
            <p className="text-muted-foreground text-lg">Powerful tools to streamline your entire YouTube workflow</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="size-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-3">Ready to Supercharge Your YouTube?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join ScriptForge and transform your video ideas into production-ready scripts with AI.
          </p>
          <Button size="lg" className="gap-2" onClick={() => openAuth('register')}>
            Get Started for Free
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="ScriptForge" className="size-4 rounded" />
            <span className="text-sm text-muted-foreground">ScriptForge v1.0</span>
          </div>
          <p className="text-xs text-muted-foreground">
            AI-powered YouTube scripting agent
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeAuth}
          />
          <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <button
              onClick={closeAuth}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-2.5 mb-6">
              <img src="/logo.svg" alt="ScriptForge" className="size-8 rounded-lg" />
              <span className="text-lg font-bold tracking-tight">ScriptForge</span>
            </div>

            <h2 className="text-xl font-semibold mb-1">
              {showAuth === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {showAuth === 'login'
                ? 'Sign in to continue to your projects'
                : 'Get started with ScriptForge for free'}
            </p>

            {authError && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {authError}
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={() => { window.location.href = '/api/auth/google'; }}
              disabled={authLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <svg className="size-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {showAuth === 'login' ? 'or sign in with email' : 'or sign up with email'}
                </span>
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {showAuth === 'register' && (
                <div>
                  <label htmlFor="auth-name" className="block text-sm font-medium mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              )}
              <div>
                <label htmlFor="auth-email" className="block text-sm font-medium mb-1.5">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <label htmlFor="auth-password" className="block text-sm font-medium mb-1.5">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={showAuth === 'login' ? 'Enter your password' : 'Min. 6 characters'}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <Button type="submit" className="w-full" disabled={authLoading}>
                {authLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {showAuth === 'login' ? 'Signing in...' : 'Creating account...'}
                  </span>
                ) : (
                  showAuth === 'login' ? 'Sign In' : 'Create Account'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {showAuth === 'login' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="text-primary font-medium hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-primary font-medium hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}