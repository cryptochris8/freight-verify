"use client";

import { useRouter, useSearchParams } from "next/navigation";

const alertTypes = [
  { value: "carrier_substitution", label: "Carrier Substitution" },
  { value: "domain_mismatch", label: "Domain Mismatch" },
  { value: "off_location_pickup", label: "Off-Location Pickup" },
  { value: "failed_verification", label: "Failed Verification" },
  { value: "document_expiration", label: "Document Expiration" },
  { value: "fmcsa_status_change", label: "FMCSA Status Change" },
];

export function AlertFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.replace("?" + params.toString());
  };

  return (
    <div className="flex flex-wrap gap-3">
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={searchParams.get("severity") || ""}
        onChange={(e) => updateParam("severity", e.target.value)}
      >
        <option value="">All Severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
      </select>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={searchParams.get("type") || ""}
        onChange={(e) => updateParam("type", e.target.value)}
      >
        <option value="">All Types</option>
        {alertTypes.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={searchParams.get("status") || ""}
        onChange={(e) => updateParam("status", e.target.value)}
      >
        <option value="">All Statuses</option>
        <option value="new">New</option>
        <option value="acknowledged">Acknowledged</option>
      </select>
    </div>
  );
}
