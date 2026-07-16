'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Crown, ArrowLeft, Loader2, CreditCard, MessageCircle, Banknote, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/auth-store';
import { PLAN_LIMITS } from '@/lib/usage';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ADMIN_WHATSAPP = '9203177730490';
const WHATSAPP_LINK = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent('Hi! I want to upgrade to ScriptForge Pro plan via Easypaisa/JazzCash. Please share the payment details.')}`;

const FREE_FEATURES = [
  'Up to 3 projects per day',
  '10 AI generations per day',
  'Scene-by-scene script generation',
  'Basic editing & reordering',
];

const PRO_FEATURES = [
  'Unlimited projects per day',
  '100 AI generations per day (10x more)',
  'Regenerate any scene content',
  'Priority AI processing',
  'All Free features included',
];

export default function PlansPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const checkSession = useAuthStore((s) => s.checkSession);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [showLocalPayment, setShowLocalPayment] = useState(false);

  // Handle Stripe success/cancel redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      toast.success('Payment successful! Refreshing your account...');
      checkSession(); // re-fetch user with updated plan
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
  const usage = user.dailyUsage;

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
              </div>
              <p className="text-sm text-muted-foreground">
                {isPro
                  ? 'You have unlimited access to all features.'
                  : `Today: ${usage.projectsCreated}/${freeLimits.projectsPerDay === Infinity ? '∞' : freeLimits.projectsPerDay} projects, ${usage.aiGenerations}/${freeLimits.aiGenerationsPerDay} AI generations`}
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
                  <span className="text-muted-foreground">Projects Today</span>
                  <span className="font-medium">{usage.projectsCreated} / {freeLimits.projectsPerDay}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(100, (usage.projectsCreated / freeLimits.projectsPerDay) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">AI Generations Today</span>
                  <span className="font-medium">{usage.aiGenerations} / {freeLimits.aiGenerationsPerDay}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(100, (usage.aiGenerations / freeLimits.aiGenerationsPerDay) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Cards */}
      <div id="pricing" className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              {/* Local Payment Section — Pakistani users */}
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
      </div>
    </div>
  );
}