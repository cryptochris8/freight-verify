"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Check, Clock, Zap, ArrowRight } from "lucide-react";
import { createCheckoutSessionAction, createPortalSessionAction } from "@/app/actions/billing";
import { PLAN_TIERS, type PlanTier } from "@/lib/stripe/plans";

interface BillingCardProps {
  subscription: {
    id: string; planTier: string; status: string;
    trialEndsAt: string | null; currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean | null;
  } | null;
  usage: { loadsThisMonth: number; loadLimit: number; carrierCount: number; carrierLimit: number | null; tier: string; };
  trial: { active: boolean; daysRemaining: number; endsAt: Date | null; };
}

const tierKeys = ["starter", "professional", "business"] as const;

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
  if (status === "trialing") return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Trial</Badge>;
  if (status === "past_due") return <Badge variant="destructive">Past Due</Badge>;
  if (status === "canceled") return <Badge variant="secondary">Canceled</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function BillingCard({ subscription, usage, trial }: BillingCardProps) {
  const [isPending, startTransition] = useTransition();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = (tier: PlanTier) => {
    setLoadingTier(tier);
    startTransition(async () => {
      const result = await createCheckoutSessionAction(tier);
      if (result.success && result.url) { window.location.href = result.url; }
      setLoadingTier(null);
    });
  };

  const handleManageBilling = () => {
    startTransition(async () => {
      const result = await createPortalSessionAction();
      if (result.success && result.url) { window.location.href = result.url; }
    });
  };

  if (!subscription) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Choose Your Plan</h3>
          <p className="text-sm text-muted-foreground">All plans include a 14-day free trial.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {tierKeys.map((tier) => {
            const plan = PLAN_TIERS[tier];
            const isPopular = tier === "professional";
            return (
              <Card key={tier} className={isPopular ? "border-primary shadow-lg relative" : "relative"}>
                {isPopular && (<div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge className="bg-primary text-primary-foreground">Most Popular</Badge></div>)}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="mt-2"><span className="text-3xl font-bold">{plan.priceDisplay}</span><span className="text-muted-foreground">/month</span></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">{plan.features.map((feature) => (<li key={feature} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /><span>{feature}</span></li>))}</ul>
                  <Button className="w-full" variant={isPopular ? "default" : "outline"} onClick={() => handleSubscribe(tier)} disabled={isPending}>{loadingTier === tier ? "Loading..." : "Start Free Trial"}{loadingTier !== tier && <ArrowRight className="ml-2 h-4 w-4" />}</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const currentTier = subscription.planTier as PlanTier;
  const plan = PLAN_TIERS[currentTier];
  const loadPct = usage.loadLimit > 0 ? Math.min((usage.loadsThisMonth / usage.loadLimit) * 100, 100) : 0;
  const trialDays = trial.daysRemaining + (trial.daysRemaining !== 1 ? " days" : " day");
  const trialEndStr = subscription.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleDateString() : "N/A";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{plan.name} Plan</h3>
          <StatusBadge status={subscription.status} />
        </div>
        <Button variant="outline" onClick={handleManageBilling} disabled={isPending} className="gap-2"><CreditCard className="h-4 w-4" /> Manage Billing</Button>
      </div>
      {trial.active && (<Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20"><CardContent className="flex items-center gap-3 py-3"><Clock className="h-5 w-5 text-blue-600" /><div><p className="text-sm font-medium">{"Trial: " + trialDays + " remaining"}</p><p className="text-xs text-muted-foreground">{"Ends on " + trialEndStr}</p></div></CardContent></Card>)}
      {subscription.cancelAtPeriodEnd && (<Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"><CardContent className="py-3"><p className="text-sm font-medium text-amber-800 dark:text-amber-200">Subscription cancels at end of current period.</p></CardContent></Card>)}
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between mb-2"><p className="text-sm font-medium">Loads This Month</p><p className="text-sm text-muted-foreground">{usage.loadsThisMonth} / {usage.loadLimit}</p></div><Progress value={loadPct} />{loadPct >= 80 && <p className="text-xs text-amber-600 mt-1">{loadPct >= 100 ? "Load limit reached." : "Approaching limit."}</p>}</CardContent></Card>
        <Card><CardContent className="pt-6 space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-medium">Carriers</p><p className="text-sm text-muted-foreground">{usage.carrierCount}{usage.carrierLimit ? (" / " + usage.carrierLimit) : " (unlimited)"}</p></div>{subscription.currentPeriodEnd && (<div className="flex items-center justify-between"><p className="text-sm font-medium">Renewal</p><p className="text-sm text-muted-foreground">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p></div>)}</CardContent></Card>
      </div>
      {currentTier !== "business" && (<Card className="border-dashed"><CardContent className="flex items-center justify-between py-4"><div className="flex items-center gap-3"><Zap className="h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Need more?</p><p className="text-xs text-muted-foreground">Upgrade for higher limits and features.</p></div></div><Button variant="outline" size="sm" onClick={handleManageBilling} disabled={isPending}>Upgrade</Button></CardContent></Card>)}
    </div>
  );
}
