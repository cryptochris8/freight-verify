"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CarrierForm } from "./carrier-form";
import { toast } from "sonner";

export function NewCarrierWrapper() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: {
    dotNumber: string;
    mcNumber?: string;
    email?: string;
    phone?: string;
    notes?: string;
  }) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/carriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create carrier");
        return;
      }

      toast.success("Carrier created successfully");
      router.push("/carriers");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return <CarrierForm onSubmit={handleSubmit} isLoading={isLoading} />;
}
