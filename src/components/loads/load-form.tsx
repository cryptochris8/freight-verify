"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const loadFormSchema = z.object({
  referenceNumber: z
    .string()
    .min(1, "Reference number is required")
    .max(50, "Reference number must be 50 characters or less"),
  originName: z.string().min(1, "Origin name is required"),
  originAddress: z.string().min(1, "Origin address is required"),
  destinationName: z.string().min(1, "Destination name is required"),
  destinationAddress: z.string().min(1, "Destination address is required"),
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().optional().or(z.literal("")),
  commodity: z.string().optional().or(z.literal("")),
  weightLbs: z.string().optional().or(z.literal("")),
  specialInstructions: z.string().optional().or(z.literal("")),
  carrierId: z.string().optional().or(z.literal("")),
});

type LoadFormValues = z.infer<typeof loadFormSchema>;

interface CarrierOption {
  id: string;
  legalName: string;
  dotNumber: string;
}

interface LoadFormProps {
  carriers?: CarrierOption[];
  defaultValues?: Partial<LoadFormValues>;
  onSubmit: (values: LoadFormValues) => void | Promise<void>;
  isLoading?: boolean;
}

export function LoadForm({
  carriers = [],
  defaultValues,
  onSubmit,
  isLoading = false,
}: LoadFormProps) {
  const form = useForm<LoadFormValues>({
    resolver: zodResolver(loadFormSchema),
    defaultValues: {
      referenceNumber: "",
      originName: "",
      originAddress: "",
      destinationName: "",
      destinationAddress: "",
      pickupDate: "",
      deliveryDate: "",
      commodity: "",
      weightLbs: "",
      specialInstructions: "",
      carrierId: "",
      ...defaultValues,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Load Information</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="referenceNumber" render={({ field }) => (<FormItem><FormLabel>Reference Number *</FormLabel><FormControl><Input placeholder="LD-2024-001" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="originName" render={({ field }) => (<FormItem><FormLabel>Origin Name *</FormLabel><FormControl><Input placeholder="Warehouse A" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="originAddress" render={({ field }) => (<FormItem><FormLabel>Origin Address *</FormLabel><FormControl><Input placeholder="123 Main St, City, ST 12345" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="destinationName" render={({ field }) => (<FormItem><FormLabel>Destination Name *</FormLabel><FormControl><Input placeholder="Distribution Center B" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="destinationAddress" render={({ field }) => (<FormItem><FormLabel>Destination Address *</FormLabel><FormControl><Input placeholder="456 Oak Ave, City, ST 67890" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="pickupDate" render={({ field }) => (<FormItem><FormLabel>Pickup Date *</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="deliveryDate" render={({ field }) => (<FormItem><FormLabel>Delivery Date</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="commodity" render={({ field }) => (<FormItem><FormLabel>Commodity</FormLabel><FormControl><Input placeholder="Dry goods" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="weightLbs" render={({ field }) => (<FormItem><FormLabel>Weight (lbs)</FormLabel><FormControl><Input type="number" placeholder="40000" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="carrierId" render={({ field }) => (<FormItem><FormLabel>Assign Carrier (verified only)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a verified carrier" /></SelectTrigger></FormControl><SelectContent>{carriers.length === 0 ? (<SelectItem value="_none" disabled>No verified carriers available</SelectItem>) : (carriers.map((carrier) => (<SelectItem key={carrier.id} value={carrier.id}>{carrier.legalName} (DOT# {carrier.dotNumber})</SelectItem>)))}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="specialInstructions" render={({ field }) => (<FormItem><FormLabel>Special Instructions</FormLabel><FormControl><Input placeholder="Any special handling requirements..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save Load"}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
