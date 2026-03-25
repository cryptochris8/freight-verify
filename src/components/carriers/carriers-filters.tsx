"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface CarriersFiltersProps {
  currentSearch?: string;
  currentStatus?: string;
}

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "flagged", label: "Flagged" },
  { value: "suspended", label: "Suspended" },
  { value: "expired", label: "Expired" },
];

export function CarriersFilters({ currentSearch, currentStatus }: CarriersFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch || "");

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push("?" + params.toString());
  }

  function handleSearch() {
    updateParams("search", search);
  }

  function clearFilters() {
    setSearch("");
    router.push("/carriers");
  }

  const hasFilters = currentSearch || currentStatus;

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex gap-2">
        <Input
          placeholder="Search name or DOT #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="w-56"
        />
        <Button variant="outline" size="icon" onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <Select value={currentStatus || ""} onValueChange={(v) => updateParams("status", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}
