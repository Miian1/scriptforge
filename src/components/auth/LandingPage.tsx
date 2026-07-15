'use client';

import React, { useState } from 'react';
import { Film, Sparkles, Layers, Zap, ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';

const features = [
  {
    icon: Sparkles,
    title: 'AI-Powered Scripting',
    description: 'Generate complete scene-by-scene scripts with narration, image prompts, and animation directions using Google Gemini AI.',
  },
  {
    icon: Layers,
    title: 'Scene-by-Scene Breakdown',
    description: 'Each scene includes narration text, visual prompts for image generation, and detailed animation instructions.',
  },
  {
    icon: Zap,
    title: 'Instant Generation',
    description: 'Transform a video idea into a production-ready script in seconds. Supports 10 languages and multiple writing styles.',
  },
];

const steps = [
  'Describe your video idea and settings',
  'AI generates a full scene-by-scene script',
  'Edit, reorder, and refine each scene',
  'Export your production-ready script',
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
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
              <Film className="size-5 text-primary-foreground" />
            </div>
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
              <Sparkles className="size-3.5" />
              Powered by Google Gemini AI
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Transform Ideas into{' '}
              <span className="text-primary">Production Scripts</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
              ScriptForge uses AI to generate complete scene-by-scene YouTube scripts with
              narration, image prompts, and animation directions — ready for production.
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
            <p className="text-muted-foreground text-lg">Four simple steps to your production-ready script</p>
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
            <p className="text-muted-foreground text-lg">Powerful features to streamline your video production workflow</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
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
          <h2 className="text-3xl font-bold tracking-tight mb-3">Ready to Create Your Script?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join ScriptForge and transform your video ideas into production-ready scripts.
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
            <Film className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">ScriptForge v1.0</span>
          </div>
          <p className="text-xs text-muted-foreground">
            AI-powered YouTube script generation agent
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
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
                <Film className="size-5 text-primary-foreground" />
              </div>
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