'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Film, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: 'Google sign-in is not configured.',
  oauth_failed: 'Google sign-in was cancelled or failed.',
  missing_params: 'Invalid OAuth response.',
  invalid_state: 'Security check failed. Please try again.',
  token_exchange_failed: 'Failed to authenticate with Google.',
  no_id_token: 'Failed to get your info from Google.',
  no_email: 'Could not retrieve your email from Google.',
  server_error: 'An unexpected error occurred.',
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Read OAuth error from URL without useSearchParams (avoids hydration crash)
  const [oauthError, setOauthError] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setOauthError(OAUTH_ERROR_MESSAGES[err] || 'Authentication failed.');
      // Clean URL
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      toast.success('Welcome back!');
      router.push('/');
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/google';
  };

  const displayError = error || oauthError || '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Back to landing */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-2.5 mb-8">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
            <Film className="size-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">ScriptForge</span>
        </div>

        <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
        <p className="text-sm text-muted-foreground mb-6">Sign in to continue to your projects</p>

        {displayError && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {displayError}
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <svg className="size-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or sign in with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <button
            onClick={() => router.push('/register')}
            className="text-primary font-medium hover:underline"
          >
            Sign up
          </button>
        </p>
      </motion.div>
    </div>
  );
}