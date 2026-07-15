'use client';

import { useState } from 'react';
import { Mail, ArrowLeft, Loader2, RefreshCw, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';

type VerificationStatus = 'idle' | 'sending' | 'sent' | 'error';

export default function VerifyEmailPending({ email, onBack }: { email: string; onBack: () => void }) {
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const { setPendingVerificationEmail } = useAuthStore();

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);

  const handleResend = async () => {
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to send email');
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-background p-8 shadow-lg text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-8 text-primary" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight mb-2">Check your email</h1>
          <p className="text-muted-foreground mb-1">
            We sent a verification link to
          </p>
          <p className="font-medium text-foreground mb-6">{maskedEmail}</p>

          {status === 'sent' ? (
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 mb-6">
              <div className="flex items-center justify-center gap-2 text-green-600 text-sm">
                <CheckCircle className="size-4" />
                New verification email sent!
              </div>
            </div>
          ) : status === 'error' ? (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 mb-6">
              <div className="flex items-center justify-center gap-2 text-destructive text-sm">
                <AlertCircle className="size-4" />
                {errorMsg}
              </div>
            </div>
          ) : null}

          <p className="text-sm text-muted-foreground mb-6">
            Click the link in the email to verify your account. The link expires in 24 hours.
            Make sure to check your spam folder.
          </p>

          <Button
            variant="outline"
            className="w-full mb-3 gap-2"
            onClick={handleResend}
            disabled={status === 'sending'}
          >
            {status === 'sending' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {status === 'sending' ? 'Sending...' : 'Resend Verification Email'}
          </Button>

          <Button
            variant="ghost"
            className="w-full gap-2"
            onClick={() => {
              setPendingVerificationEmail(null);
              onBack();
            }}
          >
            <ArrowLeft className="size-4" />
            Back to Sign In
          </Button>
        </div>
      </div>
    </div>
  );
}

export function VerifyEmailResult({ result }: { result: 'success' | 'expired' | 'invalid' | 'error'; msg?: string }) {
  const { setPendingVerificationEmail } = useAuthStore();

  const configs = {
    success: {
      icon: CheckCircle,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      title: 'Email Verified!',
      description: 'Your account has been verified successfully. You can now sign in.',
    },
    expired: {
      icon: XCircle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      title: 'Link Expired',
      description: 'This verification link has expired. Please request a new one.',
    },
    invalid: {
      icon: XCircle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      title: 'Invalid Link',
      description: 'This verification link is invalid or has already been used.',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      title: 'Verification Failed',
      description: msg || 'Something went wrong. Please try again.',
    },
  };

  const config = configs[result];
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-background p-8 shadow-lg text-center">
          <div className={`mx-auto mb-6 flex size-16 items-center justify-center rounded-full ${config.bg}`}>
            <Icon className={`size-8 ${config.color}`} />
          </div>

          <h1 className="text-2xl font-bold tracking-tight mb-2">{config.title}</h1>
          <p className="text-muted-foreground mb-8">{config.description}</p>

          <Button
            className="w-full"
            onClick={() => {
              setPendingVerificationEmail(null);
              window.location.href = '/';
            }}
          >
            Go to Sign In
          </Button>
        </div>
      </div>
    </div>
  );
}