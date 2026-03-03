"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

const EVENT_TYPE_OPTIONS = [
  { value: "load_created", label: "Load Created" },
  { value: "status_change", label: "Status Change" },
  { value: "carrier_assigned", label: "Carrier Assigned" },
  { value: "pickup_verification_created", label: "Verification Created" },
  { value: "pickup_verified", label: "Pickup Verified" },
  { value: "driver_arrived", label: "Driver Arrived" },
  { value: "photos_captured", label: "Photos Captured" },
  { value: "verification_complete", label: "Verification Complete" },
  { value: "verification_failed", label: "Verification Failed" },
];

interface EventFiltersProps {
  carriers: { id: string; name: string }[];
}

export function EventFilters({ carriers }: EventFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");

  const updateParams = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push("?" + params.toString());
    },
    [router, searchParams]
  );

  const handleSearch = () => {
    updateParams("search", search || null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const selectedTypes = searchParams.get("types")?.split(",").filter(Boolean) || [];
  const selectedCarrier = searchParams.get("carrier") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  const toggleType = (type: string) => {
    const current = new Set(selectedTypes);
    if (current.has(type)) {
      current.delete(type);
    } else {
      current.add(type);
    }
    updateParams("types", current.size > 0 ? Array.from(current).join(",") : null);
  };

  const clearFilters = () => {
    router.push("?");
    setSearch("");
  };

  const hasFilters = selectedTypes.length > 0 || selectedCarrier || startDate || endDate || search;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2 flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder="Search by load ref# or carrier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedCarrier}
          onChange={(e) => updateParams("carrier", e.target.value || null)}
        >
          <option value="">All Carriers</option>
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <Input
          type="date"
          className="w-auto"
          value={startDate}
          onChange={(e) => updateParams("startDate", e.target.value || null)}
          placeholder="Start date"
        />
        <Input
          type="date"
          className="w-auto"
          value={endDate}
          onChange={(e) => updateParams("endDate", e.target.value || null)}
          placeholder="End date"
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {EVENT_TYPE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={selectedTypes.includes(opt.value) ? "default" : "outline"}
            size="sm"
            onClick={() => toggleType(opt.value)}
            className="text-xs"
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
