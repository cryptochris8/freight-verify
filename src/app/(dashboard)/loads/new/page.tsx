import { db } from "@/lib/db";
import { carriers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { LoadCreationForm } from "@/components/loads/load-creation-form";
import { resolveOrgId } from "@/lib/auth";

export default async function NewLoadPage() {
  const { userId, orgId } = await resolveOrgId();

  // Only fetch verified carriers for this org
  const verifiedCarriers = await db
    .select({
      id: carriers.id,
      legalName: carriers.legalName,
      dotNumber: carriers.dotNumber,
    })
    .from(carriers)
    .where(and(eq(carriers.orgId, orgId), eq(carriers.status, "verified")));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Create New Load</h2>
        <p className="text-muted-foreground">
          Enter load details and optionally assign a verified carrier.
        </p>
      </div>
      <LoadCreationForm
        carriers={verifiedCarriers}
        orgId={orgId}
        userId={userId}
      />
    </div>
  );
}
