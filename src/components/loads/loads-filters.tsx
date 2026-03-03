"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface LoadsFiltersProps {
  carriers: { id: string; legalName: string | null }[];
  currentSearch?: string;
  currentStatus?: string;
  currentCarrier?: string;
}

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "tendered", label: "Tendered" },
  { value: "accepted", label: "Accepted" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function LoadsFilters({ carriers, currentSearch, currentStatus, currentCarrier }: LoadsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch || "");

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // Reset page on filter change
    router.push("?" + params.toString());
  }

  function handleSearch() {
    updateParams("search", search);
  }

  function clearFilters() {
    setSearch("");
    router.push("/loads");
  }

  const hasFilters = currentSearch || currentStatus || currentCarrier;

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex gap-2">
        <Input
          placeholder="Search reference #..."
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
      <Select value={currentCarrier || ""} onValueChange={(v) => updateParams("carrier", v)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All Carriers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Carriers</SelectItem>
          {carriers.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.legalName || "Unknown"}</SelectItem>
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
