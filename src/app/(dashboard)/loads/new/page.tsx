import { db } from "@/lib/db";
import { carriers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { LoadCreationForm } from "@/components/loads/load-creation-form";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function NewLoadPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/login");

  // Only fetch verified carriers
  const verifiedCarriers = await db
    .select({
      id: carriers.id,
      legalName: carriers.legalName,
      dotNumber: carriers.dotNumber,
    })
    .from(carriers)
    .where(eq(carriers.status, "verified"));

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
