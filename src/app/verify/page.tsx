'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

type VerifyState = 'loading' | 'success' | 'expired' | 'invalid' | 'error';

export default function VerifyPage() {
  const [state, setState] = useState<VerifyState>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Use window.location.search — NOT useSearchParams() which breaks Next.js 16 + Turbopack
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setState('invalid');
      setErrorMsg('No verification token found in the URL.');
      return;
    }

    // Call the verification API
    fetch(`/api/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();

        if (res.ok && data.success) {
          setState('success');
          // Auto-redirect to dashboard after a brief moment
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } else if (res.status === 410) {
          setState('expired');
          setErrorMsg(data.error || 'This link has expired.');
        } else {
          setState('invalid');
          setErrorMsg(data.error || 'Invalid verification link.');
        }
      })
      .catch(() => {
        setState('error');
        setErrorMsg('Network error. Please check your connection and try again.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-background p-8 shadow-lg text-center">

          {/* Loading state */}
          {state === 'loading' && (
            <>
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="size-8 text-primary animate-spin" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Verifying your email...</h1>
              <p className="text-muted-foreground">Please wait while we verify your email address.</p>
            </>
          )}

          {/* Success state */}
          {state === 'success' && (
            <>
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="size-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2 text-green-600">Email verified!</h1>
              <p className="text-muted-foreground">Redirecting you to the dashboard...</p>
            </>
          )}

          {/* Expired state */}
          {state === 'expired' && (
            <>
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-amber-500/10">
                <Clock className="size-8 text-amber-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Link expired</h1>
              <p className="text-muted-foreground mb-6">{errorMsg}</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { window.location.href = '/'; }}
              >
                Go to Sign In
              </Button>
            </>
          )}

          {/* Invalid token state */}
          {state === 'invalid' && (
            <>
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Invalid link</h1>
              <p className="text-muted-foreground mb-6">{errorMsg}</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { window.location.href = '/'; }}
              >
                Go to Sign In
              </Button>
            </>
          )}

          {/* Network error state */}
          {state === 'error' && (
            <>
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Something went wrong</h1>
              <p className="text-muted-foreground mb-6">{errorMsg}</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { window.location.href = '/'; }}
              >
                Go to Sign In
              </Button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}