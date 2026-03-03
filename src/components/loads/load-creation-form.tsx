"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFormSchema, type LoadFormValues, generateReferenceNumber } from "@/lib/loads/validation";
import { createLoad } from "@/app/actions/loads";

interface CarrierOption {
  id: string;
  legalName: string | null;
  dotNumber: string;
}

interface LoadCreationFormProps {
  carriers: CarrierOption[];
  orgId: string;
  userId: string;
}

export function LoadCreationForm({ carriers, orgId, userId }: LoadCreationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoadFormValues>({
    resolver: zodResolver(loadFormSchema),
    defaultValues: {
      referenceNumber: generateReferenceNumber(),
      originName: "",
      originAddress: "",
      originLat: "",
      originLng: "",
      destinationName: "",
      destinationAddress: "",
      destinationLat: "",
      destinationLng: "",
      pickupDate: "",
      deliveryDate: "",
      commodity: "",
      weightLbs: "",
      specialInstructions: "",
      rateDollars: "",
      carrierId: "",
    },
  });

  function onSubmit(values: LoadFormValues) {
    setError(null);
    startTransition(async () => {
      const result = await createLoad(values, orgId, userId);
      if (result.success) {
        router.push("/loads/" + result.loadId);
      } else {
        setError("Failed to create load. Check form fields.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Load Information</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <FormField control={form.control} name="referenceNumber" render={({ field }) => (<FormItem><FormLabel>Reference Number *</FormLabel><FormControl><Input placeholder="FV-20260302-1234" {...field} /></FormControl><FormMessage /></FormItem>)} />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Origin</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="originName" render={({ field }) => (<FormItem><FormLabel>Origin Name *</FormLabel><FormControl><Input placeholder="Warehouse A" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="originAddress" render={({ field }) => (<FormItem><FormLabel>Origin Address *</FormLabel><FormControl><Input placeholder="123 Main St, City, ST 12345" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Destination</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="destinationName" render={({ field }) => (<FormItem><FormLabel>Destination Name *</FormLabel><FormControl><Input placeholder="Distribution Center B" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="destinationAddress" render={({ field }) => (<FormItem><FormLabel>Destination Address *</FormLabel><FormControl><Input placeholder="456 Oak Ave, City, ST 67890" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="pickupDate" render={({ field }) => (<FormItem><FormLabel>Pickup Date and Time *</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="deliveryDate" render={({ field }) => (<FormItem><FormLabel>Delivery Date and Time</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="commodity" render={({ field }) => (<FormItem><FormLabel>Commodity</FormLabel><FormControl><Input placeholder="Dry goods" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="weightLbs" render={({ field }) => (<FormItem><FormLabel>Weight (lbs)</FormLabel><FormControl><Input type="number" placeholder="40000" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="rateDollars" render={({ field }) => (<FormItem><FormLabel>Rate ($)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="2500.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            <FormField
              control={form.control}
              name="carrierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign Carrier (verified only)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a verified carrier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {carriers.length === 0 ? (
                        <SelectItem value="_none" disabled>No verified carriers available</SelectItem>
                      ) : (
                        carriers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.legalName || "Unknown"} (DOT# {c.dotNumber})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="specialInstructions" render={({ field }) => (<FormItem><FormLabel>Special Instructions</FormLabel><FormControl><Textarea placeholder="Any special handling requirements..." className="min-h-24" {...field} /></FormControl><FormMessage /></FormItem>)} />

            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Load"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
