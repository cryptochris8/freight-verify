import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Minus } from "lucide-react";
import { PLAN_TIERS } from "@/lib/stripe/plans";

const featureComparison = [
  { feature: "Verified Loads / Month", starter: "50", professional: "200", business: "500" },
  { feature: "Team Members", starter: "3", professional: "10", business: "Unlimited" },
  { feature: "Carriers", starter: "25", professional: "Unlimited", business: "Unlimited" },
  { feature: "FMCSA Verification", starter: true, professional: true, business: true },
  { feature: "OTP Pickup Codes", starter: true, professional: true, business: true },
  { feature: "Chain of Custody Log", starter: true, professional: true, business: true },
  { feature: "Email Alerts", starter: true, professional: true, business: true },
  { feature: "SMS Alerts", starter: false, professional: true, business: true },
  { feature: "API Access", starter: false, professional: true, business: true },
  { feature: "CSV Export", starter: true, professional: true, business: true },
  { feature: "Priority Support", starter: false, professional: false, business: true },
  { feature: "Dedicated Account Manager", starter: false, professional: false, business: true },
];

const faqs = [
  { q: "How does the 14-day trial work?", a: "Start with full access to all features on your chosen plan. No credit card required upfront. After 14 days, enter payment to continue." },
  { q: "Can I change plans later?", a: "Yes, you can upgrade or downgrade at any time. Changes take effect at the start of your next billing cycle." },
  { q: "What happens if I exceed my load limit?", a: "You will receive a notification when approaching your limit. You can upgrade your plan to increase the limit at any time." },
  { q: "Is there a contract or commitment?", a: "No. All plans are month-to-month. Cancel anytime with no penalties." },
  { q: "Do you offer custom enterprise plans?", a: "Yes. Contact our sales team for custom pricing on plans exceeding 500 loads per month." },
];

export default function PricingPage() {
  const tiers = ["starter", "professional", "business"] as const;
  return (
    <div className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Pricing Plans</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Choose the plan that fits your brokerage. All plans include a 14-day free trial.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto mb-20">
          {tiers.map((tier) => {
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
                  <ul className="space-y-2">{plan.features.map((f) => (<li key={f} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /><span>{f}</span></li>))}</ul>
                  <Link href="/signup" className="block"><Button className="w-full" variant={isPopular ? "default" : "outline"}>Start Free Trial</Button></Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="max-w-4xl mx-auto mb-20">
          <h2 className="text-2xl font-bold text-center mb-8">Feature Comparison</h2>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-muted/50"><th className="text-left p-3 text-sm font-medium">Feature</th><th className="text-center p-3 text-sm font-medium">Starter</th><th className="text-center p-3 text-sm font-medium">Professional</th><th className="text-center p-3 text-sm font-medium">Business</th></tr></thead>
              <tbody>
                {featureComparison.map((row) => (
                  <tr key={row.feature} className="border-t">
                    <td className="p-3 text-sm">{row.feature}</td>
                    {(["starter", "professional", "business"] as const).map((t) => {
                      const val = row[t];
                      return (<td key={t} className="text-center p-3 text-sm">{typeof val === "boolean" ? (val ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />) : val}</td>);
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (<Card key={faq.q}><CardContent className="pt-6"><h3 className="font-semibold mb-2">{faq.q}</h3><p className="text-sm text-muted-foreground">{faq.a}</p></CardContent></Card>))}
          </div>
        </div>
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">Questions about pricing? Contact our sales team.</p>
          <Link href="/signup"><Button size="lg" className="gap-2">Start Your Free Trial <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </div>
    </div>
  );
}
