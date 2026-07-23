'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Crown, ArrowLeft, Loader2, CreditCard, MessageCircle, Banknote, Phone, AlertTriangle, CalendarClock, RefreshCw, ShieldCheck, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/auth-store';
import { PLAN_LIMITS } from '@/lib/usage';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ADMIN_WHATSAPP = '9203177730490';
const ADMIN_EMAIL = 'mail@khiizar.com';
const WHATSAPP_LINK = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent('Hi! I want to upgrade to ScriptForge Pro plan via Easypaisa/JazzCash. Please share the payment details.')}`;
const WHATSAPP_CUSTOM_LINK = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent('Hi! I am interested in a custom plan for ScriptForge. Can we discuss the details?')}`;
const EMAIL_LINK = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent('ScriptForge Custom Plan Inquiry')}&body=${encodeURIComponent('Hi! I am interested in a custom plan for ScriptForge. Please share the available options and pricing.')}`;

const FREE_FEATURES = [
  '1 project (one-time)',
  '3 AI generations (one-time)',
  'Connect YouTube channel',
  'View video details & comments',
  'Basic editing & reordering',
];

const PRO_FEATURES = [
  'Unlimited projects',
  '100 AI generations per day',
  'Regenerate any scene content',
  'Connect YouTube channel',
  'AI-powered comment replies',
  'AI description & tag improvement',
  'Apply changes directly to YouTube',
  'Priority AI processing',
  'All Free features included',
];

function formatDate(timestamp: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function daysUntil(timestamp: number): number {
  if (!timestamp) return 0;
  const diff = timestamp - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function PlansPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const checkSession = useAuthStore((s) => s.checkSession);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [showLocalPayment, setShowLocalPayment] = useState(false);
  const [managingSub, setManagingSub] = useState(false);

  // Handle Stripe success/cancel redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      toast.success('Payment successful! Refreshing your account...');
      checkSession();
      window.history.replaceState({}, '', '/plans');
    }
    if (params.get('canceled') === 'true') {
      toast.error('Payment was canceled.');
      window.history.replaceState({}, '', '/plans');
    }
  }, [checkSession]);

  if (!user) return null;

  const isPro = user.plan === 'pro';
  const freeLimits = PLAN_LIMITS.free;
  const usage = user.dailyUsage || { date: '', projectsCreated: 0, aiGenerations: 0 };

  // Stripe subscription info
  const hasStripeSub = !!user.stripe?.subscriptionId;
  const cancelAtEnd = user.stripe?.cancelAtPeriodEnd === true;
  const periodEnd = user.planExpiresAt || user.stripe?.currentPeriodEnd || 0;
  const daysLeft = user.planDaysLeft || daysUntil(periodEnd);

  const handleUpgradeStripe = async () => {
    setLoadingStripe(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to start checkout');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoadingStripe(false);
    }
  };

  const handleManageSubscription = async (action: 'cancel' | 'resume') => {
    setManagingSub(true);
    try {
      const res = await fetch('/api/stripe/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        checkSession(); // refresh user data
      } else {
        toast.error(data.error || 'Failed to update subscription');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setManagingSub(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans & Usage</h1>
          <p className="text-sm text-muted-foreground">Manage your subscription and monitor usage</p>
        </div>
      </div>

      {/* Current Plan Badge + Usage */}
      <Card className={cn('border-2', isPro ? 'border-primary/50' : 'border-border')}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isPro ? <Crown className="size-5 text-primary" /> : <Zap className="size-5 text-muted-foreground" />}
                <span className="text-lg font-semibold">
                  {isPro ? 'Pro Plan' : 'Free Plan'}
                </span>
                {isPro && (
                  <Badge variant="default" className="text-xs">
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isPro
                  ? 'You have unlimited access to all features.'
                  : `Used: ${(usage.projectsCreated ?? 0)}/${freeLimits.projectsPerDay === Infinity ? '∞' : freeLimits.projectsPerDay} project, ${(usage.aiGenerations ?? 0)}/${freeLimits.aiGenerationsPerDay} AI generations (one-time)`}
              </p>
            </div>
            {!isPro && (
              <Button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                Upgrade to Pro
              </Button>
            )}
          </div>

          {/* Usage bars */}
          {!isPro && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Projects Used</span>
                  <span className="font-medium">{(usage.projectsCreated ?? 0)} / {freeLimits.projectsPerDay}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(100, ((usage.projectsCreated ?? 0) / freeLimits.projectsPerDay) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">AI Generations Used</span>
                  <span className="font-medium">{(usage.aiGenerations ?? 0)} / {freeLimits.aiGenerationsPerDay}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(100, ((usage.aiGenerations ?? 0) / freeLimits.aiGenerationsPerDay) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Billing Info (Pro only) ── */}
          {isPro && hasStripeSub && (
            <div className="mt-5 pt-5 border-t">
              <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                <CreditCard className="size-4 text-primary" />
                Billing Information
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                {/* Period end */}
                {periodEnd > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      {cancelAtEnd ? 'Expires on' : 'Next billing date'}
                    </div>
                    <span className="font-medium">
                      {formatDate(periodEnd)}
                      {daysLeft > 0 && (
                        <span className="text-muted-foreground ml-2">
                          ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* Cancelled warning */}
                {cancelAtEnd && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3"
                  >
                    <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-amber-600 dark:text-amber-400">
                        Auto-renewal cancelled
                      </p>
                      <p className="mt-0.5">
                        Your Pro access will continue until {formatDate(periodEnd)}.
                        After that, your plan will revert to Free. You can resume auto-renewal anytime before that date.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Active subscription badge */}
                {!cancelAtEnd && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-emerald-500" />
                    <span>Auto-renewal is active. You&apos;ll be billed $9/month automatically.</span>
                  </div>
                )}

                <Separator />

                {/* Manage buttons */}
                <div className="flex flex-col sm:flex-row gap-2">
                  {cancelAtEnd ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleManageSubscription('resume')}
                      disabled={managingSub}
                    >
                      {managingSub ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Resume Auto-Renewal
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleManageSubscription('cancel')}
                      disabled={managingSub}
                    >
                      {managingSub ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <AlertTriangle className="size-3.5" />
                      )}
                      Cancel Auto-Renewal
                    </Button>
                  )}

                  <p className="text-[11px] text-muted-foreground">
                    {cancelAtEnd
                      ? 'Click to re-enable automatic billing at the end of your period.'
                      : 'Cancel at the end of your billing period. You keep Pro access until then.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pro but no Stripe sub (manual upgrade) */}
          {isPro && !hasStripeSub && (
            <div className="mt-5 pt-5 border-t">
              <div className="rounded-lg bg-muted/30 border p-3 text-xs text-muted-foreground flex items-start gap-2">
                <MessageCircle className="size-3.5 shrink-0 mt-0.5" />
                <p>
                  Your Pro plan was activated by admin. To manage auto-renewal settings,
                  contact the admin on WhatsApp.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Cards */}
      <div id="pricing" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Free Plan */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className={cn('h-full', !isPro && 'ring-2 ring-primary')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="size-5 text-muted-foreground" />
                <CardTitle className="text-lg">Free</CardTitle>
              </div>
              <CardDescription>Get started with AI scripting</CardDescription>
              <div className="pt-2">
                <span className="text-3xl font-bold">$0</span>
                <span className="text-muted-foreground text-sm">/forever</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2.5">
                {FREE_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="size-4 text-green-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {!isPro && (
                <div className="pt-2">
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pro Plan */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className={cn('h-full relative', isPro && 'ring-2 ring-primary')}>
            {isPro && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                Active
              </div>
            )}
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="size-5 text-primary" />
                <CardTitle className="text-lg">Pro</CardTitle>
              </div>
              <CardDescription>Unlimited AI-powered scripting</CardDescription>
              <div className="pt-2">
                <span className="text-3xl font-bold">$9</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2.5">
                {PRO_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="pt-2 space-y-2">
                {!isPro ? (
                  <>
                    <Button className="w-full gap-2" onClick={handleUpgradeStripe} disabled={loadingStripe}>
                      {loadingStripe ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                      Upgrade with Card
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setShowLocalPayment(!showLocalPayment)}
                    >
                      <Banknote className="size-4" />
                      Local Payment (Easypaisa / JazzCash)
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Your Active Plan
                  </Button>
                )}
              </div>

              {/* Local Payment Section */}
              {showLocalPayment && !isPro && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pt-2"
                >
                  <Separator className="mb-4" />
                  <div className="space-y-3">
                    <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
                      <p className="font-medium text-foreground text-sm flex items-center gap-1.5">
                        <Phone className="size-3.5" />
                        Pakistani Users — Local Payment
                      </p>
                      <p>
                        Pay via <span className="font-medium text-foreground">Easypaisa</span> or{' '}
                        <span className="font-medium text-foreground">JazzCash</span> to subscribe
                        to the Pro plan. The payment transaction will be processed through Easypaisa
                        or JazzCash directly.
                      </p>
                      <p>
                        Contact the admin on WhatsApp for payment details, account number, and
                        to get your account upgraded after payment.
                      </p>
                    </div>

                    <a
                      href={WHATSAPP_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button className="w-full gap-2" style={{ backgroundColor: '#25D366', color: '#fff', borderColor: '#25D366' }}>
                        <MessageCircle className="size-4" />
                        Contact Admin on WhatsApp
                      </Button>
                    </a>

                    <p className="text-[11px] text-muted-foreground text-center">
                      You&apos;ll be redirected to WhatsApp to chat with the admin directly.
                    </p>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Custom Plan */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full relative border-dashed border-2 border-primary/30 hover:border-primary/50 transition-colors">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium flex items-center gap-1">
              <Sparkles className="size-3" />
              Custom
            </div>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <CardTitle className="text-lg">Custom Plan</CardTitle>
              </div>
              <CardDescription>Tailored for your needs</CardDescription>
              <div className="pt-2">
                <span className="text-3xl font-bold text-primary">Custom</span>
                <span className="text-muted-foreground text-sm">/pricing</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-2.5">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Need a plan that fits your specific requirements? Whether you need
                  more AI generations, team access, or a different billing cycle —
                  we can create a custom plan just for you.
                </p>
                <ul className="space-y-2">
                  {[
                    'Custom AI generation limits',
                    'Team / agency billing',
                    'Annual discounts',
                    'Dedicated support',
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 space-y-2">
                <a
                  href={WHATSAPP_CUSTOM_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button className="w-full gap-2" style={{ backgroundColor: '#25D366', color: '#fff', borderColor: '#25D366' }}>
                    <MessageCircle className="size-4" />
                    Chat on WhatsApp
                  </Button>
                </a>
                <a
                  href={EMAIL_LINK}
                  className="block"
                >
                  <Button variant="outline" className="w-full gap-2">
                    <Mail className="size-4" />
                    Send Email
                  </Button>
                </a>
              </div>

              <Separator />

              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="size-3.5 shrink-0" />
                  <span>WhatsApp: +92 317 7730490</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5 shrink-0" />
                  <span>{ADMIN_EMAIL}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}