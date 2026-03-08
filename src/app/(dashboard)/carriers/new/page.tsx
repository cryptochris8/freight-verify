import { resolveOrgId } from "@/lib/auth";
import { NewCarrierWrapper } from "@/components/carriers/new-carrier-wrapper";

export default async function NewCarrierPage() {
  await resolveOrgId();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Add Carrier</h2>
        <p className="text-muted-foreground">
          Enter the carrier&apos;s DOT number to begin FMCSA verification.
        </p>
      </div>
      <NewCarrierWrapper />
    </div>
  );
}
