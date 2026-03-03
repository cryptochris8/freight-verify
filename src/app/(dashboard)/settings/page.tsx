import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, CreditCard } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { getSubscriptionStatus } from "@/app/actions/billing";
import { BillingCard } from "@/components/settings/billing-card";

export default async function SettingsPage() {
  const billingData = await getSubscriptionStatus();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your organization settings and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Organization Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Organization configuration and team management coming soon.</p>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Billing & Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          {billingData ? (
            <BillingCard
              subscription={billingData.subscription}
              usage={billingData.usage}
              trial={billingData.trial}
            />
          ) : (
            <BillingCard subscription={null} usage={{ loadsThisMonth: 0, loadLimit: 50, carrierCount: 0, carrierLimit: 25, tier: "starter" }} trial={{ active: false, daysRemaining: 0, endsAt: null }} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
